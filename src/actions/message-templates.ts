"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireAdminRole } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { getMessageFlow } from "@/lib/message-catalog";
import { resetMessageOverride, saveMessageOverride } from "@/lib/message-templates";

export async function saveMessageTemplate(flowId: string, values: Record<string, string>) {
  try {
    const admin = await requireAdminRole();
    const result = await saveMessageOverride(flowId, values);
    if (!result.ok) return result;
    await logActivity({
      actorId: admin.id,
      action: "message.template_updated",
      entityType: "message",
      entityId: flowId,
      metadata: { name: getMessageFlow(flowId)?.name ?? flowId },
    });
    revalidatePath("/admin/settings/messages");
    return { ok: true as const };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[messages] save failed", err);
    return { ok: false as const, error: "Could not save this message" };
  }
}

export async function resetMessageTemplate(flowId: string) {
  try {
    const admin = await requireAdminRole();
    const result = await resetMessageOverride(flowId);
    if (!result.ok) return result;
    await logActivity({
      actorId: admin.id,
      action: "message.template_reset",
      entityType: "message",
      entityId: flowId,
      metadata: { name: getMessageFlow(flowId)?.name ?? flowId },
    });
    revalidatePath("/admin/settings/messages");
    return { ok: true as const };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[messages] reset failed", err);
    return { ok: false as const, error: "Could not reset this message" };
  }
}
