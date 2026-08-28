import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath);
}

function getDatasourceUrl(): string | undefined {
  const url = resolveDatabaseUrl();
  if (!url?.startsWith("file:")) return url;

  // Local SQLite only — avoid importing `path` so webpack/edge never see it.
  let filePath = url.replace(/^file:\/?/, "");
  if (!isAbsolutePath(filePath)) {
    const cwd = process.cwd().replace(/[/\\]+$/, "");
    filePath = `${cwd}/prisma/${filePath.replace(/^\.\//, "")}`;
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
