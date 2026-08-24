import "dotenv/config";
import { getDb, resolveDriver } from "../src/lib/db";
import { runMigrations } from "../src/lib/db/migrate";

const db = await getDb();
const executed = await runMigrations(db);

console.log(`driver: ${resolveDriver()}`);
console.log(
  executed.length > 0
    ? `applied ${executed.length} migration(s):\n  ${executed.join("\n  ")}`
    : "database already up to date",
);
process.exit(0);
