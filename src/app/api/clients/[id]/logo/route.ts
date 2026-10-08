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
    where: { id, deletedAt: null },
    select: {
      id: true,
      logoFileName: true,
      logo: { select: { data: true } },
    },
  });
  if (!client?.logoFileName && !client?.logo) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (user.role === UserRole.CLIENT) {
    if (user.clientId !== client.id) return new NextResponse("Forbidden", { status: 403 });
  } else if (!(await canAccessClient(user, client.id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const stored = client.logo?.data;
  let bytes: Uint8Array | null = stored && stored.byteLength > 0 ? new Uint8Array(stored) : null;
  if (!bytes && client.logoFileName) {
    try {
      const absPath = storedFilePath(client.logoFileName);
      await stat(absPath);
      bytes = new Uint8Array(await readFile(absPath));
    } catch {
      bytes = null;
    }
  }
  if (!bytes) return new NextResponse("Not found", { status: 404 });

  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);
  const headers = new Headers({
    "Content-Type": logoMimeType(client.logoFileName ?? "logo.png"),
    "Content-Length": String(body.byteLength),
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=300, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  });
  return new NextResponse(body, { status: 200, headers });
}
