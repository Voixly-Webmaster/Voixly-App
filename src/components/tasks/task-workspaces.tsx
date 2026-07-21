"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Users } from "lucide-react";
import type { TaskItem } from "@/types/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { groupTasksForWorkspaces } from "@/lib/task-utils";

function WorkspaceSection({
  title,
  tasks,
  icon,
  viewMode,
  defaultExpanded = true,
  collapsible = true,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  title: string;
  tasks: TaskItem[];
  icon: React.ReactNode;
  viewMode: "grid" | "list";
  defaultExpanded?: boolean;
  collapsible?: boolean;
  onToggleComplete: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (tasks.length === 0) return null;

  const active = tasks.filter((t) => !t.completed).length;
  const done = tasks.filter((t) => t.completed).length;
  const isExpanded = collapsible ? expanded : true;

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {collapsible && viewMode === "grid" ? (
        <button
          type="button"
          className="flex w-full items-center justify-between bg-gradient-to-r from-secondary/20 to-primary/10 px-4 py-3 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-semibold">{title}</h3>
            <span className="text-xs text-muted-foreground">
              {active} active, {done} completed
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
          {icon}
          <h3 className="font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground">
            {active} active, {done} completed
          </span>
        </div>
      )}

      {isExpanded && (
        <div
          className={
            viewMode === "grid"
              ? "grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3 p-4"
          }
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              viewMode={viewMode}
              onToggleComplete={onToggleComplete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TaskWorkspaces({
  tasks,
  currentUserId,
  isAdmin,
  viewMode,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  tasks: TaskItem[];
  currentUserId: string;
  isAdmin: boolean;
  viewMode: "grid" | "list";
  onToggleComplete: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (id: string) => void;
}) {
  const { yourTasks, clientWorkspaces, otherTasks } = groupTasksForWorkspaces(
    tasks,
    currentUserId,
    isAdmin
  );

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
        <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-semibold">No tasks yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspaceSection
        title="Your Tasks"
        tasks={yourTasks}
        icon={<ClipboardList className="h-4 w-4 text-primary" />}
        viewMode={viewMode}
        defaultExpanded
        collapsible={viewMode === "grid"}
        onToggleComplete={onToggleComplete}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {clientWorkspaces.map((ws) => (
        <WorkspaceSection
          key={ws.clientId}
          title={`${ws.name} — Client Tasks`}
          tasks={ws.tasks}
          icon={<Users className="h-4 w-4 text-secondary" />}
          viewMode={viewMode}
          defaultExpanded={false}
          collapsible={viewMode === "grid"}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}

      {otherTasks.length > 0 && (
        <WorkspaceSection
          title="Other Tasks"
          tasks={otherTasks}
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
          viewMode={viewMode}
          defaultExpanded={false}
          collapsible={viewMode === "grid"}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
