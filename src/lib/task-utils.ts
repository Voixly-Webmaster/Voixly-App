import type { TaskItem } from "@/types/tasks";
import { format, isPast, parseISO, startOfDay } from "date-fns";

export function toDateKey(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(startOfDay(d), "yyyy-MM-dd");
}

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function tomorrowKey(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return format(t, "yyyy-MM-dd");
}

export function formatTaskDate(value: string | null): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "MMM d, yyyy");
  } catch {
    return value;
  }
}

export function isTaskOverdue(dueDate: string | null, completed: boolean): boolean {
  if (!dueDate || completed) return false;
  try {
    return isPast(parseISO(dueDate));
  } catch {
    return false;
  }
}

export function statusBorderClass(status: string): string {
  const map: Record<string, string> = {
    NEW: "border-l-slate-400 dark:border-l-slate-500",
    IN_PROGRESS: "border-l-blue-500 dark:border-l-blue-400",
    WAITING_ON_CLIENT: "border-l-amber-500 dark:border-l-amber-400",
    STUCK: "border-l-red-500 dark:border-l-red-400",
    SEND_TO_CLIENT: "border-l-violet-500 dark:border-l-violet-400",
    COMPLETED: "border-l-emerald-500 dark:border-l-emerald-400",
    ARCHIVED: "border-l-slate-300 dark:border-l-slate-600",
  };
  return map[status] ?? "border-l-primary";
}

export function filterTasks(
  tasks: TaskItem[],
  opts: {
    selectedDate: string;
    filterByUser: string;
    filterByClient: string;
    searchText: string;
    currentUserId: string;
    isAdmin: boolean;
  }
): TaskItem[] {
  let result = [...tasks];

  if (opts.selectedDate === "all") {
    result = result.filter((t) => !t.completed);
  } else {
    result = result.filter((t) => t.scheduledDate === opts.selectedDate);
  }

  if (opts.isAdmin && opts.filterByUser !== "all") {
    result = result.filter((t) => t.assigneeId === opts.filterByUser);
  }

  if (opts.filterByClient !== "all") {
    result = result.filter((t) => t.clientId === opts.filterByClient);
  }

  if (opts.searchText.trim()) {
    const q = opts.searchText.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.client?.companyName.toLowerCase().includes(q) ?? false) ||
        (t.assignee?.name?.toLowerCase().includes(q) ?? false) ||
        (t.assignee?.email.toLowerCase().includes(q) ?? false)
    );
  }

  return result;
}

export function groupTasksForWorkspaces(
  tasks: TaskItem[],
  currentUserId: string,
  isAdmin: boolean
) {
  const yourTasks = tasks.filter(
    (t) => t.assigneeId === currentUserId && !t.clientId
  );

  const clientIds = [...new Set(tasks.filter((t) => t.clientId).map((t) => t.clientId!))];
  const clientWorkspaces = clientIds
    .map((clientId) => ({
      clientId,
      name: tasks.find((t) => t.clientId === clientId)?.client?.companyName ?? "Client",
      tasks: tasks.filter((t) => t.clientId === clientId),
    }))
    .filter((w) => w.tasks.length > 0);

  const otherTasks =
    isAdmin
      ? tasks.filter(
          (t) =>
            !t.clientId &&
            t.assigneeId !== currentUserId &&
            (t.assigneeId === null || t.assigneeId !== currentUserId)
        )
      : [];

  return { yourTasks, clientWorkspaces, otherTasks };
}
