"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DailyWins, type DailyWinItem } from "@/components/tasks/daily-wins";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { TaskWorkspaces } from "@/components/tasks/task-workspaces";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/providers/toast-provider";
import type { TaskFormData, TaskItem } from "@/types/tasks";
import {
  deleteTask,
  saveTask,
  toggleTaskComplete,
} from "@/actions/tasks";
import { filterTasks } from "@/lib/task-utils";
import { UserRole } from "@prisma/client";

type StaffOption = { id: string; name: string | null; email: string };
type ClientOption = { id: string; companyName: string };

export function TaskBoard({
  tasks: initialTasks,
  staff,
  clients,
  initialDailyWins = [],
  currentUser,
}: {
  tasks: TaskItem[];
  staff: StaffOption[];
  clients: ClientOption[];
  initialDailyWins?: DailyWinItem[];
  currentUser: {
    id: string;
    name: string | null;
    email: string;
    role: UserRole;
  };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const [selectedDate, setSelectedDate] = useState("all");
  const [filterByUser, setFilterByUser] = useState("all");
  const [filterByClient, setFilterByClient] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const filteredTasks = useMemo(
    () =>
      filterTasks(initialTasks, {
        selectedDate,
        filterByUser,
        filterByClient,
        searchText,
        currentUserId: currentUser.id,
        isAdmin,
      }),
    [
      initialTasks,
      selectedDate,
      filterByUser,
      filterByClient,
      searchText,
      currentUser.id,
      isAdmin,
    ]
  );

  const openTaskCount = useMemo(
    () =>
      initialTasks.filter(
        (t) => t.assigneeId === currentUser.id && !t.completed
      ).length,
    [initialTasks, currentUser.id]
  );

  const refresh = () => startTransition(() => router.refresh());

  const handleToggleComplete = (task: TaskItem) => {
    startTransition(async () => {
      try {
        await toggleTaskComplete(task.id, !task.completed);
        refresh();
      } catch (err) {
        toast.error(
          "Could not update task",
          err instanceof Error ? err.message : undefined
        );
      }
    });
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Delete this task?",
      description: "The task will be removed from the board. You can restore it from the database if needed.",
      tone: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteTask(id);
        toast.success("Task deleted");
        refresh();
      } catch (err) {
        toast.error(
          "Could not delete task",
          err instanceof Error ? err.message : undefined
        );
      }
    });
  };

  const handleSave = async (data: TaskFormData, taskId?: string) => {
    try {
      await saveTask(data, taskId);
      toast.success(taskId ? "Task updated" : "Task created");
      refresh();
    } catch (err) {
      toast.error(
        taskId ? "Could not update task" : "Could not create task",
        err instanceof Error ? err.message : undefined
      );
      throw err;
    }
  };

  useEffect(() => {
    function onShortcut(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setEditingTask(null);
        setShowForm(true);
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <div className={isPending ? "opacity-70 pointer-events-none" : ""}>
      <DailyWins
        goalDate={selectedDate}
        currentUserId={currentUser.id}
        staff={staff}
        isAdmin={isAdmin}
        initialWins={initialDailyWins}
      />

      <TaskFilterBar
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        filterByUser={filterByUser}
        setFilterByUser={setFilterByUser}
        filterByClient={filterByClient}
        setFilterByClient={setFilterByClient}
        searchText={searchText}
        setSearchText={setSearchText}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onCreateTask={() => {
          setEditingTask(null);
          setShowForm(true);
        }}
        staff={staff}
        clients={clients}
        isAdmin={isAdmin}
        currentUserId={currentUser.id}
        openTaskCount={openTaskCount}
      />

      <div className="mt-6">
        <TaskWorkspaces
          tasks={filteredTasks}
          currentUserId={currentUser.id}
          isAdmin={isAdmin}
          viewMode={viewMode}
          onToggleComplete={handleToggleComplete}
          onEdit={(task) => {
            setEditingTask(task);
            setShowForm(true);
          }}
          onDelete={handleDelete}
        />
      </div>

      <TaskFormDialog
        open={showForm}
        task={editingTask}
        clients={clients}
        staff={staff}
        isAdmin={isAdmin}
        currentUserId={currentUser.id}
        defaultScheduledDate={selectedDate}
        filterByUser={filterByUser}
        onClose={() => {
          setShowForm(false);
          setEditingTask(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
