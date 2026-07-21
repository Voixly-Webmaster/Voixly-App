import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function logActivity(params: {
  actorId?: string;
  clientId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      actorId: params.actorId,
      clientId: params.clientId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    },
  });
}
