import {
	BadRequestException,
	ClassSerializerInterceptor,
	ConsoleLogger,
	Logger,
	ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { ValidationError } from 'class-validator';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import configuration from './common/config/configuration';
import { HttpExceptionFilter } from './common/filter/http-exception.filter';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';

const BODY_LIMIT = '100kb';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: new ConsoleLogger({
			logLevels: ['error', 'debug', 'verbose', 'fatal'],
			prefix: 'all-about-saas',
		}),
		// Nest's own body parser is registered during create(), and express's json
		// middleware skips a request whose body is already parsed — so an app.use()
		// added afterwards would never see one, and its limit would be decoration.
		// Declining the built-in is the only way to own the limit.
		bodyParser: false,
	});
	// Was express's implicit 100kb. Same number, now stated: every endpoint here
	// takes small JSON, and an unstated limit is one nobody notices changing.
	app.use(json({ limit: BODY_LIMIT }));
	app.use(urlencoded({ extended: true, limit: BODY_LIMIT }));
	const frontendUrl = configuration().frontendUrl;
	// No `origin: true` fallback: reflecting the caller's origin while
	// credentials:true is set lets any site read authenticated responses. With
	// FRONTEND_URL unset we allow no cross-origin browser traffic at all —
	// env validation already makes that a hard error in production.
	app.enableCors({
		origin: frontendUrl ? frontendUrl.split(',').map((o) => o.trim()) : false,
		credentials: true,
	});
	app.use(cookieParser());
	app.use(helmet());
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
			exceptionFactory: (validationErrors) => {
				const validation: Record<string, Array<string>> = {};
				const extractErrors = (err: ValidationError, prefix = '') => {
					const key = prefix ? `${prefix}.${err.property}` : err.property;
					if (err.constraints) {
						validation[key] = Object.values(err.constraints);
					}
					if (err.children && err.children.length > 0) {
						err.children.forEach((child) => extractErrors(child, key));
					}
				};
				validationErrors.forEach((err) => extractErrors(err));
				return new BadRequestException({
					statusCode: 400,
					code: 'VALIDATION_FAILED',
					message: 'Validation failed',
					validation,
				});
			},
		}),
	);
	// Exactly one proxy hop (Caddy/nginx) sits in front in production.
	//
	// 'loopback' was wrong the moment the proxy moved into its own container:
	// the peer is then a bridge-network address like 172.18.0.4, not 127.0.0.1,
	// so Express trusted nothing and req.ip became the PROXY's IP on every
	// request. That silently broke three things: the throttler keyed every
	// client into one shared bucket (so the 5/min login limit applied to the
	// whole internet at once), Session.ipAddress recorded the proxy for every
	// login, and req.protocol read as http behind TLS.
	//
	// `1` trusts the single rightmost X-Forwarded-For entry — the one the proxy
	// appends itself — so a client-forged header cannot spoof the source IP.
	app.set('trust proxy', 1);
	app.useGlobalInterceptors(
		new TransformInterceptor(app.get(Reflector)),
		new ClassSerializerInterceptor(app.get(Reflector)),
	);
	app.useGlobalFilters(new HttpExceptionFilter());

	// `docker stop` sends SIGTERM. Without this Node exits immediately, killing
	// in-flight requests and dropping the DB pool without closing it.
	app.enableShutdownHooks();

	// Publishing the full schema — every route, DTO and auth flow — to anonymous
	// callers is free reconnaissance, so it stays out of production builds.
	if (process.env.NODE_ENV !== 'production') {
		const config = new DocumentBuilder()
			.setTitle('SaaS API')
			.setDescription('The SaaS API core documentation')
			.setVersion('1.0')
			.addBearerAuth()
			.build();
		const document = SwaggerModule.createDocument(app, config);
		SwaggerModule.setup('api', app, document);
	}
	await app.listen(configuration().port ?? 8000);
}
bootstrap().catch((err) => Logger.error(err));
