function strip(value: string | undefined): string {
  return value?.trim().replace(/^['"]|['"]$/g, "") ?? "";
}

function needsEncoding(password: string): boolean {
  if (/%[0-9A-Fa-f]{2}/.test(password)) return false;
  return /[@#/?&+ %:]/.test(password);
}

/** Hostinger PHP/Prisma must use the Unix socket — TCP 127.0.0.1 is rejected. */
const HOSTINGER_SOCKET = "/var/lib/mysql/mysql.sock";

function withSocket(url: string, env: NodeJS.ProcessEnv): string {
  if (url.includes("socket=")) return url;
  const socket = strip(env.MYSQL_SOCKET) || HOSTINGER_SOCKET;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}socket=${encodeURIComponent(socket)}`;
}

export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const user = strip(env.MYSQL_USER);
  const password = strip(env.MYSQL_PASSWORD);
  const database = strip(env.MYSQL_DATABASE);
  const host = strip(env.MYSQL_HOST) || "localhost";
  const port = strip(env.MYSQL_PORT) || "3306";

  if (user && password && database) {
    return withSocket(
      `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
      env
    );
  }

  const url = strip(env.DATABASE_URL);
  if (!url) return undefined;
  if (!url.startsWith("mysql://") && !url.startsWith("mysqls://")) return url;

  const match = url.match(
    /^(mysqls?:\/\/)([^:/]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)(\?.*)?$/
  );
  if (!match) return withSocket(url, env);

  const [, proto, urlUser, urlPassword, urlHost, urlPort, urlDb, query = ""] =
    match;
  const pass = needsEncoding(urlPassword)
    ? encodeURIComponent(urlPassword)
    : urlPassword;
  return withSocket(
    `${proto}${urlUser}:${pass}@${urlHost}${urlPort ? `:${urlPort}` : ""}/${urlDb}${query}`,
    env
  );
}

export function authSecret(): string | undefined {
  return (
    strip(process.env.AUTH_SECRET) ||
    strip(process.env.NEXTAUTH_SECRET) ||
    undefined
  );
}
