/** Pick SQLite locally, MySQL when DATABASE_URL is a MySQL connection. */
export function prismaSchemaPath() {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("mysql://") || url.startsWith("mysqls://")
    ? "prisma/schema.mysql.prisma"
    : "prisma/schema.prisma";
}

export function isMysql() {
  const url = process.env.DATABASE_URL ?? "";
  return url.startsWith("mysql://") || url.startsWith("mysqls://");
}
