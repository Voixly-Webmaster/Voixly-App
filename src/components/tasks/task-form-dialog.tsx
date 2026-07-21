"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { selectClassName } from "@/lib/ui";
import type { TaskFormData, TaskItem } from "@/types/tasks";
import { TASK_STATUS_OPTIONS, PRIORITY_OPTIONS } from "@/types/tasks";
import { todayKey } from "@/lib/task-utils";
import { TaskStatus } from "@prisma/client";

type StaffOption = { id: string; name: string | null; email: string };
type ClientOption = { id: string; companyName: string };

export function TaskFormDialog({
  open,
  task,
  clients,
  staff,
  isAdmin,
  currentUserId,
  defaultScheduledDate,
  filterByUser,
  onClose,
  onSave,
}: {
  open: boolean;
  task: TaskItem | null;
  clients: ClientOption[];
  staff: StaffOption[];
  isAdmin: boolean;
  currentUserId: string;
  defaultScheduledDate: string;
  filterByUser: string;
  onClose: () => void;
  onSave: (data: TaskFormData, taskId?: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskFormData>({
    title: "",
    description: "",
    clientId: null,
    assigneeId: currentUserId,
    status: TaskStatus.NEW,
    priority: "medium",
    scheduledDate: defaultScheduledDate === "all" ? todayKey() : defaultScheduledDate,
    dueDate: null,
    clientVisible: false,
  });

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        clientId: task.clientId,
        assigneeId: task.assigneeId,
        status: task.status,
        priority: task.priority,
        scheduledDate: task.scheduledDate,
        dueDate: task.dueDate,
        clientVisible: task.clientVisible,
      });
    } else {
      const assigneeId =
        isAdmin && filterByUser !== "all" ? filterByUser : currentUserId;
      setForm({
        title: "",
        description: "",
        clientId: null,
        assigneeId,
        status: TaskStatus.NEW,
        priority: "medium",
        scheduledDate: defaultScheduledDate === "all" ? todayKey() : defaultScheduledDate,
        dueDate: null,
        clientVisible: false,
      });
    }
  }, [open, task, currentUserId, defaultScheduledDate, filterByUser, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onSave(
        {
          ...form,
          clientId: form.clientId || null,
          assigneeId: form.assigneeId || null,
          dueDate: form.dueDate || null,
        },
        task?.id
      );
      onClose();
    } catch {
      // Toast already raised by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Create task"}</DialogTitle>
          <DialogDescription>
            {task
              ? "Update task details. Changes are saved when you submit."
              : "Add a task to your workspace."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Task title *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Enter task title..."
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Add details..."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="task-assignee">Assign to</Label>
                <select
                  id="task-assignee"
                  value={form.assigneeId ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, assigneeId: e.target.value || null })
                  }
                  className={selectClassName}
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.email}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input
                type="hidden"
                value={form.assigneeId ?? currentUserId}
                readOnly
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="task-client">Client</Label>
              <select
                id="task-client"
                value={form.clientId ?? ""}
                onChange={(e) =>
                  setForm({ ...form, clientId: e.target.value || null })
                }
                className={selectClassName}
              >
                <option value="">No client (internal)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <select
                id="task-priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={selectClassName}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <select
                id="task-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as TaskStatus })
                }
                className={selectClassName}
              >
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-scheduled">Scheduled date</Label>
              <Input
                id="task-scheduled"
                type="date"
                value={form.scheduledDate}
                onChange={(e) =>
                  setForm({ ...form, scheduledDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due">Due date</Label>
              <Input
                id="task-due"
                type="date"
                value={form.dueDate ?? ""}
                onChange={(e) =>
                  setForm({ ...form, dueDate: e.target.value || null })
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.clientVisible}
              onChange={(e) =>
                setForm({ ...form, clientVisible: e.target.checked })
              }
            />
            Visible to client in portal
          </label>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : task ? "Update task" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
