import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import type { UsersService } from './users.service';

/**
 * The scaffold version of this file asserted `toBeDefined()` while instantiating
 * the real UsersService, so it failed on DI and tested nothing. GET /users/me is
 * the whole controller now, so these cover that instead.
 */
describe('UsersController', () => {
	const controllerWith = (findById: jest.Mock) =>
		new UsersController({ findById } as unknown as UsersService);

	it('returns the record for the id on the verified JWT', async () => {
		const me = { id: 'u1', email: 'dat@test.com', role: { name: 'user' } };
		const findById = jest.fn().mockResolvedValue(me);

		const result = await controllerWith(findById).me({ user: { id: 'u1' } });

		expect(result).toBe(me);
		expect(findById).toHaveBeenCalledWith('u1', { relations: { role: true } });
	});

	it('ignores any id supplied in the request itself', async () => {
		const findById = jest.fn().mockResolvedValue({ id: 'u1' });

		// A caller putting someone else's id in the body/query/params must not be
		// able to read that account: only req.user, set by JwtAuthGuard, is used.
		await controllerWith(findById).me({
			user: { id: 'u1' },
			body: { id: 'victim' },
			query: { id: 'victim' },
			params: { id: 'victim' },
		});

		expect(findById).toHaveBeenCalledWith('u1', { relations: { role: true } });
		expect(findById).toHaveBeenCalledTimes(1);
	});

	it('throws NotFound when the account no longer exists', async () => {
		// A valid JWT can outlive the account it names.
		const findById = jest.fn().mockResolvedValue(null);

		await expect(
			controllerWith(findById).me({ user: { id: 'deleted' } }),
		).rejects.toBeInstanceOf(NotFoundException);
	});
});
