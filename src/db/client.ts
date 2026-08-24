import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __crePool?: Pool;
  __creDb?: Database;
};

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and point it at a PostgreSQL instance.',
    );
  }
  return url;
}

export function getPool(): Pool {
  if (!globalForDb.__crePool) {
    globalForDb.__crePool = new Pool({
      connectionString: connectionString(),
      max: Number(process.env.PGPOOL_MAX ?? 10),
    });
  }
  return globalForDb.__crePool;
}

export function getDb(): Database {
  if (!globalForDb.__creDb) {
    globalForDb.__creDb = drizzle(getPool(), { schema, casing: 'snake_case' });
  }
  return globalForDb.__creDb;
}

export { schema };
