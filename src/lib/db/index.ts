import path from "node:path";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * The app talks to PostgreSQL through one of two drivers:
 *
 * - `postgres-js` when `DATABASE_URL` points at a real server (Supabase, RDS,
 *   a local `postgres` daemon...).
 * - embedded PGlite otherwise, so `npm run setup && npm run dev` works with no
 *   external service. Both are the same PostgreSQL dialect, so the schema,
 *   migrations and queries are identical.
 */
export type Database =
  | ReturnType<typeof drizzlePglite<typeof schema>>
  | ReturnType<typeof drizzlePostgres<typeof schema>>;

export type DbDriver = "postgres" | "pglite";

export function resolveDriver(url = process.env.DATABASE_URL): DbDriver {
  return url && url.trim().length > 0 ? "postgres" : "pglite";
}

export function resolvePgliteDir(): string {
  return path.resolve(process.env.PGLITE_DATA_DIR ?? "./data/pglite");
}

async function createDatabase(): Promise<Database> {
  if (resolveDriver() === "postgres") {
    const postgres = (await import("postgres")).default;
    const client = postgres(process.env.DATABASE_URL as string, { max: 5 });
    return drizzlePostgres(client, { schema });
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const client = await PGlite.create(resolvePgliteDir());
  return drizzlePglite(client, { schema });
}

const globalForDb = globalThis as unknown as { __ryukiDb?: Promise<Database> };

/**
 * Cached on `globalThis` so Next.js dev-server hot reloads do not open a new
 * PGlite instance (which would fail to acquire the data directory lock).
 */
export function getDb(): Promise<Database> {
  globalForDb.__ryukiDb ??= createDatabase();
  return globalForDb.__ryukiDb;
}

export { schema };
