import { NextResponse } from "next/server";
import { authSecret } from "@/lib/database-url";
import { ensureDatabase } from "@/lib/ensure-db";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const url = new URL(req.url);
  const token =
    url.searchParams.get("key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expected =
    process.env.SETUP_SECRET ||
    process.env.CRON_SECRET ||
    authSecret();
  return Boolean(expected && token && token === expected);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await ensureDatabase();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
