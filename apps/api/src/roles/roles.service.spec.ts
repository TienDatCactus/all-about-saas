import { RolesService } from './roles.service';
import type { Repository } from 'typeorm';
import type { Role } from './entities/role.entity';

// The scaffold version registered RolesService with no RoleRepository, so it
// failed on DI. Constructing it directly with a double keeps the smoke test.
describe('RolesService', () => {
	it('is constructible with its repository', () => {
		const service = new RolesService({
			find: jest.fn(),
			findOne: jest.fn(),
		} as unknown as Repository<Role>);
		expect(service).toBeDefined();
	});
});
