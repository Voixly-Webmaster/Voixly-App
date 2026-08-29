import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addTaskComment, updateTaskStatus } from "@/actions/tasks";
import { TaskStatus } from "@prisma/client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    select: { title: true },
  });
  return { title: task?.title ?? "Task" };
}

export default async function AdminTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: true,
      assignee: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!task) notFound();
  if (task.clientId && !(await canAccessClient(user, task.clientId))) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={task.client?.companyName ?? "Internal task"}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/tasks">← Tasks</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-card px-5 py-4 shadow-sm">
        <TaskStatusBadge status={task.status} />
        {task.clientVisible && (
          <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-medium text-secondary">
            Client visible
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          {Object.values(TaskStatus).map((s) => (
            <form key={s}>
              <Button
                type="submit"
                variant={task.status === s ? "default" : "outline"}
                size="sm"
                formAction={async () => {
                  "use server";
                  await updateTaskStatus(task.id, s);
                }}
              >
                {s.replace(/_/g, " ")}
              </Button>
            </form>
          ))}
        </div>
      </div>

      {(task.description || task.dueDate || task.assignee) && (
        <Panel accent="none" title="Details">
          {task.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{task.description}</p>
          )}
          <p className="mt-2 text-sm">
            Due {formatDate(task.dueDate)} · Assignee: {task.assignee?.name ?? "Unassigned"}
          </p>
        </Panel>
      )}

      <Panel title="Comments" icon={MessageSquare} accent="none">
        <div className="space-y-4">
          {task.comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p>{c.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.author.name} · {formatDateTime(c.createdAt)}
              </p>
            </div>
          ))}
          <form action={addTaskComment.bind(null, task.id)} className="space-y-2 border-t border-border/60 pt-4">
            <Textarea name="body" placeholder="Add comment..." required rows={2} />
            <Button type="submit" size="sm">
              Add comment
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
