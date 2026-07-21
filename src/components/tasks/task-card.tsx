"use client";

import {
  Building2,
  Calendar,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { TaskItem } from "@/types/tasks";
import {
  formatTaskDate,
  isTaskOverdue,
  statusBorderClass,
} from "@/lib/task-utils";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  viewMode,
  onToggleComplete,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  task: TaskItem;
  viewMode: "grid" | "list";
  onToggleComplete?: (task: TaskItem) => void;
  onEdit?: (task: TaskItem) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
}) {
  const overdue = isTaskOverdue(task.dueDate, task.completed);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm shadow-elevated transition-shadow hover:shadow-md border-l-4",
        statusBorderClass(task.status),
        task.completed && "opacity-70",
        viewMode === "list" && "flex flex-col gap-3 sm:flex-row sm:items-center"
      )}
    >
      <div className={cn("flex flex-1 gap-3", viewMode === "list" && "min-w-0")}>
        {!readOnly && (
          <input
            type="checkbox"
            checked={task.completed}
            onChange={() => onToggleComplete?.(task)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-input accent-primary"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "font-semibold leading-snug",
              task.completed && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {task.assignee && (
              <span>{task.assignee.name ?? task.assignee.email}</span>
            )}
            {task.client && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {task.client.companyName}
              </span>
            )}
          </div>
          {task.description && viewMode === "grid" && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          viewMode === "list" && "sm:shrink-0"
        )}
      >
        <Badge variant="outline" className="capitalize">
          <Tag className="mr-1 h-3 w-3" />
          {task.priority}
        </Badge>
        <TaskStatusBadge status={task.status} />
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {formatTaskDate(task.scheduledDate)}
        </span>
        {task.dueDate && (
          <span
            className={cn(
              "text-xs inline-flex items-center gap-1",
              overdue ? "font-medium text-destructive" : "text-muted-foreground"
            )}
          >
            Due {formatTaskDate(task.dueDate)}
          </span>
        )}
        {!readOnly && (
          <div className="flex gap-1 ml-auto">
            <Button variant="ghost" size="icon" onClick={() => onEdit?.(task)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete?.(task.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
