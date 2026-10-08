"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { broadcastToClients } from "@/lib/outreach";
import { renderEmail, renderSms } from "@/lib/message-templates";
import type { BroadcastResult } from "@/lib/delivery-summary";

function revalidateAnnouncements() {
  revalidatePath("/admin/announcements");
  revalidatePath("/portal/announcements");
  revalidatePath("/portal");
}

async function notifyAnnouncement(announcement: { id: string; title: string; body: string }) {
  const { getAppUrl } = await import("@/lib/app-url");
  const url = `${await getAppUrl()}/portal/announcements`;
  const excerpt = announcement.body.replace(/\s+/g, " ").trim();
  const short = excerpt.length > 140 ? `${excerpt.slice(0, 137)}…` : excerpt;
  const vars = { title: announcement.title, body: announcement.body, excerpt: short, url };
  const email = await renderEmail("announcement", vars);
  return broadcastToClients({
    subject: email.subject,
    html: email.html,
    sms: await renderSms("announcement", vars),
  });
}

export async function createAnnouncement(formData: FormData): Promise<{
  delivery: BroadcastResult | null;
}> {
  const admin = await requireAdminRole();

  const title = (formData.get("title") as string)?.trim();
  const body = (formData.get("body") as string)?.trim();
  const publish = formData.get("publish") === "on";

  if (!title || !body) throw new Error("Title and body required");

  const announcement = await prisma.announcement.create({
    data: {
      title,
      body,
      published: publish,
      publishAt: publish ? new Date() : null,
    },
  });

  const delivery = publish ? await notifyAnnouncement(announcement) : null;

  await logActivity({
    actorId: admin.id,
    action: publish ? "announcement.published" : "announcement.created",
    entityType: "announcement",
    entityId: announcement.id,
    metadata: delivery
      ? { emailed: delivery.emailed, texted: delivery.texted }
      : undefined,
  });
  revalidateAnnouncements();
  return { delivery };
}

export async function setAnnouncementPublished(
  formData: FormData
): Promise<BroadcastResult | null> {
  const admin = await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  const published = formData.get("published") === "true";
  if (!id) throw new Error("Announcement is required");

  const current = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
  });
  if (!current) throw new Error("Announcement not found");

  await prisma.announcement.update({
    where: { id },
    data: {
      published,
      publishAt: published ? new Date() : null,
    },
  });

  let delivery: BroadcastResult | null = null;
  if (published && !current.published) {
    delivery = await notifyAnnouncement(current);
  }

  await logActivity({
    actorId: admin.id,
    action: published ? "announcement.published" : "announcement.unpublished",
    entityType: "announcement",
    entityId: id,
    metadata: delivery
      ? { emailed: delivery.emailed, texted: delivery.texted }
      : undefined,
  });

  revalidateAnnouncements();
  return delivery;
}

export async function deleteAnnouncement(formData: FormData) {
  const admin = await requireAdminRole();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Announcement is required");

  await prisma.announcement.update({
    where: { id },
    data: { published: false, deletedAt: new Date() },
  });

  await logActivity({
    actorId: admin.id,
    action: "announcement.removed",
    entityType: "announcement",
    entityId: id,
  });

  revalidateAnnouncements();
}
