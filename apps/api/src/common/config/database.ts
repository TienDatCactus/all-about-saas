import { Logger } from '@nestjs/common';
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',

    host: process.env.DATABASE_HOST,

    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),

    username: process.env.DATABASE_USER,

    password: process.env.DATABASE_PASSWORD,

    database: process.env.DATABASE_NAME,

    autoLoadEntities: true,

    logging: process.env.NODE_ENV === 'development',

    synchronize: process.env.NODE_ENV === 'development',

    migrations: ['dist/database/migrations/*.js'],
  }),
);
