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
