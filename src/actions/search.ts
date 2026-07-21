"use server";

import { prisma } from "@/lib/db";
import { requireAuth, getStaffClientScope } from "@/lib/session-guard";
import { UserRole } from "@prisma/client";

export type SearchHit = {
  id: string;
  type: "client" | "invoice" | "ticket" | "task";
  title: string;
  subtitle?: string;
  href: string;
};

export async function globalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const user = await requireAuth();

  // Client portal users only see their own things.
  if (user.role === UserRole.CLIENT) {
    if (!user.clientId) return [];
    const [invoices, tickets, tasks] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          clientId: user.clientId,
          deletedAt: null,
          OR: [{ invoiceNumber: { contains: q } }, { title: { contains: q } }],
        },
        select: { id: true, invoiceNumber: true, title: true },
        take: 5,
      }),
      prisma.supportTicket.findMany({
        where: {
          clientId: user.clientId,
          deletedAt: null,
          subject: { contains: q },
        },
        select: { id: true, subject: true },
        take: 5,
      }),
      prisma.task.findMany({
        where: {
          clientId: user.clientId,
          deletedAt: null,
          clientVisible: true,
          title: { contains: q },
        },
        select: { id: true, title: true },
        take: 5,
      }),
    ]);

    return [
      ...invoices.map((i) => ({
        id: i.id,
        type: "invoice" as const,
        title: i.title,
        subtitle: i.invoiceNumber,
        href: "/portal/billing",
      })),
      ...tickets.map((t) => ({
        id: t.id,
        type: "ticket" as const,
        title: t.subject,
        href: `/portal/support/${t.id}`,
      })),
      ...tasks.map((t) => ({
        id: t.id,
        type: "task" as const,
        title: t.title,
        href: "/portal/projects",
      })),
    ];
  }

  // Admin / staff: include clients and respect scope.
  const scope = await getStaffClientScope(user);
  const clientScope =
    scope === "all" ? {} : { clientId: { in: scope.length ? scope : ["__none__"] } };
  const clientIdInScope =
    scope === "all" ? {} : { id: { in: scope.length ? scope : ["__none__"] } };

  const [clients, invoices, tickets, tasks] = await Promise.all([
    prisma.client.findMany({
      where: {
        ...clientIdInScope,
        deletedAt: null,
        OR: [
          { companyName: { contains: q } },
          { contactName: { contains: q } },
        ],
      },
      select: { id: true, companyName: true, contactName: true },
      take: 5,
    }),
    prisma.invoice.findMany({
      where: {
        ...clientScope,
        deletedAt: null,
        OR: [{ invoiceNumber: { contains: q } }, { title: { contains: q } }],
      },
      include: { client: { select: { companyName: true } } },
      take: 5,
    }),
    prisma.supportTicket.findMany({
      where: {
        ...clientScope,
        deletedAt: null,
        subject: { contains: q },
      },
      include: { client: { select: { companyName: true } } },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        ...(scope !== "all"
          ? {
              OR: [
                { clientId: { in: scope.length ? scope : ["__none__"] } },
                { assigneeId: user.id },
                { createdById: user.id },
              ],
            }
          : {}),
        deletedAt: null,
        title: { contains: q },
      },
      include: { client: { select: { companyName: true } } },
      take: 5,
    }),
  ]);

  return [
    ...clients.map((c) => ({
      id: c.id,
      type: "client" as const,
      title: c.companyName,
      subtitle: c.contactName ?? undefined,
      href: `/admin/clients/${c.id}`,
    })),
    ...invoices.map((i) => ({
      id: i.id,
      type: "invoice" as const,
      title: i.title,
      subtitle: `${i.invoiceNumber} · ${i.client.companyName}`,
      href: "/admin/invoices",
    })),
    ...tickets.map((t) => ({
      id: t.id,
      type: "ticket" as const,
      title: t.subject,
      subtitle: t.client.companyName,
      href: `/admin/tickets/${t.id}`,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      type: "task" as const,
      title: t.title,
      subtitle: t.client?.companyName ?? "Internal",
      href: `/admin/tasks/${t.id}`,
    })),
  ];
}
