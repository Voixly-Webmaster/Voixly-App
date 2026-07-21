import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { storedFilePath } from "@/lib/uploads";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await requireAuth();

  const file = await prisma.fileUpload.findFirst({
    where: { id, deletedAt: null },
  });
  if (!file) return new NextResponse("Not found", { status: 404 });

  if (user.role === UserRole.CLIENT) {
    if (file.clientId !== user.clientId || !file.clientVisible) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  } else {
    const allowed = await canAccessClient(user, file.clientId);
    if (!allowed) return new NextResponse("Forbidden", { status: 403 });
  }

  let absPath = storedFilePath(file.path);
  try {
    await stat(absPath);
  } catch {
    // Legacy uploads stored full /uploads/{name} URLs in `path`.
    if (file.path.startsWith("/uploads/")) {
      absPath = storedFilePath(file.path.replace(/^\/uploads\//, ""));
      try {
        await stat(absPath);
      } catch {
        return new NextResponse("File missing on disk", { status: 410 });
      }
    } else {
      return new NextResponse("File missing on disk", { status: 410 });
    }
  }

  const buffer = await readFile(absPath);
  const headers = new Headers({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Length": String(file.sizeBytes),
    "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
    "Cache-Control": "private, max-age=300, must-revalidate",
  });
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
