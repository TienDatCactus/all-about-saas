import {
	Injectable,
	InternalServerErrorException,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { streamText, isStepCount } from 'ai';
import type { ModelMessage } from 'ai';
import type { Response } from 'express';
import { BadmintonService } from '../badminton/badminton.service';
import { RagService } from './rag.service';
import { getKimiChatModel } from './ai.config';
import { buildReadTools } from './tools/read-tools';
import { buildWriteTools } from './tools/write-tools';
import type { PendingAction } from './tools/write-tools';
import {
	ChatMessage,
	ChatMessageRole,
	ToolCallState,
} from './entities/chat-message.entity';
import { SendChatMessageDto, ConfirmChatActionDto } from './dto/chat.dto';

const PENDING_TTL_MS = 15 * 60 * 1000;
const HISTORY_LIMIT = 40;

const SYSTEM_PROMPT = `You are TwinFoundry's badminton assistant. You can propose
creating a session or marking a participant paid, and answer questions about how
the cost split works using the knowledge base. You can never save a change
yourself — when a tool result has requiresConfirmation: true, tell the user
what you are about to do and that they need to confirm.`;

@Injectable()
export class ChatService {
	constructor(
		@InjectRepository(ChatMessage)
		private readonly chatMessageRepo: Repository<ChatMessage>,
		private readonly badmintonService: BadmintonService,
		private readonly ragService: RagService,
		private readonly dataSource: DataSource,
	) {}

	async handleMessage(
		userId: string,
		dto: SendChatMessageDto,
		res: Response,
	): Promise<void> {
		const threadId = dto.threadId ?? crypto.randomUUID();

		// Stop paying for tokens the client will never read.
		const abortController = new AbortController();
		res.on('close', () => abortController.abort());

		// DESC + take, then reverse back to chronological order: without a
		// bound here, every turn resends the entire thread, so per-turn cost
		// grows linearly and total thread cost grows quadratically — exactly
		// what the design spec's Cost & Ops section budgets against.
		const history = dto.threadId
			? (
					await this.chatMessageRepo.find({
						where: { threadId, userId },
						order: { createdAt: 'DESC' },
						take: HISTORY_LIMIT,
					})
				).reverse()
			: [];

		await this.chatMessageRepo.save(
			this.chatMessageRepo.create({
				threadId,
				userId,
				role: ChatMessageRole.USER,
				content: dto.message,
			}),
		);

		const tools = {
			...buildReadTools({ ragService: this.ragService }),
			...buildWriteTools(),
		};

		const result = streamText({
			model: getKimiChatModel(),
			system: SYSTEM_PROMPT,
			messages: [
				// TOOL-role rows are a local audit trail appended by confirmAction
				// below — never replayed to the model. AI SDK's `ModelMessage` requires
				// a `tool` role's content to be structured `ToolResultPart`s, never a
				// plain string, so a TOOL row would fail `streamText`'s own runtime
				// validation if it reached here. Filtering keeps the cast honest.
				...history
					.filter((m) => m.role !== ChatMessageRole.TOOL)
					.map((m) => ({ role: m.role, content: m.content }) as ModelMessage),
				{ role: 'user' as const, content: dto.message },
			],
			tools,
			stopWhen: isStepCount(5),
			abortSignal: abortController.signal,
			onFinish: async ({ text, toolResults }) => {
				const pending = toolResults
					.map((r) => r.output as PendingAction | undefined)
					.find((output) => output?.requiresConfirmation);

				// At most one PENDING draft per thread: a new turn — whether or
				// not it drafts a fresh action — supersedes anything left
				// unconfirmed from an earlier turn. Without this, two drafted-
				// but-unconfirmed turns in the same thread both stay executable,
				// and confirming the newer one doesn't retire the older one.
				await this.chatMessageRepo.update(
					{ threadId, userId, toolCallState: ToolCallState.PENDING },
					{ toolCallState: ToolCallState.REJECTED },
				);

				await this.chatMessageRepo.save(
					this.chatMessageRepo.create({
						threadId,
						userId,
						role: ChatMessageRole.ASSISTANT,
						// The draft's deterministic, args-derived summary (built in
						// write-tools.ts) is what the user actually approves — the
						// model's free-form narration (`text`) can disagree with
						// `toolCall.args`, and is often empty on a tool-only turn.
						content: pending ? pending.summary : text,
						toolCall: pending
							? { name: pending.action, args: pending.args }
							: null,
						toolCallState: pending ? ToolCallState.PENDING : ToolCallState.NONE,
					}),
				);
			},
		});

		await result.pipeUIMessageStreamToResponse(res);
	}

	async getPendingAction(
		userId: string,
		threadId: string,
	): Promise<{ pending: boolean; summary?: string }> {
		const last = await this.chatMessageRepo.findOne({
			where: { threadId, userId, toolCallState: ToolCallState.PENDING },
			order: { createdAt: 'DESC' },
		});
		if (!last) return { pending: false };

		const age = Date.now() - new Date(last.createdAt).getTime();
		if (age > PENDING_TTL_MS) return { pending: false };

		return { pending: true, summary: last.content };
	}

	async confirmAction(
		userId: string,
		dto: ConfirmChatActionDto,
	): Promise<{ message: string; toolCallState: ToolCallState }> {
		// Everything below runs against one locked row, in one transaction:
		// - `pessimistic_write` makes a double-click-fast double-confirm safe —
		//   the second transaction's `findOne` blocks until the first commits,
		//   then finds the row no longer `pending`.
		// - Same pattern `BadmintonService.updateSession` already uses for its
		//   own read-modify-write (apps/api/src/badminton/badminton.service.ts).
		// This does NOT make the domain write (`badmintonService.createSession`/
		// `setParticipantPaid`) atomic with the state flip — those run on their
		// own injected repositories, a separate connection from this
		// transaction's manager. A crash between the domain write succeeding and
		// this transaction committing leaves the row `pending` and retryable,
		// which duplicates the write on retry. Accepted for this feature's scale;
		// closing it fully would mean making BadmintonService participate in the
		// same manager, which is out of scope here.
		return this.dataSource.transaction(async (manager) => {
			const pending = await manager.findOne(ChatMessage, {
				where: {
					threadId: dto.threadId,
					userId,
					toolCallState: ToolCallState.PENDING,
				},
				order: { createdAt: 'DESC' },
				lock: { mode: 'pessimistic_write' },
			});
			if (!pending || !pending.toolCall) {
				throw new NotFoundException('No pending action for this thread');
			}

			const age = Date.now() - new Date(pending.createdAt).getTime();
			if (age > PENDING_TTL_MS) {
				pending.toolCallState = ToolCallState.REJECTED;
				await manager.save(pending);
				throw new NotFoundException(
					'This action has expired — ask again to get a fresh confirmation.',
				);
			}

			if (!dto.approve) {
				pending.toolCallState = ToolCallState.REJECTED;
				await manager.save(pending);
				return {
					message: 'Cancelled — nothing was saved.',
					toolCallState: pending.toolCallState,
				};
			}

			const { name, args } = pending.toolCall;
			let message: string;

			if (name === 'createBadmintonSession') {
				const session = await this.badmintonService.createSession(
					userId,
					args as never,
				);
				message = `Created session ${session.id}.`;
			} else if (name === 'setParticipantPaid') {
				const { sessionId, participantId, paid } = args as {
					sessionId: string;
					participantId: string;
					paid: boolean;
				};
				await this.badmintonService.setParticipantPaid(
					userId,
					sessionId,
					participantId,
					paid,
				);
				message = `Marked participant as ${paid ? 'paid' : 'unpaid'}.`;
			} else {
				// The tool name came back out of a jsonb column — untrusted at read
				// time even though only two names are producible today. A server-side
				// data-integrity fault, not a missing resource: 500, not 404, and the
				// row is deliberately left `pending` rather than silently discarded.
				throw new InternalServerErrorException(
					`Unknown pending tool call: ${name}`,
				);
			}

			pending.toolCallState = ToolCallState.EXECUTED;
			await manager.save(pending);
			// Audit trail only — never replayed into the model (see the TOOL-role
			// filter in handleMessage above), so plain text is fine here instead of
			// the AI SDK's structured ToolResultPart shape.
			await manager.save(
				manager.create(ChatMessage, {
					threadId: dto.threadId,
					userId,
					role: ChatMessageRole.TOOL,
					content: message,
				}),
			);

			// Two keys, deliberately: `TransformInterceptor` (apps/api/src/common/
			// interceptor/transform.interceptor.ts) promotes a *single*-key
			// `{ message }` return straight onto the envelope and nulls `data` —
			// exactly what NOT to return here, since the web client reads `data`.
			return { message, toolCallState: ToolCallState.EXECUTED };
		});
	}
}
