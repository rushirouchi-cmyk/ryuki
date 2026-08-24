import fs from "node:fs";
import path from "node:path";
import type { Database } from "./index";

const MIGRATIONS_DIR = path.resolve("drizzle");

/** `db.execute` yields `{ rows }` on PGlite and a plain array on postgres-js. */
export function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

/**
 * Minimal forward-only migration runner. drizzle-kit generates the SQL; this
 * applies every `.sql` file in lexical order and records it in `__migrations`,
 * so the same files run against PGlite and a real PostgreSQL server.
 */
export async function runMigrations(db: Database): Promise<string[]> {
  await db.execute(
    `create table if not exists __migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );

  const appliedRows = toRows<{ name: string }>(
    await db.execute(`select name from __migrations`),
  );
  const applied = new Set(appliedRows.map((row) => row.name));

  const files = fs.existsSync(MIGRATIONS_DIR)
    ? fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith(".sql"))
        .sort()
    : [];

  const executed: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of splitStatements(sqlText)) {
      await db.execute(statement);
    }
    await db.execute(
      `insert into __migrations (name) values ('${file.replace(/'/g, "''")}')`,
    );
    executed.push(file);
  }
  return executed;
}

/** drizzle-kit separates statements with `--> statement-breakpoint`. */
function splitStatements(sqlText: string): string[] {
  return sqlText
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}
