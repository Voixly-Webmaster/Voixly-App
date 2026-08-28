import { existsSync } from "node:fs";
import mysql from "mysql2/promise";
import {
  parseMysqlParts,
  mysqlUrlFromParts,
} from "./normalize-database-url.mjs";

const SOCKETS = [
  process.env.MYSQL_SOCKET,
  "/var/run/mysqld/mysqld.sock",
  "/var/lib/mysql/mysql.sock",
  "/tmp/mysql.sock",
  "/var/run/mysql/mysql.sock",
].filter(Boolean);

/**
 * Hostinger PHP uses a Unix socket (`user@localhost`).
 * Prisma uses TCP, so MySQL sees `user@127.0.0.1` and rejects a valid password.
 * Try socket first, then 127.0.0.1, then the hostname from hPanel.
 */
export async function findWorkingMysqlUrl() {
  const parts = parseMysqlParts();
  if (!parts) {
    console.error("[build] No MySQL credentials in MYSQL_* or DATABASE_URL");
    return null;
  }

  console.log(
    `[build] MySQL user=${parts.user} db=${parts.database} passwordLength=${parts.password.length} passwordHasDollar=${parts.password.includes("$")}`
  );

  const hosts = [
    ...new Set(
      [
        process.env.MYSQL_HOST,
        "127.0.0.1",
        "localhost",
        parts.host,
      ].filter(Boolean)
    ),
  ];

  const attempts = [];

  for (const socket of SOCKETS) {
    if (!existsSync(socket)) continue;
    attempts.push({
      label: `socket ${socket}`,
      url: mysqlUrlFromParts(
        { ...parts, host: "localhost" },
        `socket=${encodeURIComponent(socket)}`
      ),
      config: {
        user: parts.user,
        password: parts.password,
        database: parts.database,
        socketPath: socket,
      },
    });
  }

  for (const host of hosts) {
    attempts.push({
      label: `tcp ${host}:${parts.port}`,
      url: mysqlUrlFromParts({ ...parts, host }),
      config: {
        user: parts.user,
        password: parts.password,
        database: parts.database,
        host,
        port: parts.port,
      },
    });
  }

  for (const attempt of attempts) {
    try {
      const conn = await mysql.createConnection({
        ...attempt.config,
        connectTimeout: 8000,
      });
      await conn.query("SELECT 1");
      await conn.end();
      console.log(`[build] MySQL connected via ${attempt.label}`);
      return attempt.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[build] MySQL failed (${attempt.label}): ${message}`);
    }
  }

  console.error(`
[build] Could not authenticate to MySQL with the password we received.

This is usually NOT a typo on Hostinger Node apps:
  • PHP uses a Unix socket (user@localhost). Prisma uses TCP (user@127.0.0.1).
  • Node web apps often cannot use "localhost" — copy Hostname from
    hPanel → Databases (often srvXXXX.hstgr.io) into MYSQL_HOST.
  • If the password contains $, Hostinger may strip it. Reset to a password
    using only letters and numbers, then set MYSQL_PASSWORD.

Set in hPanel (no quotes):
  MYSQL_HOST      = hostname from Databases (not always localhost)
  MYSQL_USER      = u935498615_34982458_4645
  MYSQL_PASSWORD  = database user password
  MYSQL_DATABASE  = u935498615_34982458_4678
`);
  return null;
}
