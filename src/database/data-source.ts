import { config } from 'dotenv';
config({ quiet: true });
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Single source of truth for database settings.
 * Used by the NestJS app AND by the TypeORM CLI (migrations).
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,

  // Where to find entities and migrations (works for .ts in dev and .js after build)
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],

  // camelCase in TypeScript -> snake_case in PostgreSQL
  namingStrategy: new SnakeNamingStrategy(),

  // NEVER true: every schema change must go through a migration
  synchronize: false,

  // Print SQL queries when DB_LOGGING=true (useful for debugging)
  logging: process.env.DB_LOGGING === 'true',
};

// The TypeORM CLI needs a default-exported DataSource
export default new DataSource(dataSourceOptions);