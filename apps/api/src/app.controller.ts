import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from './common/decorator/is-public.decorator';

@Controller()
export class AppController {
	constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

	/**
	 * Liveness: is the process up. Deliberately does not touch the database —
	 * Docker restarts a container on *exit*, and restarting the API cannot fix an
	 * unreachable database. Tying liveness to the DB only creates restart loops
	 * during a DB blip.
	 */
	@Public()
	@Get('/health')
	health() {
		return { status: 'ok' };
	}

	/**
	 * Readiness: can this instance actually serve traffic. This is what a reverse
	 * proxy or compose healthcheck should gate on. It returns 503 when the
	 * database is unreachable, instead of the static 'OK' that used to make a
	 * broken instance look healthy.
	 */
	@Public()
	@Get('/health/ready')
	async ready(@Res() res: Response) {
		try {
			await this.dataSource.query('SELECT 1');
			return res.status(HttpStatus.OK).json({ status: 'ok', database: 'up' });
		} catch {
			// No error detail — this endpoint is unauthenticated.
			return res
				.status(HttpStatus.SERVICE_UNAVAILABLE)
				.json({ status: 'error', database: 'down' });
		}
	}
}
