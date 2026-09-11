import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Student } from './entities/student.entity';

/** Mirrors MIN_SUGGEST_QUERY in BadmintonService — same rationale: an
 *  empty/one-character query would otherwise return a bulk directory read. */
const MIN_SUGGEST_QUERY = 2;

@Injectable()
export class StudentsService {
	constructor(
		@InjectRepository(Student)
		private readonly studentRepo: Repository<Student>,
	) {}

	suggest(ownerId: string, q: string) {
		const term = q.trim();
		if (term.length < MIN_SUGGEST_QUERY) return Promise.resolve([]);

		return this.studentRepo.find({
			where: { ownerId, name: ILike(`%${term}%`) },
			take: 8,
			order: { name: 'ASC' },
		});
	}

	async findOrCreate(ownerId: string, name: string) {
		const trimmed = name.trim();
		const existing = await this.studentRepo.findOne({
			where: { ownerId, name: ILike(trimmed) },
		});
		if (existing) return existing;

		return this.studentRepo.save(
			this.studentRepo.create({ ownerId, name: trimmed }),
		);
	}
}
