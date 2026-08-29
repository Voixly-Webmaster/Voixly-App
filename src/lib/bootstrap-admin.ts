import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function bootstrapAdminCredentials() {
  const envPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim() ?? "";
  return {
    email: (
      process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || "admin@voixly.com"
    ).toLowerCase(),
    password: envPassword || (isProduction() ? "" : "password123"),
    name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || "Admin",
  };
}

/** Create the first admin when the users table is empty. */
export async function ensureFirstAdmin() {
  const existing = await prisma.user.count();
  if (existing > 0) return null;

  const { email, password, name } = bootstrapAdminCredentials();
  if (!password || password.length < 8) return null;

  return prisma.user.create({
    data: {
      email,
      name,
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
      staffProfile: { create: { title: "Administrator" } },
    },
    include: {
      clientProfile: true,
      staffProfile: true,
    },
  });
}
