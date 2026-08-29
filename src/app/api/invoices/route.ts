import { NextResponse } from "next/server";
import { createInvoice } from "@/actions/invoices";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await createInvoice(await req.formData());
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const message =
      err instanceof Error ? err.message : "Could not create invoice";
    const status = message === "Unauthorized" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
