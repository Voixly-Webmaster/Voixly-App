import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session-guard";
import { canAccessClient } from "@/lib/permissions";
import { logoMimeType, storedFilePath } from "@/lib/uploads";
import { UserRole } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await requireAuth();

  const client = await prisma.client.findFirst({
    where: { id, deletedAt: null, logoFileName: { not: null } },
    select: { id: true, logoFileName: true },
  });
  if (!client?.logoFileName) return new NextResponse("Not found", { status: 404 });

  if (user.role === UserRole.CLIENT) {
    if (user.clientId !== client.id) return new NextResponse("Forbidden", { status: 403 });
  } else if (!(await canAccessClient(user, client.id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let absPath: string;
  try {
    absPath = storedFilePath(client.logoFileName);
    await stat(absPath);
  } catch {
    return new NextResponse("File missing on disk", { status: 410 });
  }

  const buffer = await readFile(absPath);
  const headers = new Headers({
    "Content-Type": logoMimeType(client.logoFileName),
    "Content-Length": String(buffer.byteLength),
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=300, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  });
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
