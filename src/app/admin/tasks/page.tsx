import { prisma } from "@/lib/db";
import { requireAdmin, getStaffClientScope } from "@/lib/session-guard";
import { PageHeader } from "@/components/shared/page-header";
import { TaskBoard } from "@/components/tasks/task-board";
import { toDateKey, todayKey } from "@/lib/task-utils";
import { goalDateRange } from "@/lib/daily-wins";
import type { DailyWinItem } from "@/components/tasks/daily-wins";
import type { TaskItem } from "@/types/tasks";
import { UserRole } from "@prisma/client";

export default async function AdminTasksPage() {
  const user = await requireAdmin();
  const scope = await getStaffClientScope(user);
  const clientWhere =
    scope !== "all"
      ? { id: { in: scope.length ? scope : ["__none__"] } }
      : {};

  const today = todayKey();

  const [clients, staff, tasks, dailyWinsRaw] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null, ...clientWhere },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.STAFF] }, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(scope !== "all"
          ? {
              OR: [
                { clientId: { in: scope } },
                { assigneeId: user.id },
                { createdById: user.id },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { id: true, companyName: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.dailyWin.findMany({
      where: { goalDate: goalDateRange(today) },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ completed: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const initialDailyWins: DailyWinItem[] = dailyWinsRaw.map((w) => ({
    id: w.id,
    text: w.text,
    goalDate: today,
    userId: w.userId,
    completed: w.completed,
    user: w.user,
  }));

  const serialized: TaskItem[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
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
        title="Tasks"
        description="Workspaces, filters, and daily wins for your team"
      />
      <TaskBoard
        tasks={serialized}
        staff={staff}
        clients={clients}
        initialDailyWins={initialDailyWins}
        currentUser={{
          id: user.id,
          name: user.name ?? null,
          email: user.email,
          role: user.role,
        }}
      />
    </div>
  );
}
