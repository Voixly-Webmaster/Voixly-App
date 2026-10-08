import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  bootstrapAdminCredentials,
  ensureFirstAdmin,
} from "@/lib/bootstrap-admin";
import { dummyPasswordCheck, normalizeEmail } from "@/lib/passwords";

const userInclude = {
  clientProfile: true,
  staffProfile: true,
} as const;

export async function verifyPassword(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (!email || !password) return null;

  try {
    let user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: userInclude,
    });

    if (!user?.passwordHash) {
      const expected = bootstrapAdminCredentials();
      if (email === expected.email && password === expected.password) {
        user = await ensureFirstAdmin();
        if (user) {
          user = await prisma.user.findFirst({
            where: { id: user.id, deletedAt: null },
            include: userInclude,
          });
        }
      }
      if (!user?.passwordHash) {
        await dummyPasswordCheck(password);
        return null;
      }
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    return user;
  } catch (err) {
    console.error("[auth] database error during login", err);
    throw err;
  }
}
