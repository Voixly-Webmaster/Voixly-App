import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * First-deploy bootstrap: create one admin if the database is empty.
 * Local/dev defaults to admin@voixly.com / password123.
 * Production requires BOOTSTRAP_ADMIN_PASSWORD (8+ chars).
 */
export async function ensureBootstrapAdmin() {
  const isProd = process.env.NODE_ENV === "production";
  const email = (
    process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@voixly.com"
  ).toLowerCase();
  const password =
    process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() || (isProd ? "" : "password123");

  if (!password || password.length < 8) {
    if (isProd) {
      console.warn(
        "[bootstrap] set BOOTSTRAP_ADMIN_PASSWORD (8+ chars) to create the first admin — skipped"
      );
    } else {
      console.warn("[bootstrap] BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters — skipped");
    }
    return;
  }

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      console.log("[bootstrap] users already exist — skipped");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin",
        role: "ADMIN",
        passwordHash,
        staffProfile: { create: { title: "Administrator" } },
      },
    });
    console.log(`[bootstrap] created admin ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}
