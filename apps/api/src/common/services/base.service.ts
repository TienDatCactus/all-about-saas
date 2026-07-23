import {
	DeepPartial,
	FindManyOptions,
	FindOneOptions,
	FindOptionsOrder,
	FindOptionsRelations,
	FindOptionsSelect,
	FindOptionsWhere,
	Repository,
} from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

export interface PaginateOptions<T> {
	page?: number;
	limit?: number;
	where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
	order?: FindOptionsOrder<T>;
	relations?: FindOptionsRelations<T>;
	select?: FindOptionsSelect<T>;
}

export interface PaginatedResult<T> {
	data: T[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

/**
 * Shared data-access base for entities extending BaseEntity.
 *
 * Deliberately thin: it exposes only the read helpers consumers actually
 * call, plus the two things TypeORM does NOT give for free —
 *   - update(): load + merge + save, so @BeforeUpdate listeners run
 *     (repository.update() bypasses them);
 *   - paginate(): clamped page/limit + total/pages metadata.
 *
 * For anything else, entity services use `this.repository` directly.
 */
export abstract class BaseService<T extends BaseEntity> {
	protected constructor(protected readonly repository: Repository<T>) {}

	find(options?: FindManyOptions<T>): Promise<T[]> {
		return this.repository.find(options);
	}

	findById(
		id: string,
		options?: Omit<FindOneOptions<T>, 'where'>,
	): Promise<T | null> {
		return this.repository.findOne({
			...options,
			where: { id } as FindOptionsWhere<T>,
		});
	}

	findOne(
		where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
		options?: Omit<FindOneOptions<T>, 'where'>,
	): Promise<T | null> {
		return this.repository.findOne({ ...options, where });
	}

	create(dto: DeepPartial<T>): Promise<T> {
		const entity = this.repository.create(dto);
		return this.repository.save(entity);
	}

	/**
	 * Loads the row, merges the patch, then saves — so entity listeners run.
	 * Throws EntityNotFoundError if no row matches the id.
	 */
	async update(id: string, dto: DeepPartial<T>): Promise<T> {
		const entity = await this.repository.findOneByOrFail({
			id,
		} as FindOptionsWhere<T>);
		this.repository.merge(entity, dto);
		return this.repository.save(entity);
	}

	async paginate(options: PaginateOptions<T> = {}): Promise<PaginatedResult<T>> {
		const page = Math.max(1, options.page ?? 1);
		const limit = Math.min(100, Math.max(1, options.limit ?? 20));
		const [data, total] = await this.repository.findAndCount({
			where: options.where,
			order: options.order,
			relations: options.relations,
			select: options.select,
			skip: (page - 1) * limit,
			take: limit,
		});
		return { data, total, page, limit, pages: Math.ceil(total / limit) };
	}
}
