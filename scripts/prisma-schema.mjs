/** Pick SQLite locally, MySQL when DATABASE_URL is MySQL or MYSQL_* is set. */
export function isMysql() {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("mysql://") || url.startsWith("mysqls://")) return true;
  return Boolean(
    process.env.MYSQL_USER &&
      process.env.MYSQL_PASSWORD &&
      process.env.MYSQL_DATABASE
  );
}

export function prismaSchemaPath() {
  return isMysql() ? "prisma/schema.mysql.prisma" : "prisma/schema.prisma";
}
