import { ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { AppController } from './app.controller';

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

	/**
	 * These assertions used to be written against an @Res() double, and they
	 * passed the whole time the endpoint was killing the process in production:
	 * the fake `res` meant the handler's return value never reached
	 * ClassSerializerInterceptor, which is where the real failure happened.
	 *
	 * Returning a plain object (and throwing for 503) is both the fix and what
	 * makes the endpoint testable without simulating Express at all.
	 */
	describe('readiness /health/ready', () => {
		it('resolves with the ok body when the database answers', async () => {
			const query = jest.fn().mockResolvedValue([{ '1': 1 }]);

			await expect(controllerWith(query).ready()).resolves.toEqual({
				status: 'ok',
				database: 'up',
			});
			expect(query).toHaveBeenCalledWith('SELECT 1');
		});

		it('throws 503 when the database is unreachable', async () => {
			const controller = controllerWith(
				jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
			);

			// The original endpoint returned a static 'OK' here, so a broken instance
			// looked healthy to every proxy and healthcheck.
			await expect(controller.ready()).rejects.toThrow(
				ServiceUnavailableException,
			);
		});

		it('does not leak the driver error to an unauthenticated caller', async () => {
			const controller = controllerWith(
				jest
					.fn()
					.mockRejectedValue(
						new Error('password authentication failed for user "aas"'),
					),
			);

			const error = await controller.ready().catch((e) => e);

			expect(JSON.stringify(error.getResponse())).not.toMatch(/password|aas/);
		});
	});
});
