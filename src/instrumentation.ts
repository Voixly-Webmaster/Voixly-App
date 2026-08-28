export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resolveDatabaseUrl } = await import("@/lib/database-url");
  const url = resolveDatabaseUrl();
  if (url) process.env.DATABASE_URL = url;
}
