import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(0)
  @Max(65535)
  PORT: number = 8000;

  @IsString()
  @IsNotEmpty()
  DATABASE_USER: string = 'postgres';

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string = 'postgres';

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string = 'localhost';

  @IsNumber()
  @Min(0)
  @Max(65535)
  DATABASE_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string = 'default_db';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errs = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errs.length > 0) {
    throw new Error(
      `Config validation error: ${errs
        .map((err) => Object.values(err.constraints || {}).join(', '))
        .join('; ')}`,
    );
  }
  return validatedConfig;
}
