import {
  BadRequestException,
  ClassSerializerInterceptor,
  ConsoleLogger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptor/transform.interceptor';
import { HttpExceptionFilter } from './common/filter/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import configuration from './common/config/configuration';
import cookieParser from 'cookie-parser';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      logLevels: ['error', 'debug', 'verbose', 'fatal'],
      prefix: 'all-about-saas',
    }),
  });
  app.enableCors();
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
  app.set('trust proxy', 'loopback');
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('SaaS API')
    .setDescription('The SaaS API core documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.use(cookieParser());
  app.use(helmet());
  await app.listen(configuration().port ?? 8000);
}
bootstrap();
