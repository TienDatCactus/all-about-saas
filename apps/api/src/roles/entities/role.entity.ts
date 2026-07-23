import { Entity, Column, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Permission } from '../../casl/entities/permission.entity';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class Role extends BaseEntity {
	@Column({ unique: true })
	name: string; // e.g. "admin", "editor", "viewer"

	@OneToMany(() => User, (user) => user.role)
	users: User[];

	@OneToMany(() => Permission, (permission) => permission.role, {
		cascade: true,
	})
	permissions: Permission[];
}
