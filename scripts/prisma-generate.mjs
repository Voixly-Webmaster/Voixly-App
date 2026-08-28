import { execSync } from "node:child_process";
import { prismaSchemaPath } from "./prisma-schema.mjs";

const schema = prismaSchemaPath();
console.log(`[prisma] generate — ${schema}`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: "inherit" });
