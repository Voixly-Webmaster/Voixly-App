import type { TaskStatus } from "@prisma/client";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  scheduledDate: string;
  dueDate: string | null;
  completed: boolean;
  clientVisible: boolean;
  clientId: string | null;
  assigneeId: string | null;
  client?: { id: string; companyName: string } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
};

export type TaskFormData = {
  title: string;
  description?: string;
  clientId?: string | null;
  assigneeId?: string | null;
  status: TaskStatus;
  priority: string;
  scheduledDate: string;
  dueDate?: string | null;
  clientVisible?: boolean;
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "NEW", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_ON_CLIENT", label: "Waiting on Client" },
  { value: "STUCK", label: "Stuck" },
  { value: "SEND_TO_CLIENT", label: "Send to Client" },
  { value: "COMPLETED", label: "Complete" },
];

export const PRIORITY_OPTIONS = ["low", "medium", "high"] as const;
