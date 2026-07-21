"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/session-guard";
import { assertClientAccess } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

export async function saveInsightsConfig(
  clientId: string,
  formData: FormData
) {
  const user = await requireAdmin();
  await assertClientAccess(user, clientId);

  const gaPropertyId = (formData.get("gaPropertyId") as string) || null;
  const gaPropertyName = (formData.get("gaPropertyName") as string) || null;
  const searchConsoleSite = (formData.get("searchConsoleSite") as string) || null;
  const clientVisible = formData.get("clientVisible") === "on";

  const integration = await prisma.clientGoogleIntegration.findUnique({
    where: { clientId },
  });
  if (!integration) throw new Error("Connect Google first");

  await prisma.clientGoogleIntegration.update({
    where: { clientId },
    data: {
      gaPropertyId: gaPropertyId || null,
      gaPropertyName: gaPropertyName || null,
      searchConsoleSite: searchConsoleSite || null,
      clientVisible,
    },
  });

  await logActivity({
    actorId: user.id,
    clientId,
    action: "insights.config_updated",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath(`/admin/clients/${clientId}/insights`);
  revalidatePath("/portal/insights");
}

export async function disconnectGoogleInsights(clientId: string) {
  const user = await requireAdmin();
  await assertClientAccess(user, clientId);

  await prisma.clientGoogleIntegration.deleteMany({ where: { clientId } });

  await logActivity({
    actorId: user.id,
    clientId,
    action: "insights.disconnected",
    entityType: "client",
    entityId: clientId,
  });

  revalidatePath(`/admin/clients/${clientId}/insights`);
  revalidatePath("/portal/insights");
}
