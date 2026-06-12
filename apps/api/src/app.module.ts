import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
  Post,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { LoggerMiddleware } from './common/middleware/logger/logger.middleware';
import { AuthModule } from './auth/auth.module';
import helmet from 'helmet';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guard/jwt-auth.guard';
import { CaslModule } from './casl/casl.module';
import { ConfigModule } from '@nestjs/config';
import configuration from './common/config/configuration';
import database from './common/config/database';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from './roles/roles.module';
import { ThrottlerModule } from '@nestjs/throttler';

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
