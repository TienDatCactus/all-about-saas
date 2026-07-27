# Global Base Entity Design

**Date:** 2026-07-22
**Scope:** `apps/api`

## Goal

Remove repeated `id` / `createdAt` / `updatedAt` / `deletedAt` declarations across all TypeORM entities and give future entities a single inheritance point.

## Design

### Location

`apps/api/src/common/entities/base.entity.ts`

The existing draft at `apps/api/src/common/others/base.entity.ts` is replaced and the `common/others/` directory removed (vague name, single file).

### Classes

```ts
import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export abstract class SoftDeleteBaseEntity extends BaseEntity {
  @DeleteDateColumn()
  deletedAt?: Date;
}
```

Rules:

- Classes are `abstract` and carry **no** `@Entity()` decorator. TypeORM merges inherited columns into each child's table (single-table-per-child inheritance).
- The `_id?: string` field from the draft is dropped — the codebase convention is uuid `id` via `@PrimaryGeneratedColumn('uuid')`.
- Soft delete is opt-in via `SoftDeleteBaseEntity`, not global. Hard-delete entities (sessions, verification tokens) must not carry `deletedAt` / softRemove semantics.

### Entity migration (all 8 existing entities)

| Entity | Extends | Change |
|---|---|---|
| `User` | `SoftDeleteBaseEntity` | drop `id`, `createdAt`, `updatedAt`, `deletedAt` declarations |
| `Session` | `BaseEntity` | drop `id`, `createdAt`; **gains `updatedAt`** |
| `VerificationToken` | `BaseEntity` | drop duplicated columns; gains any missing timestamp |
| `OAuthAccount` | `BaseEntity` | same |
| `UserProfile` | `BaseEntity` | same |
| `Role` | `BaseEntity` | same |
| `Permission` | `BaseEntity` | same |
| `ResourceRegistry` | `BaseEntity` | same |

`Session.revokedAt` stays as-is — domain field, not soft delete.

### Schema impact

Entities that previously lacked `updatedAt` (at least `Session`) gain a new column. If `synchronize` is disabled in the environment, a migration must be generated for the new columns. All other columns are decorator-identical, so no other schema change occurs.

### Testing / verification

- `pnpm` build of `apps/api` passes.
- Existing test suite passes.
- If migrations are used: generated migration contains only the expected `ADD COLUMN updatedAt` statements.

### Credential hardening (in scope)

- `User.password` gets `@Column({ nullable: true, select: false })`.
- `Session.refreshToken` gets `@Column({ select: false })`.

These columns stop appearing in default `find()` results; call sites that need them must use `addSelect('entity.column')` (query builder) or `select` option. Audit all call sites reading these fields during implementation (auth login flow, session refresh flow) and update them.

## Accepted trade-off

Every entity extending `BaseEntity` gets `updatedAt`. Any future entity that must not have it cannot use the base class; none exist today.
