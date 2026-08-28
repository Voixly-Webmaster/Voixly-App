/**
 * Hostinger + local build.
 * - MySQL → generate client, find a working socket/TCP host, push schema, next build
 * - SQLite → generate client, next build
 * Schema push never blocks `next build` so a Hostinger deploy can finish.
 */
import { execSync } from "node:child_process";
import { isMysql, prismaSchemaPath } from "./prisma-schema.mjs";
import { ensureBootstrapAdmin } from "./ensure-admin.mjs";
import { applyNormalizedDatabaseUrl } from "./normalize-database-url.mjs";
import { findWorkingMysqlUrl } from "./probe-mysql.mjs";

applyNormalizedDatabaseUrl();

const schema = prismaSchemaPath();
console.log(`[build] prisma schema: ${schema}`);

execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });

if (isMysql()) {
  const working = await findWorkingMysqlUrl();
  if (working) {
    process.env.DATABASE_URL = working;
    console.log("[build] syncing MySQL schema (prisma db push — no data loss)");
    try {
      execSync(`npx prisma db push --schema ${schema}`, {
        stdio: "inherit",
        env: process.env,
      });
      await ensureBootstrapAdmin();
    } catch {
      console.warn("[build] prisma db push failed — continuing with next build");
    }
  } else {
    console.warn("[build] skipping prisma db push — Next.js build will still run");
  }
}

execSync("npx next build", { stdio: "inherit" });
