function strip(value: string | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function needsEncoding(password: string): boolean {
  if (/%[0-9A-Fa-f]{2}/.test(password)) return false;
  return /[@#/?&+ %:]/.test(password);
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const user = strip(env.MYSQL_USER);
  const password = strip(env.MYSQL_PASSWORD);
  const database = strip(env.MYSQL_DATABASE);
  const host = strip(env.MYSQL_HOST) || "127.0.0.1";
  const port = strip(env.MYSQL_PORT) || "3306";

  if (user && password && database) {
    return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  let url = strip(env.DATABASE_URL);
  if (!url) return undefined;
  if (!url.startsWith("mysql://") && !url.startsWith("mysqls://")) return url;

  const match = url.match(
    /^(mysqls?:\/\/)([^:/]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)(\?.*)?$/
  );
  if (!match) return url;

  const [, proto, urlUser, urlPassword, urlHost, urlPort, urlDb, query = ""] =
    match;
  const hostFixed = urlHost === "localhost" ? "127.0.0.1" : urlHost;
  const pass = needsEncoding(urlPassword)
    ? encodeURIComponent(urlPassword)
    : urlPassword;
  return `${proto}${urlUser}:${pass}@${hostFixed}${urlPort ? `:${urlPort}` : ""}/${urlDb}${query}`;
}

export function authSecret(): string | undefined {
  return (
    strip(process.env.AUTH_SECRET) ||
    strip(process.env.NEXTAUTH_SECRET) ||
    undefined
  );
}
