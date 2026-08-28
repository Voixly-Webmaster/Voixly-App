import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * First-deploy bootstrap: create one admin if the database is empty.
 * Defaults to admin@voixly.com / password123 unless BOOTSTRAP_ADMIN_* is set.
 */
export async function ensureBootstrapAdmin() {
  const email = (
    process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@voixly.com"
  ).toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "password123";

  if (password.length < 8) {
    console.warn("[bootstrap] BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters — skipped");
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
