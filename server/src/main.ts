import {
  ClassSerializerInterceptor,
  ConsoleLogger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: new ConsoleLogger({
      logLevels: ['error', 'debug', 'verbose', 'fatal'],
      prefix: 'all-about-saas',
    }),
  });

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.use(helmet());
  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
