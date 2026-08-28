import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

function getDatasourceUrl(): string | undefined {
  const url = resolveDatabaseUrl();
  if (!url?.startsWith("file:")) return url;

  // Local SQLite only — keep `path` off the production/edge graph.
  const nodePath = require("path") as typeof import("path");
  let filePath = url.replace(/^file:\/?/, "");
  if (!nodePath.isAbsolute(filePath)) {
    filePath = nodePath.join(process.cwd(), "prisma", filePath.replace(/^\.\//, ""));
  }
  return `file:${filePath}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: getDatasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
