import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { LinkCustomerForm, MarkTextsRead, ReplyForm } from "@/components/texts/text-actions";
import { TextThreadMessages } from "@/components/texts/text-inbox";
import { formatPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/utils";
import { SmsDirection, UserRole } from "@prisma/client";
import { Smartphone } from "lucide-react";

const OPT_OUT = /^(stop|stopall|unsubscribe|cancel|end|quit)$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const thread = await prisma.smsConversation.findUnique({
    where: { id },
    select: {
      phone: true,
      client: { select: { companyName: true } },
      user: { select: { name: true, email: true, deletedAt: true } },
      messages: { where: { deletedAt: null }, take: 1, select: { id: true } },
    },
  });
  if (!thread || thread.messages.length === 0) return { title: "Text" };
  const teammate =
    thread.user && !thread.user.deletedAt ? thread.user.name?.trim() || thread.user.email : null;
  return { title: thread.client?.companyName ?? teammate ?? formatPhone(thread.phone) };
}

export default async function TextThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const thread = await prisma.smsConversation.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, companyName: true, contactName: true, deletedAt: true } },
      user: { select: { id: true, name: true, email: true, role: true, deletedAt: true } },
      messages: {
        where: { deletedAt: null },
        orderBy: { sentAt: "asc" },
        take: 200,
      },
    },
  });
  if (!thread || thread.messages.length === 0) notFound();
  const teammate =
    thread.user &&
    !thread.user.deletedAt &&
    !thread.clientId &&
    (thread.user.role === UserRole.ADMIN || thread.user.role === UserRole.STAFF)
      ? thread.user
      : null;
  if (!teammate && (!thread.clientId || thread.client?.deletedAt)) {
    if (user.role !== UserRole.ADMIN) notFound();
  } else if (!teammate && thread.clientId && !(await canAccessClient(user, thread.clientId))) {
    notFound();
  }

  const linked = Boolean(thread.clientId && thread.client && !thread.client.deletedAt);
  const [clients, assignees] = await Promise.all([
    user.role === UserRole.ADMIN && !linked
      ? prisma.client.findMany({
          where: { deletedAt: null },
          select: { id: true, companyName: true, contactName: true },
          orderBy: { companyName: "asc" },
        })
      : Promise.resolve([]),
    linked
      ? prisma.user.findMany({
          where: { deletedAt: null, role: { in: [UserRole.ADMIN, UserRole.STAFF] } },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const taskIds = thread.messages
    .map((message) => message.taskId)
    .filter((taskId): taskId is string => !!taskId);
  const tasks = taskIds.length
    ? await prisma.task.findMany({
        where: { id: { in: taskIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const liveTaskIds = new Set(tasks.map((task) => task.id));

  const title = linked
    ? thread.client!.companyName
    : teammate
      ? teammate.name?.trim() || teammate.email
      : "Unknown number";
  const who = thread.client?.contactName;
  const teammateRole = teammate?.role === UserRole.ADMIN ? "Admin" : "Staff";

  return (
    <div className="space-y-6">
      <MarkTextsRead conversationId={thread.id} />
      <PageHeader
        title={title}
        description={
          linked
            ? `${who ? `${who} · ` : ""}${formatPhone(thread.phone)}`
            : teammate
              ? `${teammateRole} · ${formatPhone(thread.phone)}`
              : `${formatPhone(thread.phone)} · not linked to a customer yet`
        }
        action={
          <div className="flex flex-wrap gap-2">
            {linked && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/clients/${thread.clientId}`}>View customer</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/texts">← Texts</Link>
            </Button>
          </div>
        }
      />

      {!linked && !teammate && user.role === UserRole.ADMIN && (
        <Panel
          title="Link this number"
          description="Pick the customer so this thread, and the next texts from this phone, stay on their account."
          icon={Smartphone}
          accent="primary"
        >
          <LinkCustomerForm
            conversationId={thread.id}
            clients={clients.map((client) => ({
              id: client.id,
              label: client.contactName
                ? `${client.companyName} — ${client.contactName}`
                : client.companyName,
            }))}
          />
        </Panel>
      )}

      <Panel title="Conversation" icon={Smartphone} accent="none">
        <TextThreadMessages
          conversationId={thread.id}
          linked={linked}
          defaultAssigneeId={user.id}
          assignees={assignees.map((person) => ({
            id: person.id,
            label: person.name?.trim() || person.email,
          }))}
          messages={thread.messages.map((message) => ({
            id: message.id,
            body: message.body,
            inbound: message.direction === SmsDirection.INBOUND,
            sentAtLabel: formatDateTime(message.sentAt),
            sentAtIso: message.sentAt.toISOString(),
            optOut: message.direction === SmsDirection.INBOUND && OPT_OUT.test(message.body.trim()),
            taskId: message.taskId && liveTaskIds.has(message.taskId) ? message.taskId : null,
          }))}
        />
      </Panel>

      <Panel title="Reply" description="Sends from your Voixly number" accent="secondary">
        <ReplyForm conversationId={thread.id} />
      </Panel>
    </div>
  );
}
