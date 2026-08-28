export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { resolveDatabaseUrl } = await import("@/lib/database-url");
  const url = resolveDatabaseUrl();
  if (url) process.env.DATABASE_URL = url;

  try {
    const { ensureDatabase } = await import("@/lib/ensure-db");
    const result = await ensureDatabase();
    console.log("[startup] database", result);
  } catch (err) {
    console.warn(
      "[startup] database ensure skipped:",
      err instanceof Error ? err.message : err
    );
  }
}
