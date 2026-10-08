import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireClient } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";

import { EmptyState } from "@/components/shared/empty-state";
import { TaskCard } from "@/components/tasks/task-card";
import { toDateKey } from "@/lib/task-utils";
import type { TaskItem } from "@/types/tasks";
import { FolderKanban } from "lucide-react";

export const metadata: Metadata = {
  title: "Projects",
  description: "See the work Voixly is tracking for your account.",
};

export default async function PortalProjectsPage() {
  const user = await requireClient();

  const tasks = await prisma.task.findMany({
    where: {
      clientId: user.clientId!,
      clientVisible: true,
      deletedAt: null,
      completed: false,
      status: { not: "ARCHIVED" },
    },
    include: {
      client: { select: { id: true, companyName: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
  });

  const serialized: TaskItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description?.split("\n").find((line) => line.trim()) ?? null,
    status: t.status,
    priority: t.priority,
    scheduledDate: toDateKey(t.scheduledDate),
    dueDate: t.dueDate ? toDateKey(t.dueDate) : null,
    completed: t.completed,
    clientVisible: t.clientVisible,
    clientId: t.clientId,
    assigneeId: t.assigneeId,
    client: t.client,
    assignee: t.assignee,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Website changes you text us, and other work your team has shared"
      />

      {serialized.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No active projects"
          description="When you text a change, it shows up here once your team assigns it."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {serialized.map((task) => (
            <TaskCard key={task.id} task={task} viewMode="grid" readOnly />
          ))}
        </div>
      )}
    </div>
  );
}
