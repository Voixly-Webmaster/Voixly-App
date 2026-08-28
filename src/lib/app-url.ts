/** Public site URL — Settings override, then env, then localhost. */
export async function getAppUrl(): Promise<string> {
  const { getSetting } = await import("@/lib/settings");
  const raw =
    (await getSetting("app.url")) ??
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3010";
  return raw.replace(/\/$/, "");
}
