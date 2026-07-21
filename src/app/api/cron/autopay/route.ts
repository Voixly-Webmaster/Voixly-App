import { NextResponse } from "next/server";
import { runMonthlyAutopaySweep } from "@/lib/autopay";

/**
 * Monthly Autopay sweep — charge open invoices for clients whose
 * autopayDay matches today.
 *
 * Protect with CRON_SECRET:
 *   Authorization: Bearer <CRON_SECRET>
 *   or ?secret=<CRON_SECRET>
 *
 * Schedule daily (e.g. cron-job.org / Vercel cron) — clients only charge
 * on their chosen day of the month.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers.get("authorization");
    const url = new URL(req.url);
    const ok =
      auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await runMonthlyAutopaySweep();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
