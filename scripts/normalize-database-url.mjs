/**
 * Resolve DATABASE_URL for Prisma.
 *
 * Prefer separate Hostinger fields (raw password, no URL encoding needed):
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *
 * DATABASE_URL is still supported. We only encode a password if it contains
 * reserved characters and does not already look percent-encoded.
 */
function strip(value) {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function needsEncoding(password) {
  if (!password) return false;
  if (/%[0-9A-Fa-f]{2}/.test(password)) return false;
  return /[@#/?&+ %:]/.test(password);
}

function buildMysqlUrl({ user, password, host, port, database }) {
  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);
  return `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;
}

export function resolveDatabaseUrl(env = process.env) {
  const user = strip(env.MYSQL_USER);
  const password = strip(env.MYSQL_PASSWORD);
  const database = strip(env.MYSQL_DATABASE);
  const host = strip(env.MYSQL_HOST) || "localhost";
  const port = strip(env.MYSQL_PORT) || "3306";

  if (user && password && database) {
    return buildMysqlUrl({ user, password, host, port, database });
  }

  const raw = strip(env.DATABASE_URL);
  if (!raw) return raw;
  if (!raw.startsWith("mysql://") && !raw.startsWith("mysqls://")) return raw;

  const match = raw.match(
    /^(mysqls?:\/\/)([^:/]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)(\?.*)?$/
  );
  if (!match) return raw;

  const [, proto, urlUser, urlPassword, urlHost, urlPort, urlDb, query = ""] =
    match;
  const pass = needsEncoding(urlPassword)
    ? encodeURIComponent(urlPassword)
    : urlPassword;
  return `${proto}${urlUser}:${pass}@${urlHost}${urlPort ? `:${urlPort}` : ""}/${urlDb}${query}`;
}

export function applyNormalizedDatabaseUrl() {
  const next = resolveDatabaseUrl();
  if (!next) return next;

  const fromParts = Boolean(
    strip(process.env.MYSQL_USER) &&
      strip(process.env.MYSQL_PASSWORD) &&
      strip(process.env.MYSQL_DATABASE)
  );
  if (fromParts) {
    process.env.DATABASE_URL = next;
    console.log(
      `[build] DATABASE_URL built from MYSQL_* → ${strip(process.env.MYSQL_USER)}@${strip(process.env.MYSQL_HOST) || "localhost"}/${strip(process.env.MYSQL_DATABASE)}`
    );
  } else if (next !== process.env.DATABASE_URL) {
    process.env.DATABASE_URL = next;
    console.log("[build] DATABASE_URL password was encoded for Prisma");
  }
  return process.env.DATABASE_URL;
}
