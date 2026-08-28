"use server";

import { revalidatePath } from "next/cache";
import { requireAdminRole } from "@/lib/session-guard";
import { setSetting, SETTING_DEFS, type SettingKey } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

/**
 * Saves the setting fields present in the form.
 * For secret settings, a blank input means "keep the current value";
 * submitting the literal "clear" checkbox (`clear:<key>`) removes it.
 */
export async function saveSettings(keys: SettingKey[], formData: FormData) {
  const admin = await requireAdminRole();

  for (const key of keys) {
    if (!(key in SETTING_DEFS)) throw new Error(`Unknown setting: ${key}`);
    const def = SETTING_DEFS[key];
    const raw = formData.get(key);
    const value = typeof raw === "string" ? raw.trim() : "";
    const clearRequested = formData.get(`clear:${key}`) === "on";

    if (clearRequested) {
      await setSetting(key, null);
      continue;
    }

    if (def.secret && !value) continue; // blank secret input → keep existing

    await setSetting(key, value || null);
  }

  await logActivity({
    actorId: admin.id,
    action: "settings.updated",
    entityType: "settings",
    metadata: { keys },
  });

  revalidatePath("/admin/settings", "layout");
}

export async function sendTestEmail() {
  const admin = await requireAdminRole();
  const { sendEmail } = await import("@/lib/email");
  const result = await sendEmail({
    to: admin.email,
    subject: "Voixly test email",
    html: `<p>Resend is connected. This test was sent to ${admin.email}.</p>`,
  });
  if ("dev" in result && result.dev) {
    throw new Error("Resend API key is not set — add it above or in RESEND_API_KEY.");
  }
  if (!result.ok) {
    throw new Error("Resend rejected the message. Check the from address and domain.");
  }

  await logActivity({
    actorId: admin.id,
    action: "settings.test_email",
    entityType: "settings",
  });
}
