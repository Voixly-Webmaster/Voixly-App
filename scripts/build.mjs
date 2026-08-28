/**
 * Hostinger + local build.
 * - MySQL DATABASE_URL → generate MySQL client, push schema (never drops data), bootstrap admin
 * - SQLite / local     → generate SQLite client, then next build
 */
import { execSync } from "node:child_process";
import { isMysql, prismaSchemaPath } from "./prisma-schema.mjs";
import { ensureBootstrapAdmin } from "./ensure-admin.mjs";

const schema = prismaSchemaPath();
console.log(`[build] prisma schema: ${schema}`);

execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });

if (isMysql()) {
  console.log("[build] syncing MySQL schema (prisma db push — no data loss)");
  execSync(`npx prisma db push --schema ${schema}`, { stdio: "inherit" });
  await ensureBootstrapAdmin();
}

execSync("npx next build", { stdio: "inherit" });
