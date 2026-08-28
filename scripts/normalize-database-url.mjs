/**
 * Hostinger env values often include an unencoded MySQL password
 * (`@`, `#`, `/`, `%`, spaces). Prisma then reports P1000 (bad auth).
 * Rebuild DATABASE_URL with the password percent-encoded.
 */
export function normalizeDatabaseUrl(raw) {
  if (!raw) return raw;
  let url = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!url.startsWith("mysql://") && !url.startsWith("mysqls://")) return url;

  const match = url.match(/^(mysqls?:\/\/)([^:/]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)(\?.*)?$/);
  if (!match) return url;

  const [, proto, user, password, host, port, database, query = ""] = match;
  let decoded = password;
  try {
    decoded = decodeURIComponent(password.replace(/\+/g, "%20"));
  } catch {
    decoded = password;
  }
  const encoded = encodeURIComponent(decoded);
  return `${proto}${encodeURIComponent(user)}:${encoded}@${host}${port ? `:${port}` : ""}/${database}${query}`;
}

export function applyNormalizedDatabaseUrl() {
  const next = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (next && next !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = next;
    console.log("[build] DATABASE_URL password was re-encoded for Prisma");
  }
  return process.env.DATABASE_URL;
}
