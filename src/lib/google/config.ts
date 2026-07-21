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
    "http://localhost:3010";
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

export function encodeOAuthState(clientId: string): string {
  return Buffer.from(JSON.stringify({ clientId, ts: Date.now() })).toString(
    "base64url"
  );
}

export function decodeOAuthState(state: string): { clientId: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as { clientId?: string; ts?: number };
    if (!parsed.clientId) return null;
    // Reject states older than 15 minutes
    if (parsed.ts && Date.now() - parsed.ts > 15 * 60 * 1000) return null;
    return { clientId: parsed.clientId };
  } catch {
    return null;
  }
}
