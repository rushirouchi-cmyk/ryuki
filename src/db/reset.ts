import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { getDb, getPool } from './client';

/** Drops and recreates the public schema. Development helper only. */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset is disabled in production');
  }
  const db = getDb();
  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);
  console.log('public schema reset');
  await getPool().end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
