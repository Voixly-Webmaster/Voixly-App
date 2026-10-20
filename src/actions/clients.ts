"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { normalizePhone, phonesMatch } from "@/lib/phone";
import { logoKind, MAX_LOGO_BYTES, storedFilePath } from "@/lib/uploads";
import { ClientTier, UserRole } from "@prisma/client";

function parseClientTier(value: unknown): ClientTier | null {
  if (
    value === "PLATINUM" ||
    value === "GOLD" ||
    value === "SILVER" ||
    value === "BRONZE"
  ) {
    return value;
  }
  return null;
}

async function phoneUsedElsewhere(phone: string, clientId: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const [clients, teammates] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, id: { not: clientId }, NOT: { phone: null } },
      select: { phone: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, role: { in: [UserRole.ADMIN, UserRole.STAFF] } },
      select: { twoFactorPhone: true, staffProfile: { select: { phone: true } } },
    }),
  ]);
  return (
    clients.some((row) => phonesMatch(row.phone, normalized)) ||
    teammates.some(
      (row) => phonesMatch(row.staffProfile?.phone, normalized) || phonesMatch(row.twoFactorPhone, normalized)
    )
  );
}

export async function addClientNote(clientId: string, formData: FormData) {
  const user = await requireAdmin();
  await assertClientAccess(user, clientId);
  const body = (formData.get("body") as string)?.trim();
  if (!body) throw new Error("Note required");

  await prisma.clientNote.create({
    data: { clientId, authorId: user.id, body },
  });

  revalidatePath(`/admin/clients/${clientId}`);
}

export async function updateClientProfile(
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireAdmin();
    const clientId = String(formData.get("clientId") ?? "").trim();
    if (!clientId) return { error: "Choose a customer" };
    await assertClientAccess(user, clientId);

    const companyName = String(formData.get("companyName") ?? "").trim();
    if (!companyName) return { error: "Company name is required" };
    const contactName = String(formData.get("contactName") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const address = String(formData.get("address") ?? "").trim() || null;
    const tier = parseClientTier(formData.get("tier"));
    if (phone && (await phoneUsedElsewhere(phone, clientId))) {
      return { error: "That number is already used on another account" };
    }

    await prisma.client.update({
      where: { id: clientId },
      data: { companyName, contactName, phone, address, tier },
    });

    await logActivity({
      actorId: user.id,
      clientId,
      action: "client.updated",
      entityType: "client",
      entityId: clientId,
    });

    revalidatePath(`/admin/clients/${clientId}`);
    revalidatePath("/admin/clients");
    revalidatePath("/portal/profile");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { error: "You cannot update this customer" };
    }
    console.error("[clients] profile update failed", err);
    return { error: "Could not save the profile" };
  }
}

function refreshLogo(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/portal/profile");
  revalidatePath("/portal", "layout");
}

async function removeLogoFile(fileName: string | null | undefined) {
  if (!fileName) return;
  try {
    await unlink(storedFilePath(fileName));
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    if (code !== "ENOENT") console.error("[clients] logo cleanup failed", err);
  }
}

export async function setClientLogo(
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireAdmin();
    const clientId = String(formData.get("clientId") ?? "").trim();
    if (!clientId) return { error: "Choose a customer" };
    await assertClientAccess(user, clientId);

    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image" };
    if (file.size > MAX_LOGO_BYTES) return { error: "Use an image under 2 MB" };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = logoKind(bytes);
    if (!kind) return { error: "Use a PNG, JPG, WEBP, or GIF" };

    const current = await prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { logoFileName: true },
    });
    if (!current) return { error: "That customer was not found" };

    const ext = kind === "jpeg" ? "jpg" : kind;
    const fileName = `logo-${randomUUID()}.${ext}`;

    await prisma.$transaction([
      prisma.clientLogo.upsert({
        where: { clientId },
        create: { clientId, data: Buffer.from(bytes) },
        update: { data: Buffer.from(bytes) },
      }),
      prisma.client.update({
        where: { id: clientId },
        data: { logoFileName: fileName },
      }),
    ]);
    await removeLogoFile(current.logoFileName);

    try {
      await logActivity({
        actorId: user.id,
        clientId,
        action: "client.logo_updated",
        entityType: "client",
        entityId: clientId,
      });
    } catch (err) {
      console.error("[clients] activity log failed", err);
    }

    refreshLogo(clientId);
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { error: "You cannot update this customer's logo" };
    }
    console.error("[clients] logo upload failed", err);
    return { error: "Could not save the logo" };
  }
}

export async function removeClientLogo(
  clientId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireAdmin();
    if (!clientId) return { error: "Choose a customer" };
    await assertClientAccess(user, clientId);
    const current = await prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      select: { logoFileName: true },
    });
    if (!current) return { error: "That customer was not found" };
    if (!current.logoFileName) return { ok: true };

    await prisma.$transaction([
      prisma.clientLogo.deleteMany({ where: { clientId } }),
      prisma.client.update({
        where: { id: clientId },
        data: { logoFileName: null },
      }),
    ]);
    await removeLogoFile(current.logoFileName);

    try {
      await logActivity({
        actorId: user.id,
        clientId,
        action: "client.logo_updated",
        entityType: "client",
        entityId: clientId,
        metadata: { removed: true },
      });
    } catch (err) {
      console.error("[clients] activity log failed", err);
    }

    refreshLogo(clientId);
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "Unauthorized") {
      return { error: "You cannot update this customer's logo" };
    }
    console.error("[clients] logo remove failed", err);
    return { error: "Could not remove the logo" };
  }
}

export async function updateOwnProfile(
  formData: FormData
): Promise<{ ok: true } | { error: string }> {
  const { requireClient } = await import("@/lib/session-guard");
  const session = await requireClient();
  const clientId = session.clientId!;

  const contactName = (formData.get("contactName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  if (phone && (await phoneUsedElsewhere(phone, clientId))) {
    return { error: "That number is already used on another account" };
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { contactName, phone, address },
  });

  if (contactName) {
    await prisma.user.update({
      where: { id: session.id },
      data: { name: contactName },
    });
  }

  revalidatePath("/portal/profile");
  return { ok: true };
}

export async function assignStaffToClient(formData: FormData) {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
  const staffId = String(formData.get("staffId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!staffId || !clientId) throw new Error("Staff and client are required");

  await prisma.staffClientAssignment.upsert({
    where: { staffId_clientId: { staffId, clientId } },
    create: { staffId, clientId },
    update: {},
  });
  revalidatePath(`/admin/clients/${clientId}`);
}

export async function unassignStaffFromClient(formData: FormData) {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");
  const staffId = String(formData.get("staffId") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (!staffId || !clientId) throw new Error("Staff and client are required");

  await prisma.staffClientAssignment.deleteMany({
    where: { staffId, clientId },
  });
  revalidatePath(`/admin/clients/${clientId}`);
}
