import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteBaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * A person the teacher tutors — or, for a small fixed group class, one row
 * representing the whole group (e.g. "Lớp Toán 9A"). Sessions are always
 * 1-on-1 against a Student row; a group class is one Student, not several.
 *
 * Deliberately minimal: this sub-project manages the SCHEDULE, not student
 * profiles, so there is nothing here beyond a name to hang a schedule off
 * of. No grade/note/active fields, no CRUD screens — rows are created
 * implicitly by StudentsService.findOrCreate() the first time a name is
 * used on a slot or session (Task 2).
 */
@Entity()
export class Student extends SoftDeleteBaseEntity {
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'ownerId' })
	owner!: User;

	@Column('uuid')
	@Index()
	ownerId!: string;

	@Column()
	@Index()
	name!: string;
}
