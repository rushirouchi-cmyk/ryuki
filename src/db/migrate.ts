import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from './client';

async function main() {
  const db = getDb();
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('migrations applied');
  await getPool().end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
