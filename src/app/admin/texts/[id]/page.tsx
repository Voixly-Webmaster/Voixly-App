import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import {
  LinkCustomerForm,
  MakeTaskButton,
  MarkTextsRead,
  ReplyForm,
  ViewTaskLink,
} from "@/components/texts/text-actions";
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
    select: { client: { select: { companyName: true } }, phone: true },
  });
  return { title: thread?.client?.companyName ?? (thread ? formatPhone(thread.phone) : "Text") };
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
      messages: { orderBy: { sentAt: "asc" }, take: 200 },
    },
  });
  if (!thread) notFound();
  if (!thread.clientId || thread.client?.deletedAt) {
    if (user.role !== UserRole.ADMIN) notFound();
  } else if (!(await canAccessClient(user, thread.clientId))) {
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

  const title = linked ? thread.client!.companyName : "Unknown number";
  const who = thread.client?.contactName;

  return (
    <div className="space-y-6">
      <MarkTextsRead conversationId={thread.id} />
      <PageHeader
        title={title}
        description={
          linked
            ? `${who ? `${who} · ` : ""}${formatPhone(thread.phone)}`
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

      {!linked && user.role === UserRole.ADMIN && (
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
        <ol className="space-y-4">
          {thread.messages.map((message) => {
            const inbound = message.direction === SmsDirection.INBOUND;
            const taskId = message.taskId && liveTaskIds.has(message.taskId) ? message.taskId : null;
            return (
              <li key={message.id} className={inbound ? "mr-8 sm:mr-16" : "ml-8 sm:ml-16"}>
                <div
                  className={
                    inbound
                      ? "rounded-2xl rounded-tl-md bg-muted px-4 py-3"
                      : "rounded-2xl rounded-tr-md bg-primary/10 px-4 py-3"
                  }
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{inbound ? "Customer" : "Voixly"}</span>
                  <time dateTime={message.sentAt.toISOString()}>{formatDateTime(message.sentAt)}</time>
                  {inbound && OPT_OUT.test(message.body.trim()) && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                      Opt-out
                    </span>
                  )}
                </div>
                {inbound && (
                  <div className="mt-2">
                    {taskId ? (
                      <ViewTaskLink taskId={taskId} />
                    ) : linked ? (
                      <MakeTaskButton
                        messageId={message.id}
                        defaultAssigneeId={user.id}
                        assignees={assignees.map((person) => ({
                          id: person.id,
                          label: person.name?.trim() || person.email,
                        }))}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Link a customer to turn this into a task.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel title="Reply" description="Sends from your Voixly number" accent="secondary">
        <ReplyForm conversationId={thread.id} />
      </Panel>
    </div>
  );
}
