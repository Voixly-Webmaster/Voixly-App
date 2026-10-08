"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { sendClientWelcome } from "@/lib/email";
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
