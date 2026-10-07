"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { TaskStatus, UserRole } from "@prisma/client";
import type { TaskFormData } from "@/types/tasks";

async function assertTaskAccess(
  user: Awaited<ReturnType<typeof requireAdmin>>,
  taskId: string
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, clientId: true, assigneeId: true, createdById: true },
  });
  if (!task) throw new Error("Task not found");
  if (task.clientId) {
    await assertClientAccess(user, task.clientId);
  } else if (
    user.role !== UserRole.ADMIN &&
    task.assigneeId !== user.id &&
    task.createdById !== user.id
  ) {
    throw new Error("Unauthorized");
  }
  return task;
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value + "T12:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export async function saveTask(data: TaskFormData, taskId?: string) {
  const user = await requireAdmin();
  if (!data.title?.trim()) throw new Error("Title required");

  const payload = {
    title: data.title.trim(),
    description: data.description?.trim() || null,
    clientId: data.clientId || null,
    assigneeId: data.assigneeId || null,
    status: data.status,
    priority: data.priority || "medium",
    scheduledDate: parseDateOnly(data.scheduledDate) ?? new Date(),
    dueDate: parseDateOnly(data.dueDate ?? null),
    clientVisible: data.clientVisible ?? false,
  };

  if (payload.clientId) await assertClientAccess(user, payload.clientId);

  if (taskId) {
    await assertTaskAccess(user, taskId);
    await prisma.task.update({ where: { id: taskId }, data: payload });
    await logActivity({
      actorId: user.id,
      clientId: payload.clientId ?? undefined,
      action: "task.updated",
      entityType: "task",
      entityId: taskId,
    });
  } else {
    const task = await prisma.task.create({
      data: { ...payload, createdById: user.id },
    });
    await logActivity({
      actorId: user.id,
      clientId: payload.clientId ?? undefined,
      action: "task.created",
      entityType: "task",
      entityId: task.id,
    });
  }

  revalidatePath("/admin/tasks");
  revalidatePath("/portal/projects");
}

export async function toggleTaskComplete(taskId: string, completed: boolean) {
  const user = await requireAdmin();
  await assertTaskAccess(user, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { completed } });
  revalidatePath("/admin/tasks");
  revalidatePath("/portal/projects");
}

export async function deleteTask(taskId: string) {
  const user = await requireAdmin();
  await assertTaskAccess(user, taskId);
  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });
  await logActivity({
    actorId: user.id,
    action: "task.deleted",
    entityType: "task",
    entityId: taskId,
  });
  revalidatePath("/admin/tasks");
  revalidatePath("/portal/projects");
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const user = await requireAdmin();
  await assertTaskAccess(user, taskId);
  await prisma.task.update({ where: { id: taskId }, data: { status } });
  revalidatePath("/admin/tasks");
  revalidatePath("/portal/projects");
}

export async function addTaskComment(taskId: string, formData: FormData) {
  const user = await requireAdmin();
  await assertTaskAccess(user, taskId);
  const body = (formData.get("body") as string)?.trim();
  if (!body) throw new Error("Comment required");

  await prisma.taskComment.create({
    data: { taskId, authorId: user.id, body },
  });

  revalidatePath(`/admin/tasks/${taskId}`);
}

/** @deprecated Use saveTask — kept for any remaining form actions */
export async function createTask(formData: FormData) {
  const user = await requireAdmin();
  await saveTask(
    {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      clientId: (formData.get("clientId") as string) || null,
      assigneeId: (formData.get("assigneeId") as string) || null,
      dueDate: (formData.get("dueDate") as string) || null,
      scheduledDate: (formData.get("scheduledDate") as string) || new Date().toISOString().slice(0, 10),
      status: (formData.get("status") as TaskStatus) || TaskStatus.NEW,
      priority: "medium",
      clientVisible: formData.get("clientVisible") === "on",
    },
    undefined
  );
  void user;
}
