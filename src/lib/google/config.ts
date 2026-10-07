import { createHmac, timingSafeEqual } from "crypto";
import { authSecret } from "@/lib/database-url";

/** Google OAuth scopes for Analytics + Search Console read access */
export const GOOGLE_INSIGHTS_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "openid",
  "email",
];

export async function googleRedirectUri(): Promise<string> {
  const { getSetting } = await import("@/lib/settings");
  const base =
    (await getSetting("app.url")) ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3031";
  return `${base.replace(/\/$/, "")}/api/integrations/google/callback`;
}

export async function getGoogleOAuthCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
  const { getSettings } = await import("@/lib/settings");
  const settings = await getSettings(["google.clientId", "google.clientSecret"]);
  const clientId = settings["google.clientId"];
  const clientSecret = settings["google.clientSecret"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function isGoogleInsightsConfigured(): Promise<boolean> {
  return Boolean(await getGoogleOAuthCredentials());
}

export function encodeOAuthState(clientId: string, userId: string): string {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is required");
  const body = Buffer.from(
    JSON.stringify({ clientId, userId, ts: Date.now() })
  ).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function decodeOAuthState(
  state: string
): { clientId: string; userId: string } | null {
  try {
    const secret = authSecret();
    if (!secret) return null;
    const dot = state.lastIndexOf(".");
    if (dot <= 0) return null;
    const body = state.slice(0, dot);
    const mac = state.slice(dot + 1);
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    const macBuf = Buffer.from(mac);
    const expectedBuf = Buffer.from(expected);
    if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) {
      return null;
    }

    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      clientId?: string;
      userId?: string;
      ts?: number;
    };
    if (!parsed.clientId || !parsed.userId) return null;
    if (!parsed.ts || Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return { clientId: parsed.clientId, userId: parsed.userId };
  } catch {
    return null;
  }
}
