"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth, requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { sendEmail, ticketReplyEmailHtml } from "@/lib/email";
import { TicketStatus, UserRole } from "@prisma/client";

export async function createTicket(formData: FormData) {
  const user = await requireAuth();
  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;

  if (!subject?.trim() || !body?.trim()) throw new Error("Subject and message required");

  let clientId = user.clientId;
  if (user.role !== UserRole.CLIENT) {
    clientId = formData.get("clientId") as string;
  }
  if (!clientId) throw new Error("Client required");
  await assertClientAccess(user, clientId);

  const ticket = await prisma.supportTicket.create({
    data: {
      clientId,
      subject: subject.trim(),
      messages: {
        create: {
          authorId: user.id,
          body: body.trim(),
          isStaff: user.role !== UserRole.CLIENT,
        },
      },
    },
  });

  await logActivity({
    actorId: user.id,
    clientId,
    action: "ticket.created",
    entityType: "ticket",
    entityId: ticket.id,
  });

  revalidatePath("/portal/support");
  revalidatePath("/admin/tickets");
}

export async function replyToTicket(ticketId: string, formData: FormData) {
  const user = await requireAuth();
  const body = (formData.get("body") as string)?.trim();
  if (!body) throw new Error("Message required");

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
    include: { client: { include: { user: true } } },
  });
  if (!ticket) throw new Error("Ticket not found");

  if (user.role === UserRole.CLIENT && ticket.clientId !== user.clientId) {
    throw new Error("Unauthorized");
  }
  if (user.role !== UserRole.CLIENT) {
    await assertClientAccess(user, ticket.clientId);
  }

  const isStaff = user.role !== UserRole.CLIENT;

  await prisma.ticketMessage.create({
    data: {
      ticketId,
      authorId: user.id,
      body,
      isStaff,
    },
  });

  if (ticket.status === TicketStatus.RESOLVED) {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.OPEN },
    });
  } else if (isStaff && ticket.status === TicketStatus.OPEN) {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.WAITING },
    });
  } else if (!isStaff && ticket.status === TicketStatus.WAITING) {
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.OPEN },
    });
  }

  const { getAppUrl } = await import("@/lib/app-url");
  const appUrl = await getAppUrl();
  const ticketUrl = isStaff
    ? `${appUrl}/portal/support/${ticketId}`
    : `${appUrl}/admin/tickets/${ticketId}`;

  const notifyEmail = isStaff
    ? ticket.client.user.email
    : (await prisma.user.findMany({
        where: { role: { in: [UserRole.ADMIN, UserRole.STAFF] }, deletedAt: null },
        select: { email: true },
      })).map((u) => u.email);

  await sendEmail({
    to: notifyEmail,
    subject: `Ticket update: ${ticket.subject}`,
    html: ticketReplyEmailHtml({
      ticketSubject: ticket.subject,
      messagePreview: body.slice(0, 200),
      ticketUrl,
      isStaffReply: isStaff,
    }),
  });

  revalidatePath(`/portal/support/${ticketId}`);
  revalidatePath(`/admin/tickets/${ticketId}`);
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const user = await requireAdmin();
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
    select: { clientId: true },
  });
  if (!ticket) throw new Error("Ticket not found");
  await assertClientAccess(user, ticket.clientId);

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      closedAt: status === TicketStatus.RESOLVED ? new Date() : null,
    },
  });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}
