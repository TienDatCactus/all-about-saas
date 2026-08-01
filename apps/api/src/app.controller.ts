import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
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
	 *
	 * Returns 503 rather than writing through @Res(). The earlier @Res() version
	 * returned the Express Response object as the handler's value, which then
	 * reached ClassSerializerInterceptor — classToPlain walked the response's
	 * socket and threw `this.removeListener is not a function`, the exception
	 * filter tried to send a 500 on the already-sent response, and that second
	 * write aborted the process with ERR_INTERNAL_ASSERTION.
	 *
	 * The compose healthcheck polls this endpoint, so the effect was an API that
	 * killed itself every 15 seconds and restart-looped forever — visible only by
	 * running the container, since nothing about it fails a build or a unit test.
	 */
	@Public()
	@Get('/health/ready')
	async ready() {
		try {
			await this.dataSource.query('SELECT 1');
		} catch {
			// No error detail — this endpoint is unauthenticated.
			throw new ServiceUnavailableException({
				code: 'NOT_READY',
				message: 'Not ready',
				status: 'error',
				database: 'down',
			});
		}
		return { status: 'ok', database: 'up' };
	}
}
