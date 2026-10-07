"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { UserRole } from "@prisma/client";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_DIR,
  isAllowedFile,
} from "@/lib/uploads";

export async function uploadFile(formData: FormData) {
  const user = await requireAuth();
  const file = formData.get("file") as File | null;
  const clientIdInput = (formData.get("clientId") as string | null) || null;
  const clientVisible = formData.get("clientVisible") !== "false";

  if (!file || file.size === 0) throw new Error("No file provided");
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(`File too large (max ${mb}MB)`);
  }

  if (!isAllowedFile(file.name, file.type)) {
    throw new Error(
      `File type not allowed. Accepted: ${[...ALLOWED_MIME_TYPES]
        .map((t) => t.split("/").pop())
        .filter(Boolean)
        .slice(0, 12)
        .join(", ")}...`
    );
  }

  let clientId: string | null;
  if (user.role === UserRole.CLIENT) {
    clientId = user.clientId!;
  } else {
    clientId = clientIdInput;
    if (user.role === UserRole.STAFF && !clientId) {
      throw new Error("Choose a client for this file");
    }
    if (clientId) await assertClientAccess(user, clientId);
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = path.extname(file.name) || "";
  const fileName = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  const fullPath = path.join(dir, fileName);
  await writeFile(fullPath, buffer);

  await prisma.fileUpload.create({
    data: {
      clientId,
      uploadedById: user.id,
      fileName,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      path: fileName,
      clientVisible: user.role === UserRole.CLIENT ? true : clientVisible,
    },
  });

  await logActivity({
    actorId: user.id,
    clientId: clientId ?? undefined,
    action: "file.uploaded",
    metadata: { name: file.name },
  });

  revalidatePath("/portal/files");
  revalidatePath("/admin/files");
}

export async function deleteFile(fileId: string) {
  const user = await requireAuth();
  const file = await prisma.fileUpload.findFirst({
    where: { id: fileId, deletedAt: null },
  });
  if (!file) throw new Error("File not found");

  if (user.role === UserRole.CLIENT) {
    if (file.clientId !== user.clientId || file.uploadedById !== user.id) {
      throw new Error("Unauthorized");
    }
  } else {
    await assertClientAccess(user, file.clientId);
  }

  await prisma.fileUpload.update({
    where: { id: fileId },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    actorId: user.id,
    clientId: file.clientId ?? undefined,
    action: "file.deleted",
    entityType: "file",
    entityId: fileId,
  });

  revalidatePath("/portal/files");
  revalidatePath("/admin/files");
}
