import "dotenv/config";
import fs from "node:fs";
import { resolveDriver, resolvePgliteDir } from "../src/lib/db";

if (resolveDriver() === "pglite") {
  const dir = resolvePgliteDir();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`removed embedded database at ${dir}`);
} else {
  const { default: postgres } = await import("postgres");
  const client = postgres(process.env.DATABASE_URL as string, { max: 1 });
  await client`drop schema public cascade`;
  await client`create schema public`;
  await client.end();
  console.log("dropped and recreated schema public");
}
process.exit(0);
