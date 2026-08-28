import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * First-deploy bootstrap: create one admin if the database is empty.
 * Requires BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD.
 */
export async function ensureBootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;

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
