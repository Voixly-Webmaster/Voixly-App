"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { revokeSignInMaterial } from "@/lib/auth-codes";
import { sendClientWelcome } from "@/lib/email";

const USERS_PATH = "/admin/settings/users";

function parseRole(value: unknown): UserRole {
  if (value === "ADMIN" || value === "STAFF" || value === "CLIENT") return value;
  throw new Error("Invalid role");
}

export async function createUser(formData: FormData) {
  const admin = await requireAdminRole();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = parseRole(formData.get("role"));
  const companyName = String(formData.get("companyName") ?? "").trim();

  if (!email || !email.includes("@")) throw new Error("Valid email is required");
  if (!name) throw new Error("Name is required");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  if (role === UserRole.CLIENT && !companyName) {
    throw new Error("Company name is required for client accounts");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("A user with that email already exists");

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash,
      ...(role === UserRole.CLIENT
        ? { clientProfile: { create: { companyName, contactName: name } } }
        : {}),
      ...(role === UserRole.STAFF || role === UserRole.ADMIN
        ? { staffProfile: { create: {} } }
        : {}),
    },
  });

  await logActivity({
    actorId: admin.id,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    metadata: { email, role },
  });

  const welcomeSent =
    role === UserRole.CLIENT
      ? await sendClientWelcome({
          email,
          name,
          companyName,
        })
      : false;

  revalidatePath(USERS_PATH);
  return { welcomeSent, role };
}

async function assertNotLastAdmin(userId: string) {
  const remaining = await prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      deletedAt: null,
      id: { not: userId },
    },
  });
  if (remaining === 0) {
    throw new Error("Keep at least one active admin");
  }
}

export async function updateUserRole(userId: string, formData: FormData) {
  const admin = await requireAdminRole();
  const role = parseRole(formData.get("role"));

  if (userId === admin.id) throw new Error("You cannot change your own role");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { clientProfile: true, staffProfile: true },
  });
  if (!user) throw new Error("User not found");
  if (user.role === role) return;

  // Client accounts are tied to client records; converting them would orphan data
  if (user.role === UserRole.CLIENT || role === UserRole.CLIENT) {
    throw new Error(
      "Client accounts cannot be converted. Create a separate staff/admin account instead."
    );
  }

  if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN && !user.deletedAt) {
    await assertNotLastAdmin(userId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      ...(user.staffProfile ? {} : { staffProfile: { create: {} } }),
    },
  });

  await logActivity({
    actorId: admin.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    metadata: { from: user.role, to: role },
  });

  revalidatePath(USERS_PATH);
}

export async function resetUserPassword(userId: string, formData: FormData) {
  const admin = await requireAdminRole();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: new Date() },
  });
  await revokeSignInMaterial(userId);

  await logActivity({
    actorId: admin.id,
    action: "user.password_reset",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(USERS_PATH);
}

export async function setUserActive(userId: string, active: boolean) {
  const admin = await requireAdminRole();

  if (userId === admin.id) throw new Error("You cannot deactivate your own account");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (!active && user.role === UserRole.ADMIN && !user.deletedAt) {
    await assertNotLastAdmin(userId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: active ? null : new Date() },
  });

  await logActivity({
    actorId: admin.id,
    action: active ? "user.reactivated" : "user.deactivated",
    entityType: "user",
    entityId: userId,
    metadata: { email: user.email },
  });

  revalidatePath(USERS_PATH);
}
