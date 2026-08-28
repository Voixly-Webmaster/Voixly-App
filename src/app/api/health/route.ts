import { NextResponse } from "next/server";
import { authSecret, resolveDatabaseUrl } from "@/lib/database-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const secret = Boolean(authSecret());
  const databaseUrl = resolveDatabaseUrl();
  let database: "ok" | "missing" | "error" = "missing";
  let databaseError: string | undefined;

  let users: number | null = null;
  if (databaseUrl) {
    try {
      const { prisma } = await import("@/lib/db");
      await prisma.$queryRaw`SELECT 1`;
      database = "ok";
      users = await prisma.user.count();
    } catch (err) {
      database = "error";
      databaseError = err instanceof Error ? err.message.slice(0, 180) : "unknown";
    }
  }

  const ok = secret && database === "ok";
  return NextResponse.json(
    {
      ok,
      secret,
      database,
      databaseError,
      users,
      appUrl: process.env.APP_URL ?? process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? null,
    },
    { status: ok ? 200 : 503 }
  );
}
