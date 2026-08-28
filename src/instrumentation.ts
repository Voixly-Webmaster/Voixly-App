export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL?.startsWith("mysql")) return;

  try {
    const { execSync } = await import("node:child_process");
    const { existsSync } = await import("node:fs");
    const schema = "prisma/schema.mysql.prisma";
    if (!existsSync(schema)) return;
    execSync(`npx prisma db push --schema ${schema}`, {
      stdio: "inherit",
      env: process.env,
    });
  } catch (err) {
    console.warn(
      "[startup] prisma db push skipped:",
      err instanceof Error ? err.message : err
    );
  }
}
