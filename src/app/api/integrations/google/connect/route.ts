import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import {
  getGoogleAuthUrl,
} from "@/lib/google/client";
import { isGoogleInsightsConfigured } from "@/lib/google/config";

export async function GET(req: Request) {
  try {
    const user = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    await assertClientAccess(user, clientId);

    if (!(await isGoogleInsightsConfigured())) {
      return NextResponse.redirect(
        new URL(
          `/admin/clients/${clientId}/insights?error=not_configured`,
          req.url
        )
      );
    }

    const url = await getGoogleAuthUrl(clientId);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
