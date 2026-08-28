/**
 * Hostinger + local build.
 * - MySQL DATABASE_URL → generate MySQL client, push schema (never drops data), bootstrap admin
 * - SQLite / local     → generate SQLite client, then next build
 */
import { execSync } from "node:child_process";
import { isMysql, prismaSchemaPath } from "./prisma-schema.mjs";
import { ensureBootstrapAdmin } from "./ensure-admin.mjs";
import { applyNormalizedDatabaseUrl } from "./normalize-database-url.mjs";

applyNormalizedDatabaseUrl();

const schema = prismaSchemaPath();
console.log(`[build] prisma schema: ${schema}`);

execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });

if (isMysql()) {
  console.log("[build] syncing MySQL schema (prisma db push — no data loss)");
  try {
    execSync(`npx prisma db push --schema ${schema}`, { stdio: "inherit" });
  } catch {
    console.error(`
[build] MySQL authentication failed (Prisma P1000).

Hostinger reached the server at localhost:3306, but rejected the user/password.

Fix DATABASE_URL in hPanel → Environment variables, then redeploy:

  mysql://u935498615_34982458_4645:PASSWORD@localhost:3306/u935498615_34982458_4678

Checklist:
  1. Use the MySQL user password from hPanel → Databases (not your Hostinger login).
  2. If the password has @ # / % ? & + spaces, that is OK — the build now encodes it.
  3. Do not wrap the value in quotes in the Hostinger UI.
  4. Confirm the user is assigned to database u935498615_34982458_4678.
  5. Host is localhost when the Node app and MySQL are on the same account.
`);
    process.exit(1);
  }
  await ensureBootstrapAdmin();
}

execSync("npx next build", { stdio: "inherit" });
