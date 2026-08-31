# MoMo Payment Method Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a badminton-session host attach a reusable payment method (an uploaded MoMo QR image, or a MoMo phone number) to a session, so the public share page shows participants how to pay, and the host can mark each participant paid/unpaid.

**Architecture:** A new `PaymentMethod` entity owned by `User` (many-to-one from `BadmintonSession`, so one method is reusable across sessions). `BadmintonParticipant` gains `paid`/`paidAt`. The owner-only session-edit page gets a picker modal (select/add/delete methods, assign to the session) and per-participant paid toggles; the public share page renders the assigned method (image or a per-row "Pay" link) and read-only paid badges. No new subsystem beyond what already exists — reuses the `StorageService`/MinIO upload path, the existing `BadmintonModule` CRUD conventions, and the existing `DataDialog` modal component.

**Tech Stack:** NestJS 11 + TypeORM 0.3 + PostgreSQL (`apps/api`), TanStack Start/React 19 + TanStack Query + Zod + shadcn/radix (`apps/web`), Jest for backend unit tests.

**Spec:** No separate spec file — the confirmed intent from this session's brainstorming + interview-me pass is captured directly in this plan (Goal/Architecture above, and the per-task acceptance criteria). Related reference: `docs/r2-momo-qr-upload-guide.md` (MinIO setup this feature's image upload builds on).

## Global Constraints

- Hard delete for `PaymentMethod` — no soft-delete, no "in use" guard. Deleting one that a session still references just leaves that session's payment block empty. (User-confirmed.)
- Only the session owner may manage payment methods or toggle paid status. Participants viewing the public share link never see management controls, only read-only payment info and a paid/unpaid badge.
- `PaymentMethod.type = 'image'` renders as ONE large QR image at the bottom of the share page (not per participant row) — a static image can't encode a per-person amount, so the participant reads their amount from their own row and enters it manually in the MoMo app.
- `PaymentMethod.type = 'phone'` renders as a per-row "Thanh toán" button that navigates to `https://nhantien.momo.vn/{phone}?amount={row.total}&note={note}` — no QR, no client-side QR-encoding library needed for this type.
- Reuse the existing `StorageService.uploadImage()` (`apps/api/src/common/storage/storage.service.ts`) for the image upload — do not build a second upload path.
- Follow existing owner-scoping pattern: every payment-method and payment-status mutation loads by `{ id, userId }` / goes through `findOneOwned`-style checks, mirroring `BadmintonService`.

---

## File Structure

**Backend (`apps/api/src`)**
- `payment-methods/entities/payment-method.entity.ts` — new
- `payment-methods/payment-methods.dto.ts` — new
- `payment-methods/payment-methods.service.ts` — new
- `payment-methods/payment-methods.controller.ts` — new
- `payment-methods/payment-methods.module.ts` — new
- `payment-methods/payment-methods.service.spec.ts` — new
- `badminton/entities/badminton-session.entity.ts` — modify (add `paymentMethodId`/`paymentMethod`)
- `badminton/entities/badminton-participant.entity.ts` — modify (add `paid`/`paidAt`)
- `badminton/badminton.dto.ts` — modify (`paymentMethodId` on update DTO, new `SetParticipantPaidDto`)
- `badminton/badminton.service.ts` — modify (`findOneOwned` relation, `findByShareToken` fields, new `setParticipantPaid`)
- `badminton/badminton.controller.ts` — modify (new PATCH route)
- `badminton/badminton.service.spec.ts` — modify (tests for the above)
- `badminton/badminton.module.ts` — modify (import `PaymentMethod` entity for the relation)
- `app.module.ts` — modify (register `PaymentMethodsModule`)
- `database/migrations/<timestamp>-payment-methods.ts` — new (generated)

**Frontend (`apps/web/src`)**
- `services/payment-methods/types.ts` — new
- `services/payment-methods/api.ts` — new
- `services/payment-methods/queries.ts` — new
- `services/url.ts` — modify (add `PAYMENT_METHODS` base path)
- `services/badminton/types.ts` — modify (`paymentMethodId`/`paymentMethod`, `paid`/`paidAt`)
- `services/badminton/api.ts` — modify (`setParticipantPaid`)
- `services/badminton/queries.ts` — modify (`useSetParticipantPaidMutation`)
- `pages/badminton/components/PaymentMethodPicker.tsx` — new
- `pages/badminton/components/Summary.tsx` — modify (payment column + big-image block)
- `pages/badminton/edit/index.tsx` — modify (render picker, pass owner-mode props to Summary via a session summary block — see Task 9)
- `pages/badminton/lib/format.ts` — read only (reuse `formatDong`)

---

### Task 1: `PaymentMethod` entity + schema changes on Session/Participant + migration

**Files:**
- Create: `apps/api/src/payment-methods/entities/payment-method.entity.ts`
- Modify: `apps/api/src/badminton/entities/badminton-session.entity.ts`
- Modify: `apps/api/src/badminton/entities/badminton-participant.entity.ts`
- Create: `apps/api/src/database/migrations/<timestamp>-payment-methods.ts` (generated, then reviewed)

**Interfaces:**
- Produces: `PaymentMethod` entity with `id, userId, type: PaymentMethodType ('image'|'phone'), label: string, imageUrl: string|null, phoneNumber: string|null, createdAt, updatedAt`. `PaymentMethodType` enum exported from this file.
- Produces: `BadmintonSession.paymentMethodId?: string`, `BadmintonSession.paymentMethod?: PaymentMethod`.
- Produces: `BadmintonParticipant.paid: boolean` (default `false`), `BadmintonParticipant.paidAt?: Date`.

- [ ] **Step 1: Write the entity**

```ts
// apps/api/src/payment-methods/entities/payment-method.entity.ts
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum PaymentMethodType {
	IMAGE = 'image',
	PHONE = 'phone',
}

/**
 * A host's reusable way to receive money — either an uploaded MoMo QR image,
 * or a phone number that a `nhantien.momo.vn` link is built from at render
 * time. Many {@link BadmintonSession} rows may point at one method; deleting
 * a method does not cascade to sessions (see badminton-session.entity.ts).
 */
@Entity()
export class PaymentMethod extends BaseEntity {
	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'userId' })
	user!: User;

	@Column('uuid')
	@Index()
	userId!: string;

	@Column({ type: 'enum', enum: PaymentMethodType })
	type!: PaymentMethodType;

	@Column({ length: 120 })
	label!: string;

	/** Set when type = IMAGE. A public MinIO URL from StorageService.uploadImage(). */
	@Column({ nullable: true })
	imageUrl?: string;

	/** Set when type = PHONE. Digits only, no country code (matches nhantien.momo.vn's own format). */
	@Column({ nullable: true })
	phoneNumber?: string;
}
```

- [ ] **Step 2: Add the session-side relation**

In `apps/api/src/badminton/entities/badminton-session.entity.ts`, add after the `shareToken` column and before `computed`:

```ts
	/** Reusable payment method to show on the share page. SET NULL on delete — a
	 *  session with no method just renders no payment block, never a broken FK. */
	@ManyToOne(() => PaymentMethod, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'paymentMethodId' })
	paymentMethod?: PaymentMethod;

	@Column('uuid', { nullable: true })
	paymentMethodId?: string;
```

Add the import: `import { PaymentMethod } from '../../payment-methods/entities/payment-method.entity';`

- [ ] **Step 3: Add the participant-side payment status columns**

In `apps/api/src/badminton/entities/badminton-participant.entity.ts`, add after `gender`:

```ts
	/** Host-confirmed payment status. Toggled only via the owner-scoped payment endpoint. */
	@Column({ default: false })
	paid!: boolean;

	@Column({ type: 'timestamptz', nullable: true })
	paidAt?: Date;
```

- [ ] **Step 4: Register the new entity in `BadmintonModule` so the relation resolves**

In `apps/api/src/badminton/badminton.module.ts`, add `PaymentMethod` to the `TypeOrmModule.forFeature([...])` array (it needs to be registered somewhere TypeORM loads it; `PaymentMethodsModule`, added in Task 2, is the primary owner — this import just lets `BadmintonModule` reference the entity type without a circular module dependency, matching how it already imports `User` for the same reason).

- [ ] **Step 5: Generate and review the migration**

```bash
cd apps/api
npm run migration:generate -- src/database/migrations/PaymentMethods
```

Open the generated file and confirm it contains: `CREATE TABLE "payment_method"` with the enum type, `ALTER TABLE "badminton_session" ADD "paymentMethodId"` + FK with `ON DELETE SET NULL`, `ALTER TABLE "badminton_participant" ADD "paid" boolean NOT NULL DEFAULT false` and `ADD "paidAt" TIMESTAMPTZ`. If TypeORM named the FK constraint ambiguously, that's fine — don't hand-edit column/table names, only verify they match the entities above.

- [ ] **Step 6: Run the migration against your dev database**

```bash
npm run migration:run
```

Expected: no errors; `\d payment_method` in `psql` shows the new table.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/payment-methods/entities/payment-method.entity.ts \
        apps/api/src/badminton/entities/badminton-session.entity.ts \
        apps/api/src/badminton/entities/badminton-participant.entity.ts \
        apps/api/src/badminton/badminton.module.ts \
        apps/api/src/database/migrations/
git commit -m "feat(api): add PaymentMethod entity and session/participant payment columns"
```

---

### Task 2: `PaymentMethod` CRUD module

**Files:**
- Create: `apps/api/src/payment-methods/payment-methods.dto.ts`
- Create: `apps/api/src/payment-methods/payment-methods.service.ts`
- Create: `apps/api/src/payment-methods/payment-methods.service.spec.ts`
- Create: `apps/api/src/payment-methods/payment-methods.controller.ts`
- Create: `apps/api/src/payment-methods/payment-methods.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PaymentMethod`, `PaymentMethodType` from Task 1. `StorageService.uploadImage(buffer, mimetype): Promise<string>` (`apps/api/src/common/storage/storage.service.ts`). `requireUser(req): RequestUser` (`apps/api/src/common/request-user.ts`).
- Produces: `PaymentMethodsService.listMine(userId): Promise<PaymentMethod[]>`, `PaymentMethodsService.create(userId, dto: CreatePaymentMethodDto, file?: Express.Multer.File): Promise<PaymentMethod>`, `PaymentMethodsService.remove(userId, id): Promise<{id: string}>`.
- Produces routes: `GET /payment-methods`, `POST /payment-methods` (multipart), `DELETE /payment-methods/:id`.

- [ ] **Step 1: Write the DTOs**

```ts
// apps/api/src/payment-methods/payment-methods.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethodType } from './entities/payment-method.entity';

export class CreatePaymentMethodDto {
	@IsEnum(PaymentMethodType)
	type!: PaymentMethodType;

	@IsString()
	@MaxLength(120)
	label!: string;

	/** Required when type = PHONE, ignored when type = IMAGE. Validated in the service, not here, because the field it depends on (`type`) is a sibling, not a nested shape multipart form data can express cleanly. */
	@IsOptional()
	@IsString()
	@MaxLength(20)
	phoneNumber?: string;
}
```

- [ ] **Step 2: Write the failing service test**

```ts
// apps/api/src/payment-methods/payment-methods.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentMethodType } from './entities/payment-method.entity';

function mockRepo() {
	return {
		create: jest.fn((x: unknown) => x),
		save: jest.fn(async (x: unknown) => x),
		find: jest.fn(async () => []),
		findOne: jest.fn(),
		delete: jest.fn(async () => ({ affected: 1 })),
	};
}

function mockStorage() {
	return { uploadImage: jest.fn(async () => 'https://minio.local/x/momo-qr/abc') };
}

describe('PaymentMethodsService', () => {
	let repo: ReturnType<typeof mockRepo>;
	let storage: ReturnType<typeof mockStorage>;
	let service: PaymentMethodsService;

	beforeEach(() => {
		repo = mockRepo();
		storage = mockStorage();
		service = new PaymentMethodsService(repo as never, storage as never);
	});

	it('create: type=phone stores the phone number, no upload call', async () => {
		const result = await service.create(
			'user-1',
			{ type: PaymentMethodType.PHONE, label: 'Cá nhân', phoneNumber: '0338722615' },
			undefined,
		);
		expect(storage.uploadImage).not.toHaveBeenCalled();
		expect((result as any).phoneNumber).toBe('0338722615');
		expect((result as any).userId).toBe('user-1');
	});

	it('create: type=phone with no phoneNumber throws', async () => {
		await expect(
			service.create('user-1', { type: PaymentMethodType.PHONE, label: 'x' }, undefined),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('create: type=image uploads the file and stores the returned URL', async () => {
		const file = { buffer: Buffer.from('fake'), mimetype: 'image/png' } as Express.Multer.File;
		const result = await service.create(
			'user-1',
			{ type: PaymentMethodType.IMAGE, label: 'QR nhóm' },
			file,
		);
		expect(storage.uploadImage).toHaveBeenCalledWith(file.buffer, file.mimetype);
		expect((result as any).imageUrl).toBe('https://minio.local/x/momo-qr/abc');
	});

	it('create: type=image with no file throws', async () => {
		await expect(
			service.create('user-1', { type: PaymentMethodType.IMAGE, label: 'x' }, undefined),
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('remove: deletes only when owned by the caller', async () => {
		await service.remove('user-1', 'method-1');
		expect(repo.delete).toHaveBeenCalledWith({ id: 'method-1', userId: 'user-1' });
	});

	it('remove: throws NotFoundException when nothing was deleted', async () => {
		repo.delete = jest.fn(async () => ({ affected: 0 }));
		await expect(service.remove('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/api
npx jest payment-methods.service.spec.ts
```

Expected: FAIL — `Cannot find module './payment-methods.service'`.

- [ ] **Step 4: Write the service**

```ts
// apps/api/src/payment-methods/payment-methods.service.ts
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../common/storage/storage.service';
import { CreatePaymentMethodDto } from './payment-methods.dto';
import { PaymentMethod, PaymentMethodType } from './entities/payment-method.entity';

@Injectable()
export class PaymentMethodsService {
	constructor(
		@InjectRepository(PaymentMethod)
		private readonly repo: Repository<PaymentMethod>,
		private readonly storageService: StorageService,
	) {}

	listMine(userId: string): Promise<PaymentMethod[]> {
		return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
	}

	async create(
		userId: string,
		dto: CreatePaymentMethodDto,
		file: Express.Multer.File | undefined,
	): Promise<PaymentMethod> {
		if (dto.type === PaymentMethodType.PHONE) {
			if (!dto.phoneNumber) {
				throw new BadRequestException('phoneNumber is required for type=phone');
			}
			const entity = this.repo.create({
				userId,
				type: PaymentMethodType.PHONE,
				label: dto.label,
				phoneNumber: dto.phoneNumber,
			});
			return this.repo.save(entity);
		}

		if (!file) {
			throw new BadRequestException('file is required for type=image');
		}
		const imageUrl = await this.storageService.uploadImage(file.buffer, file.mimetype);
		const entity = this.repo.create({
			userId,
			type: PaymentMethodType.IMAGE,
			label: dto.label,
			imageUrl,
		});
		return this.repo.save(entity);
	}

	async remove(userId: string, id: string): Promise<{ id: string }> {
		const result = await this.repo.delete({ id, userId });
		if (!result.affected) {
			throw new NotFoundException('Payment method not found');
		}
		return { id };
	}
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest payment-methods.service.spec.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Write the controller**

```ts
// apps/api/src/payment-methods/payment-methods.controller.ts
import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Post,
	Req,
	UploadedFile,
	UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { requireUser } from '../common/request-user';
import { CreatePaymentMethodDto } from './payment-methods.dto';
import { PaymentMethodsService } from './payment-methods.service';

@Controller('payment-methods')
@ApiTags('Payment Methods')
@ApiBearerAuth()
export class PaymentMethodsController {
	constructor(private readonly service: PaymentMethodsService) {}

	@Get()
	list(@Req() req: Request) {
		return this.service.listMine(requireUser(req).id);
	}

	@Post()
	@UseInterceptors(
		FileInterceptor('file', {
			storage: memoryStorage(),
			limits: { fileSize: 2 * 1024 * 1024 },
			fileFilter: (_req, file, cb) => {
				cb(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype));
			},
		}),
	)
	create(
		@Req() req: Request,
		@Body() dto: CreatePaymentMethodDto,
		@UploadedFile() file?: Express.Multer.File,
	) {
		return this.service.create(requireUser(req).id, dto, file);
	}

	@Delete(':id')
	remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
		return this.service.remove(requireUser(req).id, id);
	}
}
```

- [ ] **Step 7: Write the module and register it**

```ts
// apps/api/src/payment-methods/payment-methods.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { StorageService } from '../common/storage/storage.service';

@Module({
	imports: [TypeOrmModule.forFeature([PaymentMethod])],
	controllers: [PaymentMethodsController],
	providers: [PaymentMethodsService, StorageService],
	exports: [PaymentMethodsService],
})
export class PaymentMethodsModule {}
```

In `apps/api/src/app.module.ts`: add `import { PaymentMethodsModule } from './payment-methods/payment-methods.module';` and add `PaymentMethodsModule` to the `imports` array (next to `BadmintonModule`).

- [ ] **Step 8: Run the full backend test suite**

```bash
npm test
```

Expected: PASS, no regressions.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/payment-methods apps/api/src/app.module.ts
git commit -m "feat(api): add PaymentMethod CRUD module"
```

---

### Task 3: Attach a payment method to a session (owner-only)

**Files:**
- Modify: `apps/api/src/badminton/badminton.dto.ts`
- Modify: `apps/api/src/badminton/badminton.service.ts`
- Modify: `apps/api/src/badminton/badminton.service.spec.ts`

**Interfaces:**
- Consumes: `PaymentMethod` entity (Task 1).
- Produces: `UpdateBadmintonSessionDto.paymentMethodId?: string | null` (null clears it). `BadmintonService.findOneOwned()` now returns `paymentMethod` populated.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/badminton/badminton.service.spec.ts`:

```ts
it('updateSession: accepts paymentMethodId and passes it straight through to save', async () => {
	manager.findOne = jest.fn(async () => ({
		id: 'session-1',
		ownerId: 'owner-1',
		courtCost: 0,
		shuttleUnitPrice: 0,
		totalShuttleCount: 0,
		participants: [],
	}));

	const saved: any = await service.updateSession('owner-1', 'session-1', {
		paymentMethodId: 'method-1',
	});

	expect(saved.paymentMethodId).toBe('method-1');
});

it('findOneOwned: includes the paymentMethod relation', async () => {
	sessionRepo.findOne = jest.fn(async () => ({ id: 's', ownerId: 'owner-1', participants: [] }));
	await service.findOneOwned('owner-1', 's');
	expect(sessionRepo.findOne).toHaveBeenCalledWith(
		expect.objectContaining({ relations: { participants: true, paymentMethod: true } }),
	);
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api
npx jest badminton.service.spec.ts
```

Expected: FAIL — `paymentMethodId` not accepted on the DTO type / relations assertion mismatch.

- [ ] **Step 3: Add `paymentMethodId` to the update DTO**

In `apps/api/src/badminton/badminton.dto.ts`, add (near the other imports, after `CreateBadmintonSessionDto`, before `UpdateBadmintonSessionDto`):

```ts
export class UpdateBadmintonSessionDto extends PartialType(
	CreateBadmintonSessionDto,
) {
	/** Reusable payment method to show on this session's share page. Pass null to clear. */
	@IsOptional()
	@IsUUID()
	paymentMethodId?: string | null;
}
```

(Remove the old bare `export class UpdateBadmintonSessionDto extends PartialType(CreateBadmintonSessionDto) {}` line it replaces.)

- [ ] **Step 4: Wire it through the service**

In `apps/api/src/badminton/badminton.service.ts`, `updateSession()` already spreads `rest` (everything but `participants`) onto the session via `Object.assign`, so `paymentMethodId` flows through automatically once the DTO carries it — no change needed there. Update `findOneOwned()`'s relations:

```ts
async findOneOwned(ownerId: string, id: string) {
	const session = await this.sessionRepo.findOne({
		where: { id, ownerId },
		relations: { participants: true, paymentMethod: true },
	});
	if (!session) throw new NotFoundException('Session not found');
	return session;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest badminton.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/badminton/badminton.dto.ts apps/api/src/badminton/badminton.service.ts apps/api/src/badminton/badminton.service.spec.ts
git commit -m "feat(api): let a session reference a reusable payment method"
```

---

### Task 4: Participant payment status (owner toggles, public reads)

**Files:**
- Modify: `apps/api/src/badminton/badminton.dto.ts`
- Modify: `apps/api/src/badminton/badminton.service.ts`
- Modify: `apps/api/src/badminton/badminton.controller.ts`
- Modify: `apps/api/src/badminton/badminton.service.spec.ts`

**Interfaces:**
- Produces: `SetParticipantPaidDto { paid: boolean }`. `BadmintonService.setParticipantPaid(ownerId: string, sessionId: string, participantId: string, paid: boolean): Promise<BadmintonParticipant>`. Route `PATCH /badminton/sessions/:id/participants/:participantId/payment`.
- Modifies: `findByShareToken()` return shape — each participant row now also carries `paid: boolean, paidAt: string | null`, and the response carries `paymentMethod: { type, label, imageUrl, phoneNumber } | null` (owner's `userId`/email are still never included).

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/badminton/badminton.service.spec.ts`:

```ts
it('setParticipantPaid: sets paid + paidAt when marking paid, scoped to the owner', async () => {
	sessionRepo.findOne = jest.fn(async () => ({ id: 's', ownerId: 'owner-1' }));
	participantRepo.findOne = jest.fn(async () => ({
		id: 'p1',
		sessionId: 's',
		paid: false,
		paidAt: null,
	}));

	const saved: any = await service.setParticipantPaid('owner-1', 's', 'p1', true);

	expect(saved.paid).toBe(true);
	expect(saved.paidAt).toBeInstanceOf(Date);
});

it('setParticipantPaid: clears paidAt when marking unpaid', async () => {
	sessionRepo.findOne = jest.fn(async () => ({ id: 's', ownerId: 'owner-1' }));
	participantRepo.findOne = jest.fn(async () => ({
		id: 'p1',
		sessionId: 's',
		paid: true,
		paidAt: new Date(),
	}));

	const saved: any = await service.setParticipantPaid('owner-1', 's', 'p1', false);

	expect(saved.paid).toBe(false);
	expect(saved.paidAt).toBeNull();
});

it('setParticipantPaid: 404s when the session is not owned by the caller', async () => {
	sessionRepo.findOne = jest.fn(async () => null);
	await expect(service.setParticipantPaid('owner-1', 's', 'p1', true)).rejects.toBeInstanceOf(
		NotFoundException,
	);
});

it('findByShareToken: exposes paid status and a PII-safe paymentMethod', async () => {
	sessionRepo.findOne = jest.fn(async () => ({
		title: 't',
		playedOn: '2026-01-01',
		courtCost: 0,
		shuttleUnitPrice: 0,
		totalShuttleCount: 0,
		participants: [
			{ id: 'p1', name: 'A', hoursPlayed: 1, shuttleWeight: 6, gender: null, paid: true, paidAt: new Date('2026-01-02') },
		],
		computed: null,
		paymentMethod: {
			id: 'm1',
			userId: 'owner-1',
			type: 'phone',
			label: 'Cá nhân',
			phoneNumber: '0338722615',
		},
	}));

	const result: any = await service.findByShareToken('tok');

	expect(result.participants[0].paid).toBe(true);
	expect(typeof result.participants[0].paidAt).toBe('string');
	expect(result.paymentMethod).toEqual({
		type: 'phone',
		label: 'Cá nhân',
		imageUrl: undefined,
		phoneNumber: '0338722615',
	});
	expect(result.paymentMethod.userId).toBeUndefined();
});

it('findByShareToken: paymentMethod is null when the session has none', async () => {
	sessionRepo.findOne = jest.fn(async () => ({
		title: 't',
		playedOn: '2026-01-01',
		courtCost: 0,
		shuttleUnitPrice: 0,
		totalShuttleCount: 0,
		participants: [],
		computed: null,
		paymentMethod: undefined,
	}));

	const result: any = await service.findByShareToken('tok');
	expect(result.paymentMethod).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/api
npx jest badminton.service.spec.ts
```

Expected: FAIL — `service.setParticipantPaid is not a function`.

- [ ] **Step 3: Add the DTO**

In `apps/api/src/badminton/badminton.dto.ts`, add:

```ts
export class SetParticipantPaidDto {
	@IsBoolean()
	paid!: boolean;
}
```

Add `IsBoolean` to the `class-validator` import at the top of the file.

- [ ] **Step 4: Implement the service methods**

In `apps/api/src/badminton/badminton.service.ts`, add after `findByShareToken`'s current body is updated (see below) — first, the new method:

```ts
async setParticipantPaid(
	ownerId: string,
	sessionId: string,
	participantId: string,
	paid: boolean,
) {
	const session = await this.sessionRepo.findOne({ where: { id: sessionId, ownerId } });
	if (!session) throw new NotFoundException('Session not found');

	const participant = await this.participantRepo.findOne({
		where: { id: participantId, sessionId },
	});
	if (!participant) throw new NotFoundException('Participant not found');

	participant.paid = paid;
	participant.paidAt = paid ? new Date() : undefined;
	return this.participantRepo.save(participant);
}
```

Then update `findByShareToken()`:

```ts
async findByShareToken(shareToken: string) {
	const session = await this.sessionRepo.findOne({
		where: { shareToken },
		relations: { participants: true, paymentMethod: true },
	});
	if (!session) throw new NotFoundException('Session not found');
	return {
		title: session.title,
		playedOn: session.playedOn,
		courtCost: session.courtCost,
		shuttleUnitPrice: session.shuttleUnitPrice,
		totalShuttleCount: session.totalShuttleCount,
		participants: session.participants.map((p) => ({
			id: p.id,
			name: p.name,
			hoursPlayed: p.hoursPlayed,
			shuttleWeight: p.shuttleWeight,
			gender: p.gender,
			paid: p.paid,
			paidAt: p.paidAt ? p.paidAt.toISOString() : null,
		})),
		computed: session.computed,
		paymentMethod: session.paymentMethod
			? {
					type: session.paymentMethod.type,
					label: session.paymentMethod.label,
					imageUrl: session.paymentMethod.imageUrl,
					phoneNumber: session.paymentMethod.phoneNumber,
				}
			: null,
	};
}
```

Note this needs the relation added to the `findOne` call — `paymentMethod: true` alongside `participants: true`.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx jest badminton.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Add the controller route**

In `apps/api/src/badminton/badminton.controller.ts`, add after the `update()` method:

```ts
@Patch('/sessions/:id/participants/:participantId/payment')
setParticipantPaid(
	@Req() req: Request,
	@Param('id', ParseUUIDPipe) id: string,
	@Param('participantId', ParseUUIDPipe) participantId: string,
	@Body() dto: SetParticipantPaidDto,
) {
	return this.service.setParticipantPaid(requireUser(req).id, id, participantId, dto.paid);
}
```

Add `SetParticipantPaidDto` to the DTO import at the top of the file.

- [ ] **Step 7: Run the full backend suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/badminton/badminton.dto.ts apps/api/src/badminton/badminton.service.ts apps/api/src/badminton/badminton.controller.ts apps/api/src/badminton/badminton.service.spec.ts
git commit -m "feat(api): track and expose participant payment status"
```

---

### Task 5: Frontend — `payment-methods` service layer

**Files:**
- Create: `apps/web/src/services/payment-methods/types.ts`
- Create: `apps/web/src/services/payment-methods/api.ts`
- Create: `apps/web/src/services/payment-methods/queries.ts`
- Modify: `apps/web/src/services/url.ts`

**Interfaces:**
- Consumes: `http` (`@/lib/utils/http`), `parseResponse` (`@/lib/utils/parse-response`), same conventions as `services/badminton/*`.
- Produces: `PaymentMethod` type, `paymentMethodsApi.{list, create, remove}`, `usePaymentMethodsQuery`, `useCreatePaymentMethodMutation`, `useDeletePaymentMethodMutation`.

- [ ] **Step 1: Add the URL constant**

In `apps/web/src/services/url.ts`, find how `BADMINTON` is defined (a `sessions`/`session(id)` etc. object) and add alongside it:

```ts
export const PAYMENT_METHODS = {
  list: "/payment-methods",
  byId: (id: string) => `/payment-methods/${id}`,
}
```

- [ ] **Step 2: Write the types**

```ts
// apps/web/src/services/payment-methods/types.ts
import * as z from "zod"

export const PaymentMethodSchema = z.object({
  id: z.string(),
  type: z.enum(["image", "phone"]),
  label: z.string(),
  imageUrl: z.string().nullish(),
  phoneNumber: z.string().nullish(),
  createdAt: z.string(),
})

export type PaymentMethod = z.infer<typeof PaymentMethodSchema>

export const CreatePaymentMethodSchema = z.object({
  type: z.enum(["image", "phone"]),
  label: z.string().min(1).max(120),
  phoneNumber: z.string().max(20).optional(),
  file: z.instanceof(File).optional(),
})

export type CreatePaymentMethodIn = z.infer<typeof CreatePaymentMethodSchema>

export const DeletedIdSchema = z.object({ id: z.string() })

/** The PII-safe shape embedded in a public share-page response — no id, no owner info. */
export const PublicPaymentMethodSchema = z.object({
  type: z.enum(["image", "phone"]),
  label: z.string(),
  imageUrl: z.string().nullish(),
  phoneNumber: z.string().nullish(),
})

export type PublicPaymentMethod = z.infer<typeof PublicPaymentMethodSchema>
```

- [ ] **Step 3: Write the API layer**

```ts
// apps/web/src/services/payment-methods/api.ts
import { PAYMENT_METHODS } from "../url"
import {
  DeletedIdSchema,
  PaymentMethodSchema,
  type CreatePaymentMethodIn,
} from "./types"
import * as z from "zod"
import { parseResponse } from "@/lib/utils/parse-response"
import { http } from "@/lib/utils/http"

export const paymentMethodsApi = {
  list: () =>
    parseResponse(
      "paymentMethods.list",
      z.array(PaymentMethodSchema),
      http.get(PAYMENT_METHODS.list)
    ),
  create: (data: CreatePaymentMethodIn) => {
    const form = new FormData()
    form.append("type", data.type)
    form.append("label", data.label)
    if (data.phoneNumber) form.append("phoneNumber", data.phoneNumber)
    if (data.file) form.append("file", data.file)
    return parseResponse(
      "paymentMethods.create",
      PaymentMethodSchema,
      http.post(PAYMENT_METHODS.list, form)
    )
  },
  remove: (id: string) =>
    parseResponse(
      "paymentMethods.remove",
      DeletedIdSchema,
      http.delete(PAYMENT_METHODS.byId(id))
    ),
}
```

- [ ] **Step 4: Write the query hooks**

```ts
// apps/web/src/services/payment-methods/queries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { paymentMethodsApi } from "./api"
import type { CreatePaymentMethodIn } from "./types"

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
}

export const usePaymentMethodsQuery = () => {
  return useQuery({
    queryKey: paymentMethodKeys.all,
    queryFn: () => paymentMethodsApi.list(),
  })
}

export const useCreatePaymentMethodMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePaymentMethodIn) => paymentMethodsApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
    },
  })
}

export const useDeletePaymentMethodMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => paymentMethodsApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodKeys.all })
    },
  })
}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web
npm run check-types
```

Expected: no errors. (If `url.ts`'s existing `BADMINTON` export uses a different shape than assumed above — e.g. plain strings instead of an object with methods — match that file's actual pattern instead of the sketch here; read it before writing Step 1.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/payment-methods apps/web/src/services/url.ts
git commit -m "feat(web): add payment-methods service layer"
```

---

### Task 6: Frontend — extend `badminton` types/api/queries

**Files:**
- Modify: `apps/web/src/services/badminton/types.ts`
- Modify: `apps/web/src/services/badminton/api.ts`
- Modify: `apps/web/src/services/badminton/queries.ts`
- Modify: `apps/web/src/services/url.ts`

**Interfaces:**
- Consumes: `PublicPaymentMethodSchema`, `PaymentMethodSchema` from Task 5.
- Produces: `BadmintonSession.paymentMethodId`, `.paymentMethod`; `SessionParticipant.paid`, `.paidAt`; `PublicSession.paymentMethod`; `badmintonApi.setParticipantPaid(sessionId, participantId, paid)`; `useSetParticipantPaidMutation(sessionId)`.

- [ ] **Step 1: Extend the schemas**

In `apps/web/src/services/badminton/types.ts`:

```ts
import { PaymentMethodSchema, PublicPaymentMethodSchema } from "../payment-methods/types"
```

Extend `SessionParticipantSchema`:

```ts
export const SessionParticipantSchema = z.object({
  id: z.string(),
  userId: z.string().nullish(),
  name: z.string(),
  hoursPlayed: z.number(),
  shuttleWeight: z.number(),
  gender: z.enum(["male", "female"]).nullish(),
  paid: z.boolean(),
  paidAt: z.string().nullish(),
})
```

Extend `BadmintonSessionSchema` (add before `computed`):

```ts
  paymentMethodId: z.string().nullish(),
  paymentMethod: PaymentMethodSchema.nullish(),
```

`UpdateSessionIn` is currently `type UpdateSessionIn = Partial<CreateSessionIn>` — and `CreateSessionSchema` has no `paymentMethodId` field (the backend's create DTO doesn't take one either; only update does, per Task 3). `Partial<CreateSessionIn>` therefore can never carry `paymentMethodId`, but Task 7's picker calls `updateSession.mutate({ paymentMethodId })`. Change the type definition (not the create schema) to:

```ts
export type UpdateSessionIn = Partial<CreateSessionIn> & {
  paymentMethodId?: string | null
}
```

Extend `PublicSessionSchema` (add after `computed`):

```ts
  paymentMethod: PublicPaymentMethodSchema.nullish(),
```

- [ ] **Step 2: Add the URL for the payment-status route**

In `apps/web/src/services/url.ts`, wherever `BADMINTON.session(id)` is defined, add a sibling:

```ts
  participantPayment: (sessionId: string, participantId: string) =>
    `/badminton/sessions/${sessionId}/participants/${participantId}/payment`,
```

- [ ] **Step 3: Add the API call**

In `apps/web/src/services/badminton/api.ts`, add to the `badmintonApi` object:

```ts
  setParticipantPaid: (sessionId: string, participantId: string, paid: boolean) =>
    parseResponse(
      "badminton.setParticipantPaid",
      SessionParticipantSchema,
      http.patch(BADMINTON.participantPayment(sessionId, participantId), { paid })
    ),
```

Add `SessionParticipantSchema` to the type imports at the top of the file.

- [ ] **Step 4: Add the mutation hook**

In `apps/web/src/services/badminton/queries.ts`, add:

```ts
export const useSetParticipantPaidMutation = (sessionId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ participantId, paid }: { participantId: string; paid: boolean }) =>
      badmintonApi.setParticipantPaid(sessionId, participantId, paid),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: badmintonKeys.session(sessionId) })
    },
  })
}
```

- [ ] **Step 5: Type-check**

```bash
cd apps/web
npm run check-types
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/badminton apps/web/src/services/url.ts
git commit -m "feat(web): extend badminton types/api for payment method + status"
```

---

### Task 7: Frontend — `PaymentMethodPicker` modal

**Files:**
- Create: `apps/web/src/pages/badminton/components/PaymentMethodPicker.tsx`
- Modify: `apps/web/src/pages/badminton/edit/index.tsx`

**Interfaces:**
- Consumes: `DataDialog` (`@/components/custom/data/dialog`), `usePaymentMethodsQuery`, `useCreatePaymentMethodMutation`, `useDeletePaymentMethodMutation` (Task 5), `useUpdateSessionMutation` (existing, `@/services/badminton/queries`), `PaymentMethod` type (Task 5).
- Produces: `<PaymentMethodPicker sessionId={string} value={string | null | undefined} />` — a trigger button that opens the modal; selecting a method calls `useUpdateSessionMutation(sessionId).mutate({ paymentMethodId })`.

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/pages/badminton/components/PaymentMethodPicker.tsx
import { useState } from "react"
import { CheckIcon, PlusIcon, TrashIcon, WalletIcon } from "@phosphor-icons/react"
import DataDialog from "@/components/custom/data/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "@/components/custom/toast"
import {
  useCreatePaymentMethodMutation,
  useDeletePaymentMethodMutation,
  usePaymentMethodsQuery,
} from "@/services/payment-methods/queries"
import type { PaymentMethod } from "@/services/payment-methods/types"
import { useUpdateSessionMutation } from "@/services/badminton/queries"

export function PaymentMethodPicker({
  sessionId,
  value,
}: {
  sessionId: string
  value: string | null | undefined
}) {
  const [open, setOpen] = useState(false)
  const methodsQuery = usePaymentMethodsQuery()
  const updateSession = useUpdateSessionMutation(sessionId)
  const deleteMethod = useDeletePaymentMethodMutation()

  const methods = methodsQuery.data ?? []
  const current = methods.find((m) => m.id === value)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <WalletIcon data-icon="inline-start" />
        {current ? current.label : "Chọn phương thức nhận tiền"}
      </Button>
      <DataDialog
        open={open}
        onOpenChange={setOpen}
        title="Phương thức nhận tiền"
        description="Chọn hoặc thêm QR/SĐT MoMo để hiện trên trang chia sẻ."
        content={
          <div className="flex flex-col gap-4">
            <RadioGroup
              value={value ?? undefined}
              onValueChange={(id) => {
                updateSession.mutate(
                  { paymentMethodId: id },
                  {
                    onError: () => toast.error("Không đổi được phương thức nhận tiền"),
                  }
                )
              }}
            >
              {methods.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={m.id} id={m.id} />
                    <Label htmlFor={m.id}>
                      {m.label}
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({m.type === "image" ? "QR ảnh" : m.phoneNumber})
                      </span>
                    </Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Xoá ${m.label}`}
                    onClick={() => {
                      deleteMethod.mutate(m.id, {
                        onSuccess: () => {
                          if (value === m.id) {
                            updateSession.mutate({ paymentMethodId: null })
                          }
                        },
                        onError: () => toast.error("Xoá thất bại"),
                      })
                    }}
                  >
                    <TrashIcon />
                  </Button>
                </div>
              ))}
              {methods.length === 0 && (
                <p className="text-muted-foreground text-sm">Chưa có phương thức nào.</p>
              )}
            </RadioGroup>
            <AddMethodForm />
          </div>
        }
      />
    </>
  )
}

function AddMethodForm() {
  const [type, setType] = useState<"image" | "phone">("phone")
  const [label, setLabel] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [file, setFile] = useState<File | undefined>(undefined)
  const createMethod = useCreatePaymentMethodMutation()

  const canSubmit =
    label.trim().length > 0 && (type === "phone" ? phoneNumber.trim().length > 0 : !!file)

  return (
    <div className="border-t pt-4">
      <div className="mb-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={type === "phone" ? "default" : "outline"}
          onClick={() => setType("phone")}
        >
          SĐT MoMo
        </Button>
        <Button
          type="button"
          size="sm"
          variant={type === "image" ? "default" : "outline"}
          onClick={() => setType("image")}
        >
          Upload ảnh QR
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <Input
          placeholder="Tên gợi nhớ (vd: MoMo cá nhân)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        {type === "phone" ? (
          <Input
            placeholder="Số điện thoại MoMo"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        ) : (
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        )}
        <Button
          type="button"
          disabled={!canSubmit || createMethod.isPending}
          onClick={() => {
            createMethod.mutate(
              { type, label, phoneNumber: type === "phone" ? phoneNumber : undefined, file },
              {
                onSuccess: () => {
                  setLabel("")
                  setPhoneNumber("")
                  setFile(undefined)
                  toast.success("Đã thêm phương thức nhận tiền")
                },
                onError: () => toast.error("Thêm thất bại"),
              }
            )
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Thêm
        </Button>
      </div>
    </div>
  )
}
```

If `RadioGroup`/`RadioGroupItem` don't already exist under `@/components/ui/radio-group` (check with `ls apps/web/src/components/ui/radio-group.tsx`), install the shadcn primitive first: this repo uses shadcn/radix, so `npx shadcn@latest add radio-group` from `apps/web` generates it in the project's existing style — don't hand-roll one.

- [ ] **Step 2: Wire it into the edit page**

In `apps/web/src/pages/badminton/edit/index.tsx`, import and render next to `ShareLink`:

```tsx
import { PaymentMethodPicker } from "../components/PaymentMethodPicker"
```

```tsx
        <div className="space-y-4">
          <ShareLink shareToken={session.shareToken} />
          <PaymentMethodPicker sessionId={sessionId} value={session.paymentMethodId} />
          <SessionEditor
            sessionId={sessionId}
            initialValues={sessionToValues(session)}
          />
        </div>
```

- [ ] **Step 3: Manual verification (no backend-independent unit test for this UI — covered by the browser check in Task 9)**

Skip automated testing here; this component is exercised end-to-end in Task 9's browser verification step, which is where its behavior (add/select/delete) will actually be confirmed against the running app.

- [ ] **Step 4: Type-check**

```bash
cd apps/web
npm run check-types
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/badminton/components/PaymentMethodPicker.tsx apps/web/src/pages/badminton/edit/index.tsx
git commit -m "feat(web): add payment method picker to the session edit page"
```

---

### Task 8: Frontend — payment column in `BadmintonSummary`

**Files:**
- Modify: `apps/web/src/pages/badminton/components/Summary.tsx`

**Interfaces:**
- Consumes: `PublicPaymentMethod` / `PaymentMethod` (Task 5), `formatDong` (existing, `@/pages/badminton/lib/format`).
- Produces: new optional props on `BadmintonSummary`: `paymentMethod?: { type: "image" | "phone"; label: string; imageUrl?: string | null; phoneNumber?: string | null } | null`, `paymentStatus?: Record<string, { paid: boolean }>` (keyed by participant id), `onTogglePaid?: (participantId: string, paid: boolean) => void`. When `onTogglePaid` is provided, paid badges become clickable toggles (owner mode); when absent, they're read-only (public mode).

- [ ] **Step 1: Extend the props and add a Payment column**

In `apps/web/src/pages/badminton/components/Summary.tsx`, extend `SummaryProps`:

```ts
interface PaymentMethodDisplay {
  type: "image" | "phone"
  label: string
  imageUrl?: string | null
  phoneNumber?: string | null
}

interface SummaryProps {
  computed: DisplaySnapshot
  meta?: { title?: string | null; playedOn?: string }
  paymentMethod?: PaymentMethodDisplay | null
  paymentStatus?: Record<string, { paid: boolean }>
  onTogglePaid?: (participantId: string, paid: boolean) => void
}
```

Update the function signature: `export function BadmintonSummary({ computed, meta, paymentMethod, paymentStatus, onTogglePaid }: SummaryProps) {`.

Add a `Payment` column header after `Total`:

```tsx
                    <TableHead>Total</TableHead>
                    {paymentMethod && <TableHead>Payment</TableHead>}
```

(the existing `Total` head has `className="text-right"` — keep that, this just adds a sibling.)

Add the corresponding cell inside the row `.map`, after the existing Total `<TableCell>`:

```tsx
                      {paymentMethod && (
                        <TableCell>
                          <PaymentCell
                            row={row}
                            method={paymentMethod}
                            paid={row.participantId ? paymentStatus?.[row.participantId]?.paid : undefined}
                            onTogglePaid={
                              row.participantId && onTogglePaid
                                ? (paid) => onTogglePaid(row.participantId!, paid)
                                : undefined
                            }
                          />
                        </TableCell>
                      )}
```

Add the `PaymentCell` component and the big-image block at the bottom of the file:

```tsx
function PaymentCell({
  row,
  method,
  paid,
  onTogglePaid,
}: {
  row: DisplaySnapshot["rows"][number]
  method: PaymentMethodDisplay
  paid: boolean | undefined
  onTogglePaid?: (paid: boolean) => void
}) {
  const payUrl =
    method.type === "phone" && method.phoneNumber
      ? `https://nhantien.momo.vn/${method.phoneNumber}?amount=${Math.round(row.total)}&note=${encodeURIComponent(row.name)}`
      : undefined

  return (
    <div className="flex items-center justify-end gap-2">
      {payUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={payUrl} target="_blank" rel="noopener noreferrer">
            Thanh toán
          </a>
        </Button>
      )}
      {paid === undefined ? null : onTogglePaid ? (
        <Button
          variant={paid ? "default" : "outline"}
          size="sm"
          onClick={() => onTogglePaid(!paid)}
        >
          {paid ? "Đã trả" : "Chưa trả"}
        </Button>
      ) : (
        <Badge variant={paid ? "default" : "secondary"}>
          {paid ? "Đã trả" : "Chưa trả"}
        </Badge>
      )}
    </div>
  )
}
```

Add the necessary imports at the top: `import { Badge } from "@/components/ui/badge"` and `import { Button } from "@/components/ui/button"` (the latter is likely already imported — check before duplicating).

Finally, render the single big QR image below the table, inside the `hasRows` branch, after the closing `</div>` of `overflow-x-auto` and before that branch's own closing `</div>`:

```tsx
            {paymentMethod?.type === "image" && paymentMethod.imageUrl && (
              <div className="flex flex-col items-center gap-2 border-t pt-4">
                <p className="text-muted-foreground text-sm">{paymentMethod.label}</p>
                <img
                  src={paymentMethod.imageUrl}
                  alt={`QR nhận tiền: ${paymentMethod.label}`}
                  className="h-64 w-64 rounded-lg border object-contain"
                />
              </div>
            )}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web
npm run check-types
```

Expected: no errors. (`DisplaySnapshot["rows"][number]` must have a `total` and `name` field — it does, from `ComputedRowSchema`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/badminton/components/Summary.tsx
git commit -m "feat(web): render payment method and paid status in the split summary"
```

---

### Task 9: Wire owner vs. public modes into the two pages + browser verification

**Files:**
- Modify: `apps/web/src/pages/badminton/edit/index.tsx`
- Modify: `apps/web/src/pages/badminton/share/index.tsx`

**Interfaces:**
- Consumes: `BadmintonSummary` (Task 8), `useSetParticipantPaidMutation` (Task 6).

- [ ] **Step 1: Render `BadmintonSummary` on the owner edit page with toggle wired up**

`edit/index.tsx` currently doesn't render `BadmintonSummary` at all (only `SessionEditor`). Check whether `SessionEditor` already renders a summary internally (`apps/web/src/pages/badminton/components/session-editor/index.tsx`) — if it does, that's where `paymentMethod`/`paymentStatus`/`onTogglePaid` need threading through as props, following whatever prop-drilling pattern that component already uses to reach `BadmintonSummary`. If it does not, add a `BadmintonSummary` block to `edit/index.tsx` directly:

```tsx
import { useSetParticipantPaidMutation } from "@/services/badminton/queries"
```

```tsx
        <div className="space-y-4">
          <ShareLink shareToken={session.shareToken} />
          <PaymentMethodPicker sessionId={sessionId} value={session.paymentMethodId} />
          <SessionEditor
            sessionId={sessionId}
            initialValues={sessionToValues(session)}
          />
          <OwnerSummary session={session} sessionId={sessionId} />
        </div>
```

```tsx
function OwnerSummary({
  session,
  sessionId,
}: {
  session: import("@/services/badminton/types").BadmintonSession
  sessionId: string
}) {
  const setPaid = useSetParticipantPaidMutation(sessionId)
  if (!session.computed) return null

  const paymentStatus = Object.fromEntries(
    (session.participants ?? []).map((p) => [p.id, { paid: p.paid }])
  )

  return (
    <BadmintonSummary
      computed={session.computed}
      meta={{ title: session.title, playedOn: session.playedOn }}
      paymentMethod={session.paymentMethod ?? null}
      paymentStatus={paymentStatus}
      onTogglePaid={(participantId, paid) => setPaid.mutate({ participantId, paid })}
    />
  )
}
```

Add `import { BadmintonSummary } from "../components/Summary"` if not already present. Skip this step entirely (don't add a duplicate summary) if `SessionEditor` is confirmed to already render one — thread the props into that existing render instead.

- [ ] **Step 2: Render the public share page in read-only mode**

In `apps/web/src/pages/badminton/share/index.tsx`, pass the new props without `onTogglePaid`:

```tsx
          <BadmintonSummary
            computed={toComputed(session)}
            meta={{ title: session.title, playedOn: session.playedOn }}
            paymentMethod={session.paymentMethod ?? null}
            paymentStatus={Object.fromEntries(
              session.participants.map((p) => [p.id, { paid: p.paid }])
            )}
          />
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web
npm run check-types
```

Expected: no errors.

- [ ] **Step 4: Browser verification**

Start the dev stack (`docker:up` for postgres/mailpit, then `npm run dev` for the apps, per the repo's existing dev workflow) and in the Browser pane:

1. Log in, open an existing badminton session's edit page.
2. Click the payment method picker button → add a "phone" method (label + phone number) → confirm it appears in the list and becomes selected.
3. Confirm the split summary on the same page now shows a "Payment" column with a "Thanh toán" link per row, and a "Chưa trả" toggle button.
4. Click a toggle → confirm it flips to "Đã trả" and persists after a page reload.
5. Add an "image" method (upload a small PNG) and select it → confirm the picker shows it, and the summary now shows one large QR image below the table instead of per-row links.
6. Open the session's public share link in a fresh/incognito context → confirm: no picker, no toggle buttons, "Chưa trả"/"Đã trả" shown as a plain badge, the payment link or image renders identically to the owner view.
7. Delete a payment method that's currently selected on a session, from the picker → confirm the session's summary payment block goes empty (no picker, no error) on next load.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/badminton/edit/index.tsx apps/web/src/pages/badminton/share/index.tsx
git commit -m "feat(web): wire payment method and paid status into owner and public views"
```
