import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { resolveDatabaseUrl } from "@/lib/database-url";

function applyUrl() {
  const url = resolveDatabaseUrl();
  if (url) process.env.DATABASE_URL = url;
  return url;
}

function findMysqlSchema(): string | null {
  const candidates = [
    path.join(process.cwd(), "prisma/schema.mysql.prisma"),
    path.join(process.cwd(), "../prisma/schema.mysql.prisma"),
    path.join(process.cwd(), "../../prisma/schema.mysql.prisma"),
    path.join(process.cwd(), "schema.mysql.prisma"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

export async function ensureDatabase(): Promise<{
  ok: boolean;
  step: string;
  error?: string;
}> {
  const url = applyUrl();
  if (!url) return { ok: false, step: "url", error: "DATABASE_URL is not set" };

  const { prisma } = await import("@/lib/db");

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    return {
      ok: false,
      step: "connect",
      error: err instanceof Error ? err.message : "connect failed",
    };
  }

  try {
    await prisma.user.count();
    return { ok: true, step: "ready" };
  } catch {
    const schema = findMysqlSchema();
    if (!schema) {
      return {
        ok: false,
        step: "schema",
        error: "users table missing and prisma/schema.mysql.prisma not found",
      };
    }
    try {
      execSync(`npx prisma db push --schema "${schema}"`, {
        stdio: "inherit",
        env: process.env,
      });
    } catch (err) {
      return {
        ok: false,
        step: "push",
        error: err instanceof Error ? err.message : "db push failed",
      };
    }
  }

  try {
    const count = await prisma.user.count();
    if (count === 0) {
      const bcrypt = await import("bcryptjs");
      const email = (
        process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@voixly.com"
      ).toLowerCase();
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "password123";
      const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin";
      await prisma.user.create({
        data: {
          email,
          name,
          role: "ADMIN",
          passwordHash: await bcrypt.hash(password, 12),
          staffProfile: { create: { title: "Administrator" } },
        },
      });
    }
    return { ok: true, step: "ready" };
  } catch (err) {
    return {
      ok: false,
      step: "bootstrap",
      error: err instanceof Error ? err.message : "bootstrap failed",
    };
  }
}
