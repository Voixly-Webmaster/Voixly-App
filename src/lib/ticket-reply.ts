import { revalidatePath } from "next/cache";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { renderEmail, renderSms } from "@/lib/message-templates";
import { textClient } from "@/lib/outreach";
import { getAppUrl } from "@/lib/app-url";

export async function addStaffTicketReply(input: {
  ticketId: string;
  body: string;
  authorId: string;
  botName?: string;
}): Promise<{ ok: true } | { error: string }> {
  const body = input.body.trim();
  if (!body) return { error: "Write a reply first" };
  if (body.length > 5000) return { error: "Keep the reply under 5000 characters" };

  const ticket = await prisma.supportTicket.findFirst({
    where: { id: input.ticketId, deletedAt: null },
    include: { client: { include: { user: { select: { email: true, deletedAt: true } } } } },
  });
  if (!ticket) return { error: "That ticket was not found" };

  await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: input.authorId,
      body,
      isStaff: true,
    },
  });

  if (ticket.status === TicketStatus.RESOLVED) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.OPEN },
    });
  } else if (ticket.status === TicketStatus.OPEN) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: TicketStatus.WAITING },
    });
  }

  const appUrl = await getAppUrl();
  const ticketUrl = `${appUrl}/portal/support/${ticket.id}`;
  if (!ticket.client.user.deletedAt) {
    try {
      const email = await renderEmail("ticket-reply", {
        subject: ticket.subject,
        preview: body.slice(0, 200),
        url: ticketUrl,
      });
      await sendEmail({
        to: [ticket.client.user.email],
        subject: email.subject,
        html: email.html,
      });
    } catch (err) {
      console.error("[ticket] notify failed", err);
    }
  }

  try {
    await textClient(
      ticket.clientId,
      await renderSms("ticket-reply", {
        subject: ticket.subject,
        preview: body.slice(0, 200),
        url: ticketUrl,
      })
    );
  } catch (err) {
    console.error("[ticket] text notify failed", err);
  }

  if (input.botName) {
    try {
      await logActivity({
        clientId: ticket.clientId,
        action: "ticket.replied",
        entityType: "ticket",
        entityId: ticket.id,
        metadata: { bot: input.botName },
      });
    } catch (err) {
      console.error("[ticket] activity log failed", err);
    }
  }

  try {
    revalidatePath(`/portal/support/${ticket.id}`);
    revalidatePath(`/admin/tickets/${ticket.id}`);
    revalidatePath("/admin/tickets");
    revalidatePath("/portal/support");
  } catch (err) {
    console.error("[ticket] revalidate failed", err);
  }
  return { ok: true };
}
