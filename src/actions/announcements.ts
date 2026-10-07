"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";

export async function createAnnouncement(formData: FormData) {
  await requireAdminRole();

  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const publish = formData.get("publish") === "on";

  if (!title || !body) throw new Error("Title and body required");

  await prisma.announcement.create({
    data: {
      title,
      body,
      published: publish,
      publishAt: publish ? new Date() : null,
    },
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/portal/announcements");
  revalidatePath("/portal");
}

export async function setAnnouncementPublished(formData: FormData) {
  await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  const published = formData.get("published") === "true";
  if (!id) throw new Error("Announcement is required");

  await prisma.announcement.update({
    where: { id },
    data: {
      published,
      publishAt: published ? new Date() : null,
    },
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/portal/announcements");
  revalidatePath("/portal");
}

export async function deleteAnnouncement(formData: FormData) {
  await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Announcement is required");

  await prisma.announcement.update({
    where: { id },
    data: { published: false, deletedAt: new Date() },
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/portal/announcements");
  revalidatePath("/portal");
}
