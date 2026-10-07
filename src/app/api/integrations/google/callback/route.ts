import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { decodeOAuthState } from "@/lib/google/config";
import { exchangeCodeForTokens } from "@/lib/google/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(
      new URL("/admin/clients?error=google_denied", req.url)
    );
  }

  const decoded = decodeOAuthState(state);
  if (!decoded) {
    return NextResponse.redirect(
      new URL("/admin/clients?error=google_state", req.url)
    );
  }

  const { clientId, userId } = decoded;

  try {
    const user = await requireAdmin();
    if (user.id !== userId) {
      return NextResponse.redirect(
        new URL("/admin/clients?error=google_state", req.url)
      );
    }
    await assertClientAccess(user, clientId);

    const { tokens, googleEmail } = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      // Update existing integration if reconnecting without new refresh token
      const existing = await prisma.clientGoogleIntegration.findUnique({
        where: { clientId },
      });
      if (!existing) {
        return NextResponse.redirect(
          new URL(
            `/admin/clients/${clientId}/insights?error=no_refresh_token`,
            req.url
          )
        );
      }
    }

    await prisma.clientGoogleIntegration.upsert({
      where: { clientId },
      create: {
        clientId,
        refreshToken: tokens.refresh_token!,
        accessToken: tokens.access_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail,
        connectedById: user.id,
      },
      update: {
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        accessToken: tokens.access_token ?? null,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail,
        connectedById: user.id,
      },
    });

    await logActivity({
      actorId: user.id,
      clientId,
      action: "insights.google_connected",
      entityType: "client",
      entityId: clientId,
      metadata: { googleEmail },
    });

    return NextResponse.redirect(
      new URL(`/admin/clients/${clientId}/insights?connected=1`, req.url)
    );
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(
      new URL(
        `/admin/clients/${clientId}/insights?error=google_callback`,
        req.url
      )
    );
  }
}
