import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { Database } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { runMigrations } from "@/lib/db/migrate";
import { DEFAULT_SETTINGS } from "@/lib/config/settings";

/**
 * A throwaway PostgreSQL instance per test file. PGlite gives real Postgres
 * semantics (enums, unique indexes, `filter (where ...)`) without a server, so
 * integration tests exercise the same SQL that production runs.
 */
export async function createTestDb(): Promise<{ db: Database; cleanup: () => void }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ryuki-test-"));
  const client = await PGlite.create(dir);
  const db = drizzle(client, { schema }) as unknown as Database;

  await runMigrations(db);
  await db.insert(schema.appSettings).values(
    DEFAULT_SETTINGS.map((setting) => ({
      key: setting.key,
      value: setting.value,
      description: setting.description,
    })),
  );

  return {
    db,
    cleanup: () => {
      void client.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
