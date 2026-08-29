import { NextResponse } from "next/server";
import { authSecret, resolveDatabaseUrl } from "@/lib/database-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = Boolean(authSecret());
  const databaseUrl = resolveDatabaseUrl();
  let database: "ok" | "missing" | "error" = "missing";

  if (databaseUrl) {
    try {
      const { prisma } = await import("@/lib/db");
      await prisma.$queryRaw`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const ok = secret && database === "ok";
  return NextResponse.json({ ok, secret, database }, { status: ok ? 200 : 503 });
}
