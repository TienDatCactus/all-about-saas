import {
	BadRequestException,
	ClassSerializerInterceptor,
	ConsoleLogger,
	Logger,
	ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import configuration from './common/config/configuration';
import { HttpExceptionFilter } from './common/filter/http-exception.filter';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';

async function bootstrap() {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		logger: new ConsoleLogger({
			logLevels: ['error', 'debug', 'verbose', 'fatal'],
			prefix: 'all-about-saas',
		}),
	});
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
				const validation: Record<string, string[]> = {};
				const extractErrors = (err: any, prefix = '') => {
					const key = prefix ? `${prefix}.${err.property}` : err.property;
					if (err.constraints) {
						validation[key] = Object.values(err.constraints);
					}
					if (err.children && err.children.length > 0) {
						err.children.forEach((child: any) => extractErrors(child, key));
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
		new TransformInterceptor(),
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
