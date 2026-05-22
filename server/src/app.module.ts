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
import { validate } from './common/others/env.validation';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    CaslModule,
    ConfigModule.forRoot({
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}.local`],
      isGlobal: true,
      load: [configuration, database],
      validate,
    }),
    TypeOrmModule.forRootAsync(database.asProvider()),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
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
