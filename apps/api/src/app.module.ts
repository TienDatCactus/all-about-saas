import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import helmet from 'helmet';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CaslModule } from './casl/casl.module';
import configuration from './common/config/configuration';
import database from './common/config/database';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';
import { MailModule } from './mail/mail.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    CaslModule,
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}.local`],
      isGlobal: true,
      load: [configuration, database],
    }),
    TypeOrmModule.forRootAsync(database.asProvider()),
    RolesModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),

    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware, helmet()).forRoutes(
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
  }
}
