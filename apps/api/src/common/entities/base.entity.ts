import {
	CreateDateColumn,
	DeleteDateColumn,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * `!` on the columns here and in every entity is a definite-assignment
 * assertion, not a non-null assertion: with `strictPropertyInitialization` on,
 * TypeScript wants an initializer or a constructor assignment, and TypeORM
 * provides neither — it hydrates instances after construction. A NOT NULL column
 * therefore gets `!`, and only a genuinely nullable one gets `?`, so the two are
 * now distinguishable at a glance (they were not: everything was bare `: T`).
 */
export abstract class BaseEntity {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}

export abstract class SoftDeleteBaseEntity extends BaseEntity {
	@DeleteDateColumn()
	deletedAt?: Date;
}
