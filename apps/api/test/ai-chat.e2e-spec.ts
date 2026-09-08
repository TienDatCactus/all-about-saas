/**
 * Requires `TZ=UTC` in the process environment — see the `test:e2e` script in
 * apps/api/package.json.
 *
 * Postgres stores `createdAt`/`updatedAt` as `timestamp without time zone`
 * (TypeORM's default for `@CreateDateColumn()`/`@UpdateDateColumn()` — see
 * apps/api/src/common/entities/base.entity.ts). TypeORM writes the UTC
 * wall-clock components into that naive column, but `pg`'s default type
 * parser reads a naive timestamp back via `new Date(y, m, d, h, mi, s, ms)`,
 * a LOCAL-time constructor — so on a process whose local timezone isn't UTC,
 * every `createdAt`/`updatedAt` read back is off by the local UTC offset.
 * Confirmed empirically on a UTC+7 machine: a row inserted with
 * `toolCallState: 'pending'` milliseconds earlier read back with a
 * `createdAt` 7 hours in the past, which made `ChatService.getPendingAction`'s
 * 15-minute expiry check (`Date.now() - createdAt.getTime() > PENDING_TTL_MS`)
 * look expired immediately — the "persists a pending write" test flaked to
 * `pending: false` for a row that had just been created.
 *
 * This is a latent, pre-existing bug in how the app stores dates generally
 * (not introduced by this test, and not specific to AI chat) that most CI/
 * deployment environments never observe because their containers default to
 * UTC. `process.env.TZ = 'UTC'` set *inside* this file does NOT fix it —
 * confirmed empirically that Node/V8 resolves the process's local-time offset
 * once, before Jest ever loads a test file, and does not re-read `TZ`
 * afterwards. The environment variable has to be set before the `jest`
 * process itself starts, hence the `test:e2e` script change rather than a
 * statement here.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { BadmintonService } from '../src/badminton/badminton.service';
import { TransformInterceptor } from '../src/common/interceptor/transform.interceptor';

/**
 * `streamText` is mocked at the module level rather than hitting Kimi for
 * real — this test is about the HTTP surface and the HITL gate, not model
 * quality (the design spec's "manual golden path" step covers that).
 */
jest.mock('ai', () => {
	const actual = jest.requireActual('ai');
	return {
		...actual,
		streamText: jest.fn(() => ({
			pipeUIMessageStreamToResponse: (res: import('express').Response) => {
				res.status(200).end();
			},
		})),
	};
});
import { streamText } from 'ai';

/**
 * `ApiResponse<T>` envelope every non-`@Res()` route gets wrapped in by
 * `TransformInterceptor` (apps/api/src/common/interceptor/transform.
 * interceptor.ts) — supertest sees this raw shape, unlike the web app's axios
 * client, which unwraps `.data.data` itself.
 */
interface Envelope<T> {
	success: boolean;
	statusCode: number;
	message: string;
	data: T;
}

describe('AI chat (e2e)', () => {
	let app: INestApplication<App>;
	let badmintonService: { createSession: jest.Mock };
	let accessToken: string;

	beforeEach(async () => {
		badmintonService = {
			createSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
		};

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(BadmintonService)
			.useValue(badmintonService)
			.compile();

		app = moduleFixture.createNestApplication();
		// `Test.createTestingModule` + `createNestApplication()` never runs
		// main.ts's `bootstrap()`, so the global pipes/interceptors/filters set up
		// there (ValidationPipe, TransformInterceptor, HttpExceptionFilter, etc.)
		// are absent by default — confirmed empirically: without this, `login.body`
		// came back as the bare `{ accessToken }` the controller returns, not the
		// `ApiResponse<T>` envelope every real client (including the web app) sees.
		// TransformInterceptor is the one piece this test's assertions depend on;
		// registering it here (as main.ts does) is what makes this an end-to-end
		// test of the real envelope, not of a stand-in module wiring.
		app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
		await app.init();

		// Requires DEV_AUTH_BYPASS=true in the test env (apps/api/.env.test.local
		// or however `npm run test:e2e` loads env for this repo) — env.validation.ts
		// refuses it in production but allows it everywhere else.
		const login = await request(app.getHttpServer())
			.post('/auth/dev/login')
			.send({ email: 'ai-chat-e2e@example.com' })
			.expect(201);
		accessToken = (login.body as Envelope<{ accessToken: string }>).data
			.accessToken;
	});

	afterEach(async () => {
		await app.close();
	});

	it('rejects an unauthenticated chat request', async () => {
		await request(app.getHttpServer())
			.post('/ai/chat')
			.send({ message: 'hi' })
			.expect(401);
	});

	it('persists a pending write and executes it on confirm', async () => {
		const authHeader = { Authorization: `Bearer ${accessToken}` };

		// onFinish is one of streamText's options — invoke it directly, the same
		// way the AI SDK would once the mocked stream "finishes". `onFinish` is
		// `async` in chat.service.ts (it awaits a repo save), so it must be
		// awaited here too, inside `pipeUIMessageStreamToResponse`, before the
		// response ends — otherwise the POST resolves 200 while the PENDING row
		// is still being written, and the very next request (the pending-action
		// check below) races it. Confirmed empirically: without the `await`, the
		// pending-action assertion flaked to `pending: false`.
		(streamText as jest.Mock).mockImplementationOnce((options) => {
			return {
				pipeUIMessageStreamToResponse: async (
					res: import('express').Response,
				) => {
					await options.onFinish({
						text: 'I can create that session for you — confirm?',
						toolResults: [
							{
								toolCallId: 't1',
								toolName: 'createBadmintonSession',
								output: {
									requiresConfirmation: true,
									action: 'createBadmintonSession',
									args: {
										playedOn: '2026-09-10',
										courtCost: 100000,
										shuttleUnitPrice: 12000,
										totalShuttleCount: 10,
										participants: [{ name: 'An' }],
									},
									summary: 'Create a session on 2026-09-10',
								},
							},
						],
					});
					res.status(200).end();
				},
			};
		});

		await request(app.getHttpServer())
			.post('/ai/chat')
			.set(authHeader)
			.send({ message: 'Create a session for Sept 10' })
			.expect(200);

		// threadId isn't in the streamed response body in this design (the
		// client generates it up front — see Task 10); the test reads it back
		// off the row `onFinish` just persisted instead of parsing the stream.
		const dataSource = app.get<DataSource>(getDataSourceToken());
		const [{ threadId }] = await dataSource.query(
			'SELECT "threadId" FROM chat_message ORDER BY "createdAt" DESC LIMIT 1',
		);

		const pendingRes = await request(app.getHttpServer())
			.get(`/ai/chat/${threadId}/pending-action`)
			.set(authHeader)
			.expect(200);
		const pending = (
			pendingRes.body as Envelope<{ pending: boolean; summary?: string }>
		).data;
		expect(pending.pending).toBe(true);

		const confirmRes = await request(app.getHttpServer())
			.post('/ai/chat/confirm')
			.set(authHeader)
			.send({ threadId, approve: true })
			.expect(201);
		const confirmed = (
			confirmRes.body as Envelope<{ message: string; toolCallState: string }>
		).data;

		expect(confirmed.message).toContain('session-1');
		expect(confirmed.toolCallState).toBe('executed');
		expect(badmintonService.createSession).toHaveBeenCalledTimes(1);
	});
});
