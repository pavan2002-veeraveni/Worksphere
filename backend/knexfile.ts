import dotenv from 'dotenv';
import type { Knex } from 'knex';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const defaults: Partial<Knex.Config> = {
  client: 'pg',
  migrations: {
    directory: path.resolve(__dirname, '..', 'database', 'migrations'),
    extension: 'ts',
    tableName: 'knex_migrations',
    loadExtensions: ['.ts', '.js'],
  },
  seeds: {
    directory: path.resolve(__dirname, '..', 'database', 'seeds'),
    loadExtensions: ['.ts', '.js'],
  },
  pool: {
    min: Number(process.env.DATABASE_POOL_MIN) || 2,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 200,
    propagateCreateError: false,
  },
};

const config: Record<string, Knex.Config> = {
  development: {
    ...defaults,
    connection: {
      host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 5432,
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'worksphere',
      user: process.env.DATABASE_USER || process.env.DB_USER || 'worksphere_user',
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
    },
    debug: process.env.DATABASE_DEBUG === 'true',
  },

  test: {
    ...defaults,
    connection: {
      host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 5432,
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'worksphere_test',
      user: process.env.DATABASE_USER || process.env.DB_USER || 'test_user',
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'test_password',
    },
  },

  staging: {
    ...defaults,
    connection: {
      host: process.env.DATABASE_HOST || process.env.DB_HOST,
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT) || 5432,
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'worksphere_staging',
      user: process.env.DATABASE_USER || process.env.DB_USER,
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      ...defaults.pool,
      min: 2,
      max: 20,
    },
  },

  production: {
    ...defaults,
    connection:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL
        ? {
            connectionString:
              process.env.DATABASE_URL_UNPOOLED ||
              process.env.DATABASE_URL ||
              process.env.POSTGRES_URL,
            ssl: {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
            },
          }
        : {
            host: process.env.DATABASE_HOST,
            port: Number(process.env.DATABASE_PORT) || 5432,
            database: process.env.DATABASE_NAME || 'worksphere',
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            ssl: {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
            },
          },
    pool: {
      ...defaults.pool,
      min: 2,
      max: 15,
    },
  },
};

export default config;
module.exports = config;
