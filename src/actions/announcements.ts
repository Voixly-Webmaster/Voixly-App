"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";

export async function createAnnouncement(formData: FormData) {
  await requireAdmin();

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
}
