import { PrismaClient } from "@prisma/client";
import path from "path";

/** Absolute SQLite path — avoids cwd issues and broken %20 encoding in file:// URLs. */
function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return url;

  let filePath = url.replace(/^file:\/?/, "");
  if (!path.isAbsolute(filePath)) {
    filePath = path.join(process.cwd(), "prisma", filePath.replace(/^\.\//, ""));
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
