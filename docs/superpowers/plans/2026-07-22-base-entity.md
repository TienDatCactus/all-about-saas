# Global Base Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `BaseEntity` / `SoftDeleteBaseEntity` abstract classes and migrate all 8 TypeORM entities onto them, plus `select: false` hardening for `User.password` and `Session.refreshToken`.

**Architecture:** Two abstract classes (no `@Entity()` decorator) in `apps/api/src/common/entities/base.entity.ts`; TypeORM merges inherited columns into each child table. Entities drop their duplicated `id`/`createdAt`/`updatedAt`/`deletedAt` declarations. Credential columns become `select: false`; a dedicated query method re-selects password where auth flows need it.

**Tech Stack:** NestJS 11, TypeORM (Postgres), pnpm workspace (`apps/api`).

## Global Constraints

- **NO GIT COMMITS.** User rule: never commit. Skip every commit step; leave all changes in the working tree.
- Spec: `docs/superpowers/specs/2026-07-22-base-entity-design.md`.
- Tabs for indentation (repo convention).
- `synchronize` is true only in development (`common/config/database.ts:23`); dev DB may need drop/resync because three entities change PK type int → uuid. Do NOT run migrations against any non-dev database.
- Build check: `pnpm --filter api build` from repo root. Tests: `pnpm --filter api test`.
- `User.password` already has `select: false` in the working tree (user's own edit) — keep it.

---

### Task 1: Base entity classes

**Files:**

- Create: `apps/api/src/common/entities/base.entity.ts`
- Delete: `apps/api/src/common/others/base.entity.ts` (and `common/others/` dir if then empty)

**Interfaces:**

- Produces: `BaseEntity { id: string (uuid PK); createdAt: Date; updatedAt: Date }`, `SoftDeleteBaseEntity extends BaseEntity { deletedAt?: Date }`. All later tasks import from `'../../common/entities/base.entity'` (adjust relative depth per file).

- [ ] **Step 1: Create the file**

```ts
import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export abstract class BaseEntity {
  @PrimaryGeneratedColumn("uuid")
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

- [ ] **Step 2: Delete the old draft**

Run: `rm -r apps/api/src/common/others`
First confirm `grep -rn "common/others" apps/api/src` returns nothing (no imports of the draft). Expected: no matches, delete succeeds.

- [ ] **Step 3: Build**

Run: `pnpm --filter api build`
Expected: exit 0.

---

### Task 2: Migrate uuid-PK entities (Session, VerificationToken, UserProfile, OAuthAccount)

**Files:**

- Modify: `apps/api/src/auth/entities/session.entity.ts`
- Modify: `apps/api/src/auth/entities/verification-token.entity.ts`
- Modify: `apps/api/src/users/entities/user-profile.entity.ts`
- Modify: `apps/api/src/users/entities/oauth-account.entity.ts`

**Interfaces:**

- Consumes: `BaseEntity` from Task 1.
- Produces: same public shapes plus inherited `createdAt`/`updatedAt`. `OAuthAccount.linkedAt` is REMOVED, replaced by inherited `createdAt` (grep confirmed `linkedAt` referenced nowhere outside the entity).

- [ ] **Step 1: Session — extend BaseEntity, drop `id`/`createdAt`, add `select: false` deferred to Task 5**

```ts
import { Column, Entity, ManyToOne } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { BaseEntity } from "../../common/entities/base.entity";

@Entity()
export class Session extends BaseEntity {
  @ManyToOne(() => User, {
    onDelete: "CASCADE",
  })
  user: User;

  @Column()
  refreshToken: string;

  @Column()
  deviceName: string;

  @Column()
  userAgent: string;

  @Column()
  ipAddress: string;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column()
  expiresAt: Date;
}
```

- [ ] **Step 2: VerificationToken — extend BaseEntity, drop `id`**

Keep all domain columns (`selector`, `user`, `tokenHash`, `type`, `expiresAt`, `usedAt`); remove `PrimaryGeneratedColumn` import and `id` field; add `extends BaseEntity` with import.

- [ ] **Step 3: UserProfile — extend BaseEntity, drop `id`**

Same pattern: remove `PrimaryGeneratedColumn` import and `id`; `export class UserProfile extends BaseEntity`.

- [ ] **Step 4: OAuthAccount — extend BaseEntity, drop `id`, `linkedAt`, `updatedAt`**

Remove `PrimaryGeneratedColumn`, `CreateDateColumn`, `UpdateDateColumn` imports; remove `id`, `linkedAt`, `updatedAt` fields; `export class OAuthAccount extends BaseEntity`. All other columns unchanged.

- [ ] **Step 5: Build + tests**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: build exit 0; tests pass (specs mock repositories, entity shape changes should be inert — if a spec references `linkedAt`, update it to `createdAt`).

---

### Task 3: Migrate int-PK entities to uuid (Role, Permission, ResourceRegistry)

**Files:**

- Modify: `apps/api/src/roles/entities/role.entity.ts`
- Modify: `apps/api/src/casl/entities/permission.entity.ts`
- Modify: `apps/api/src/casl/entities/resource-registry.entity.ts`
- Possibly modify: `apps/api/src/roles/roles.service.ts`, `apps/api/src/roles/roles.controller.ts`, casl services — anywhere typed `id: number` for these entities.

**Interfaces:**

- Consumes: `BaseEntity` from Task 1.
- Produces: `Role.id` / `Permission.id` / `ResourceRegistry.id` change type `number` → `string` (uuid). **Breaking for dev DB** — synchronize cannot convert int PK with FKs to uuid in place; dev database must be dropped/recreated (it is dev-only; `synchronize: false` everywhere else).

- [ ] **Step 1: Role**

```ts
import { Entity, Column, OneToMany } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Permission } from "../../casl/entities/permission.entity";
import { BaseEntity } from "../../common/entities/base.entity";

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
```

- [ ] **Step 2: Permission and ResourceRegistry**

Same pattern: drop `PrimaryGeneratedColumn` import and `id: number`; `extends BaseEntity`. All domain columns unchanged.

- [ ] **Step 3: Fix number-typed id references**

Run: `grep -rn "id: number\|id?: number\|ParseIntPipe" apps/api/src/roles apps/api/src/casl`
For each hit referring to Role/Permission/ResourceRegistry ids: change type to `string`, replace `ParseIntPipe` with `ParseUUIDPipe`, and update DTOs. Show no remaining hits when done.

- [ ] **Step 4: Build + tests**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: exit 0. Update any spec fixtures using numeric ids (e.g. `id: 1` → `id: 'uuid-string'`).

---

### Task 4: User extends SoftDeleteBaseEntity

**Files:**

- Modify: `apps/api/src/users/entities/user.entity.ts`

**Interfaces:**

- Consumes: `SoftDeleteBaseEntity` from Task 1.
- Produces: `User` unchanged publicly (`id`, `createdAt`, `updatedAt`, `deletedAt` now inherited). `password` keeps `select: false` (already in working tree).

- [ ] **Step 1: Rewrite entity**

```ts
import { Column, Entity, ManyToOne, OneToMany, OneToOne } from "typeorm";
import { OAuthAccount } from "./oauth-account.entity";
import { Session } from "../../auth/entities/session.entity";
import { VerificationToken } from "../../auth/entities/verification-token.entity";
import { UserProfile } from "./user-profile.entity";
import { Role } from "../../roles/entities/role.entity";
import { SoftDeleteBaseEntity } from "../../common/entities/base.entity";

@Entity()
export class User extends SoftDeleteBaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true, select: false })
  password: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @OneToMany(() => OAuthAccount, (oauthAccount) => oauthAccount.user)
  oauthAccounts: OAuthAccounArray<T>;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => VerificationToken, (token) => token.user)
  verificationTokens: VerificationToken[];

  @ManyToOne(() => Role, (role) => role.users, { nullable: true })
  role: Role;

  @OneToOne(() => UserProfile, (profile) => profile.user, {
    cascade: true,
  })
  profile: UserProfile;
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter api build` — expected exit 0.

---

### Task 5: select:false call-site fixes (password + refreshToken)

**Files:**

- Modify: `apps/api/src/auth/entities/session.entity.ts` (`refreshToken` column)
- Modify: `apps/api/src/users/services/users-query.service.ts` (new method)
- Modify: `apps/api/src/users/services/users-command.service.ts:49` (`validateUser`)
- Modify: `apps/api/src/auth/services/auth.service.ts:214` (`changePassword`) and `:262` (`resetPassword`)
- Test: `apps/api/src/users/services/users.service.spec.ts` / `apps/api/src/auth/services/auth.service.spec.ts`

**Interfaces:**

- Produces: `UsersQueryService.findOneWithPassword(q: FindOptionsWhere<User>): Promise<User | null>` — returns user WITH password populated. Default `findOneBy` no longer returns password.

- [ ] **Step 1: Session.refreshToken gets select: false**

```ts
	@Column({ select: false })
	refreshToken: string;
```

Note: `sessionRepo.findOne({ where: { refreshToken } })` in `auth.service.ts:163,183` still works — `select: false` affects returned columns, not WHERE. Verify no code reads `session.refreshToken` off a fetched entity: `grep -rn "\.refreshToken" apps/api/src --include="*.ts" | grep -v "result.refreshToken\|body\|cookies\|dto"` — inspect each hit; fetched-session reads must be refactored or the flow re-issues a fresh token (current flows generate new tokens, they don't re-read stored ones).

- [ ] **Step 2: Add findOneWithPassword to UsersQueryService**

```ts
	async findOneWithPassword(q: FindOptionsWhere<User>) {
		return await this.usersRepository.findOne({
			where: q,
			select: {
				id: true,
				email: true,
				password: true,
				isActive: true,
				emailVerified: true,
			},
		});
	}
```

- [ ] **Step 3: Switch password readers to it**

- `users-command.service.ts` `validateUser`: `const user = await this.uqService.findOneWithPassword({ email });`
- `auth.service.ts` `changePassword`: `const rec = await this.uqService.findOneWithPassword({ id: user.id });`
- `auth.service.ts` `resetPassword`: `const user = await this.uqService.findOneWithPassword({ email });`

Other `findOneBy` call sites (sendResetPasswordEmail, verification-token creation, etc.) never read `password` — leave them.

- [ ] **Step 4: Build + tests**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: exit 0; update mocks in specs to stub `findOneWithPassword` where `validateUser`/password flows are tested.

---

### Task 6: Verification

- [ ] **Step 1: Full build + test**

Run: `pnpm --filter api build && pnpm --filter api test`
Expected: both exit 0.

- [ ] **Step 2: Runtime schema check (dev only, if dev DB available)**

Start dev API (`pnpm --filter api dev`) against a fresh dev database; confirm TypeORM synchronize creates tables with uuid `id`, `createdAt`, `updatedAt` on all 8 entities and `deletedAt` on `user`. If old dev DB exists with int ids, drop it first.

- [ ] **Step 3: Login flow smoke test**

Exercise sign-in (local strategy) to prove `findOneWithPassword` works and `select: false` didn't break auth. Expected: login succeeds, `GET` user responses contain no `password` field.

- [ ] **Step 4: NO COMMIT**

Leave everything uncommitted per user rule. Report diff summary to user.
