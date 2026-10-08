"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { sendClientWelcome } from "@/lib/email";
import { logoKind, MAX_LOGO_BYTES, storedFilePath, UPLOAD_DIR } from "@/lib/uploads";
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

export async function createClient(
  formData: FormData
): Promise<{ welcomeSent: boolean } | { error: string }> {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const companyName = (formData.get("companyName") as string)?.trim();
  const contactName = (formData.get("contactName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const tier = parseClientTier(formData.get("tier"));

  if (!email || !password || !companyName) {
    return { error: "Email, password, and company name are required" };
  }
  if (!email.includes("@")) return { error: "Enter a valid email" };
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists" };

  const passwordHash = await bcrypt.hash(password, 12);

  const clientUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: contactName ?? companyName,
      role: UserRole.CLIENT,
      clientProfile: {
        create: { companyName, contactName, phone, tier },
      },
    },
    include: { clientProfile: true },
  });

  await logActivity({
    actorId: user.id,
    clientId: clientUser.clientProfile?.id,
    action: "client.created",
    entityType: "client",
    entityId: clientUser.clientProfile?.id,
  });

  const welcomeSent = await sendClientWelcome({
    email,
    name: contactName,
    companyName,
  });

  revalidatePath("/admin/clients");
  return { welcomeSent };
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

export async function updateClientProfile(formData: FormData) {
  const user = await requireAdmin();
  const clientId = formData.get("clientId") as string;
  if (!clientId) throw new Error("clientId required");
  await assertClientAccess(user, clientId);

  const companyName = (formData.get("companyName") as string)?.trim();
  if (!companyName) throw new Error("Company name is required");
  const contactName = (formData.get("contactName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const tier = parseClientTier(formData.get("tier"));

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
    const dir = path.join(process.cwd(), UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(storedFilePath(fileName), bytes);

    await prisma.client.update({
      where: { id: clientId },
      data: { logoFileName: fileName },
    });
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

    await prisma.client.update({
      where: { id: clientId },
      data: { logoFileName: null },
    });
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

export async function updateOwnProfile(formData: FormData) {
  const { requireClient } = await import("@/lib/session-guard");
  const session = await requireClient();

  const contactName = (formData.get("contactName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  await prisma.client.update({
    where: { id: session.clientId! },
    data: { contactName, phone, address },
  });

  if (contactName) {
    await prisma.user.update({
      where: { id: session.id },
      data: { name: contactName },
    });
  }

  revalidatePath("/portal/profile");
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
