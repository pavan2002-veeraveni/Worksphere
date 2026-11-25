import knex, { Knex } from 'knex';
import { config } from './index';

let dbInstance: Knex | null = null;

export function createDbConnection(): Knex {
  return knex({
    client: 'pg',
    connection: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: config.database.poolMin,
      max: config.database.poolMax,
      acquireTimeoutMillis: 15000,
    },
  });
}

export function getDb(): Knex {
  if (!dbInstance) {
    dbInstance = createDbConnection();
  }
  return dbInstance;
}

export function setDbForTesting(mockDb: Knex): void {
  dbInstance = mockDb;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await getDb().raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.destroy();
    dbInstance = null;
  }
}
