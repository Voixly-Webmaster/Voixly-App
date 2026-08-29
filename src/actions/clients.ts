"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { UserRole } from "@prisma/client";

export async function createClient(formData: FormData) {
  const user = await requireAdmin();
  if (user.role !== UserRole.ADMIN) throw new Error("Unauthorized");

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const password = formData.get("password") as string;
  const companyName = (formData.get("companyName") as string)?.trim();
  const contactName = (formData.get("contactName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!email || !password || !companyName) {
    throw new Error("Email, password, and company name required");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const clientUser = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: contactName ?? companyName,
      role: UserRole.CLIENT,
      clientProfile: {
        create: { companyName, contactName, phone },
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

  revalidatePath("/admin/clients");
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
  const contactName = (formData.get("contactName") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  await prisma.client.update({
    where: { id: clientId },
    data: { companyName, contactName, phone, address },
  });

  await logActivity({
    actorId: user.id,
    clientId,
    action: "client.updated",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath(`/admin/clients/${clientId}`);
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
