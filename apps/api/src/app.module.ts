import {
	MiddlewareConsumer,
	Module,
	NestModule,
	RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BadmintonModule } from './badminton/badminton.module';
import configuration from './common/config/configuration';
import database from './common/config/database';
import { validateEnv } from './common/config/env.validation';
import { resolveFileSecrets } from './common/config/file-secrets';
import { JwtAuthGuard } from './common/guard/jwt-auth.guard';
import { CustomeThrottlerGuard } from './common/guard/throttler.guard';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { MailModule } from './mail/mail.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

// Mounted secrets (DATABASE_PASSWORD_FILE, JWT_SECRET_FILE) into process.env,
// before anything reads it.
//
// It has to be here rather than in bootstrap(): ConfigModule.forRoot() below runs
// `validate` synchronously when the decorator argument is evaluated — during the
// *import* of this module, which main.ts does before its own first statement. A
// call at the top of bootstrap() therefore ran too late, and the containerised
// app crash-looped on "DATABASE_PASSWORD: expected string, received undefined"
// even though the secret was mounted correctly.
//
// A top-level statement, not an import side effect: import order is at the mercy
// of formatters and organise-imports, statement order is not.
resolveFileSecrets();

@Module({
	imports: [
		UsersModule,
		AuthModule,
		ConfigModule.forRoot({
			envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}.local`],
			isGlobal: true,
			load: [configuration, database],
			cache: true,
			expandVariables: true,
			// Crash on missing/insecure config instead of booting and signing JWTs
			// with `undefined`.
			validate: validateEnv,
		}),
		TypeOrmModule.forRootAsync(database.asProvider()),
		RolesModule,
		// The global limit is an ABUSE ceiling, not a usage budget. It was 10/min,
		// which is a login-endpoint number applied to every route — and below
		// what one honest user generates: the participant autocomplete fires a
		// request per typed prefix, so entering four player names spends the whole
		// minute's allowance on its own. It is also per-IP, so an office or a
		// mobile carrier behind CGNAT shares one bucket between everybody.
		//
		// The limits that actually defend anything are the per-route @Throttle
		// decorators on auth (5/min login and signup, 3/min outbound mail); those
		// are unchanged. This one only needs to stop a script, and 100/min does
		// that while leaving normal use alone.
		ThrottlerModule.forRoot({
			throttlers: [
				{
					ttl: 60000,
					limit: 100,
				},
			],
		}),

		MailModule,
		BadmintonModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{
			provide: APP_GUARD,
			useClass: CustomeThrottlerGuard,
		},
		{
			// Default-deny authentication. Previously every controller had to
			// remember @UseGuards(JwtAuthGuard), and forgetting it left a route
			// wide open — POST /mail/try was exactly that. Routes opt out with
			// @Public(), which JwtAuthGuard checks before authenticating.
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
	],
})
export class AppModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		// helmet is applied once, globally, in main.ts. Re-applying it here only
		// covered POST/PATCH/DELETE — so GET responses (the ones a browser
		// actually renders) were the only ones missing the second pass, and the
		// duplicate just set every header twice on writes.
		consumer.apply(LoggerMiddleware).forRoutes(
			{
				path: '*',
				method: RequestMethod.POST,
			},
			{
				path: '*',
				method: RequestMethod.PATCH,
			},
			{
				path: '*',
				method: RequestMethod.DELETE,
			},
		);
		// consumer.apply(VersionMiddleware).forRoutes()
	}
}
