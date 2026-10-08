"use server";

import { unlink } from "fs/promises";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { revokeSignInMaterial } from "@/lib/auth-codes";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { storedFilePath } from "@/lib/uploads";
import { sendTeamSetupInvite } from "@/actions/invites";

const USERS_PATH = "/admin/settings/users";

function parseRole(value: unknown): UserRole | null {
  if (value === "ADMIN" || value === "STAFF" || value === "CLIENT") return value;
  return null;
}

function databaseCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null || !("code" in err)) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && /^P\d+$/.test(code) ? code : null;
}

export async function createUser(
  formData: FormData
): Promise<
  | { invited: false; role: UserRole }
  | { invited: true; emailSent: boolean; role: UserRole }
  | { error: string }
> {
  try {
    const admin = await requireAdminRole();

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const role = parseRole(formData.get("role"));
    const invite = formData.get("invite") === "on";

    if (!role) return { error: "Choose a role" };
    if (role === UserRole.CLIENT) {
      return { error: "Add customers from Clients → Invite a customer." };
    }
    if (!email || !email.includes("@")) return { error: "Enter a valid email" };
    if (!name) return { error: "Name is required" };
    if (!invite && password.length < 8) return { error: "Password must be at least 8 characters" };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "A user with that email already exists" };

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        ...(invite ? {} : { passwordHash: await bcrypt.hash(password, 12) }),
        staffProfile: { create: {} },
      },
    });

    const emailSent = invite
      ? await sendTeamSetupInvite({ userId: user.id, email, name, role })
      : false;

    try {
      await logActivity({
        actorId: admin.id,
        action: invite ? "user.invited" : "user.created",
        entityType: "user",
        entityId: user.id,
        metadata: { email, role, ...(invite ? { emailSent } : {}) },
      });
    } catch (err) {
      console.error("[users] activity log failed", err);
    }

    revalidatePath(USERS_PATH);
    return invite ? { invited: true, emailSent, role } : { invited: false, role };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[users] create failed", err);
    if (databaseCode(err) === "P2002") {
      return { error: "A user with that email already exists" };
    }
    const code = databaseCode(err);
    return {
      error: code
        ? `Could not create the user (${code}).`
        : "Could not create the user. Try again.",
    };
  }
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
  if (!role) throw new Error("Invalid role");

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

function stripeResourceMissing(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  const status = "statusCode" in err ? (err as { statusCode?: unknown }).statusCode : undefined;
  return code === "resource_missing" || status === 404;
}

/** Stop Stripe billing before the local client row is removed. */
async function cancelClientBilling(
  clientId: string,
  stripeCustomerId: string | null
): Promise<string | null> {
  const recurring = await prisma.recurringInvoice.findMany({
    where: { clientId, stripeSubscriptionId: { not: null } },
    select: { stripeSubscriptionId: true },
  });
  const subscriptionIds = recurring
    .map((row) => row.stripeSubscriptionId)
    .filter((id): id is string => Boolean(id));

  if (!stripeCustomerId && subscriptionIds.length === 0) return null;
  if (!(await isStripeConfigured())) {
    return "Stripe is not configured, so this client's billing could not be cancelled.";
  }

  const stripe = await getStripe();
  for (const subscriptionId of subscriptionIds) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (err) {
      if (stripeResourceMissing(err)) continue;
      console.error("[users] cancel subscription failed", err);
      return "Could not cancel this client's Stripe subscription.";
    }
  }

  if (stripeCustomerId) {
    try {
      await stripe.customers.del(stripeCustomerId);
    } catch (err) {
      if (stripeResourceMissing(err)) return null;
      console.error("[users] delete Stripe customer failed", err);
      return "Could not remove this client's Stripe customer.";
    }
  }

  return null;
}

async function removeStoredFiles(fileNames: string[]) {
  for (const fileName of fileNames) {
    try {
      await unlink(storedFilePath(fileName));
    } catch (err) {
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code !== "ENOENT") console.error("[users] file cleanup failed", err);
    }
  }
}

export async function deleteUser(
  userId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const admin = await requireAdminRole();
    if (userId === admin.id) return { error: "You cannot delete your own account" };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: {
          select: { id: true, companyName: true, stripeCustomerId: true, logoFileName: true },
        },
      },
    });
    if (!user) return { error: "User not found" };

    if (user.role === UserRole.ADMIN && !user.deletedAt) {
      const remaining = await prisma.user.count({
        where: { role: UserRole.ADMIN, deletedAt: null, id: { not: userId } },
      });
      if (remaining === 0) return { error: "Keep at least one active admin" };
    }

    const client = user.clientProfile;
    if (client) {
      const billingError = await cancelClientBilling(client.id, client.stripeCustomerId);
      if (billingError) return { error: billingError };
    }

    const clientFiles = client
      ? await prisma.fileUpload.findMany({
          where: { clientId: client.id },
          select: { fileName: true },
        })
      : [];

    await prisma.$transaction(
      async (tx) => {
        if (client) {
          await tx.taskComment.deleteMany({ where: { task: { clientId: client.id } } });
          await tx.task.deleteMany({ where: { clientId: client.id } });
          await tx.ticketMessage.deleteMany({ where: { ticket: { clientId: client.id } } });
          await tx.supportTicket.deleteMany({ where: { clientId: client.id } });
          await tx.clientNote.deleteMany({ where: { clientId: client.id } });
          await tx.fileUpload.deleteMany({ where: { clientId: client.id } });
        }

        // These columns are required, so leftover rows are kept under the admin
        // who deleted the account instead of blocking the delete.
        await tx.task.updateMany({
          where: { createdById: userId },
          data: { createdById: admin.id },
        });
        await tx.taskComment.updateMany({
          where: { authorId: userId },
          data: { authorId: admin.id },
        });
        await tx.ticketMessage.updateMany({
          where: { authorId: userId },
          data: { authorId: admin.id },
        });
        await tx.clientNote.updateMany({
          where: { authorId: userId },
          data: { authorId: admin.id },
        });
        await tx.fileUpload.updateMany({
          where: { uploadedById: userId },
          data: { uploadedById: admin.id },
        });

        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 20_000 }
    );

    await removeStoredFiles([
      ...clientFiles.map((file) => file.fileName),
      ...(client?.logoFileName ? [client.logoFileName] : []),
    ]);

    try {
      await logActivity({
        actorId: admin.id,
        action: "user.deleted",
        entityType: "user",
        entityId: userId,
        metadata: {
          email: user.email,
          role: user.role,
          ...(client ? { companyName: client.companyName } : {}),
        },
      });
    } catch (err) {
      console.error("[users] activity log failed", err);
    }

    revalidatePath(USERS_PATH);
    revalidatePath("/admin/clients");
    revalidatePath("/admin/invoices");
    revalidatePath("/admin/tickets");
    revalidatePath("/admin/files");
    revalidatePath("/admin/tasks");
    revalidatePath("/admin/activity");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[users] delete failed", err);
    const code = databaseCode(err);
    return {
      error: code
        ? `Could not delete the user (${code}).`
        : "Could not delete the user. Try again.",
    };
  }
}
