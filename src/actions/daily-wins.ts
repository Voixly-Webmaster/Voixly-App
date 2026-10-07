"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { UserRole } from "@prisma/client";
import { goalDateRange, parseGoalDate } from "@/lib/daily-wins";

export async function getDailyWins(goalDate: string, viewUserId?: string) {
  const user = await requireAdmin();
  const scopedUserId =
    user.role === UserRole.ADMIN ? viewUserId : user.id;

  const wins = await prisma.dailyWin.findMany({
    where: {
      goalDate: goalDateRange(goalDate),
      ...(scopedUserId ? { userId: scopedUserId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ completed: "asc" }, { createdAt: "asc" }],
  });

  return wins.map((w) => ({
    id: w.id,
    text: w.text,
    goalDate: goalDate,
    userId: w.userId,
    completed: w.completed,
    user: w.user,
  }));
}

export async function createDailyWin(text: string, goalDate: string) {
  const user = await requireAdmin();
  if (!text.trim()) throw new Error("Win text required");

  await prisma.dailyWin.create({
    data: {
      text: text.trim(),
      goalDate: parseGoalDate(goalDate),
      userId: user.id,
    },
  });

  revalidatePath("/admin/tasks");
}

export async function toggleDailyWin(id: string, completed: boolean) {
  const user = await requireAdmin();
  const win = await prisma.dailyWin.findUnique({ where: { id } });
  if (!win) throw new Error("Not found");
  if (win.userId !== user.id && user.role !== "ADMIN") {
    throw new Error("Only the creator can edit this win");
  }

  await prisma.dailyWin.update({ where: { id }, data: { completed } });
  revalidatePath("/admin/tasks");
}

export async function deleteDailyWin(id: string) {
  const user = await requireAdmin();
  const win = await prisma.dailyWin.findUnique({ where: { id } });
  if (!win) throw new Error("Not found");
  if (win.userId !== user.id && user.role !== "ADMIN") {
    throw new Error("Only the creator can delete this win");
  }

  await prisma.dailyWin.delete({ where: { id } });
  revalidatePath("/admin/tasks");
}
