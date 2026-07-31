import { HttpStatus } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AppController } from './app.controller';

/** Minimal express Response double: records the status and the JSON body. */
function mockRes() {
	const res: any = {
		statusCode: undefined as number | undefined,
		body: undefined as unknown,
		status(code: number) {
			res.statusCode = code;
			return res;
		},
		json(payload: unknown) {
			res.body = payload;
			return res;
		},
	};
	return res;
}

const controllerWith = (query: jest.Mock) =>
	new AppController({ query } as unknown as DataSource);

describe('AppController', () => {
	describe('liveness /health', () => {
		it('reports ok without touching the database', () => {
			const query = jest.fn();

			expect(controllerWith(query).health()).toEqual({ status: 'ok' });
			// Liveness must not depend on the DB: Docker restarts on exit, and a
			// restart cannot fix an unreachable database.
			expect(query).not.toHaveBeenCalled();
		});
	});

	describe('readiness /health/ready', () => {
		it('returns 200 when the database answers', async () => {
			const res = mockRes();

			await controllerWith(jest.fn().mockResolvedValue([{ '1': 1 }])).ready(
				res,
			);

			expect(res.statusCode).toBe(HttpStatus.OK);
			expect(res.body).toEqual({ status: 'ok', database: 'up' });
		});

		it('returns 503 when the database is unreachable', async () => {
			const res = mockRes();

			await controllerWith(
				jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
			).ready(res);

			// The old endpoint returned a static 'OK' here, so a broken instance
			// looked healthy to every proxy and healthcheck.
			expect(res.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
			expect(res.body).toEqual({ status: 'error', database: 'down' });
		});

		it('does not leak the driver error to an unauthenticated caller', async () => {
			const res = mockRes();

			await controllerWith(
				jest
					.fn()
					.mockRejectedValue(
						new Error('password authentication failed for user "aas"'),
					),
			).ready(res);

			expect(JSON.stringify(res.body)).not.toMatch(/password|aas/);
		});
	});
});
