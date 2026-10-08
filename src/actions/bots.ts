"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { generateBotToken } from "@/lib/bots";
import { BOT_SCOPES, parseScopes, scopesToString, type BotScope } from "@/lib/bot-scopes";

const PATH = "/admin/settings/bots";

function chosenScopes(formData: FormData): BotScope[] {
  const raw = formData.getAll("scopes").map((value) => String(value));
  return parseScopes(raw.join(" "));
}

export async function createBot(
  formData: FormData
): Promise<{ token: string; name: string } | { error: string }> {
  try {
    const admin = await requireAdminRole();
    const name = String(formData.get("name") ?? "").trim().slice(0, 40);
    if (!name) return { error: "Name this bot" };
    const scopes = chosenScopes(formData);
    if (scopes.length === 0) return { error: "Choose what this bot can do" };
    if (scopes.some((scope) => !BOT_SCOPES.includes(scope))) {
      return { error: "Choose what this bot can do" };
    }

    const active = await prisma.botToken.count({ where: { revokedAt: null } });
    if (active >= 20) return { error: "Revoke a bot key before adding another" };

    const generated = generateBotToken();
    await prisma.botToken.create({
      data: {
        name,
        tokenHash: generated.hash,
        prefix: generated.prefix,
        scopes: scopesToString(scopes),
        createdById: admin.id,
      },
    });

    try {
      await logActivity({
        actorId: admin.id,
        action: "bot.created",
        entityType: "bot",
        metadata: { name, scopes: scopesToString(scopes) },
      });
    } catch (err) {
      console.error("[bots] activity log failed", err);
    }

    revalidatePath(PATH);
    return { token: generated.secret, name };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[bots] create failed", err);
    return { error: "Could not create the bot key" };
  }
}

export async function revokeBot(id: string): Promise<{ ok: true } | { error: string }> {
  try {
    const admin = await requireAdminRole();
    const bot = await prisma.botToken.findUnique({
      where: { id },
      select: { id: true, name: true, revokedAt: true },
    });
    if (!bot) return { error: "That bot key was not found" };
    if (!bot.revokedAt) {
      await prisma.botToken.update({
        where: { id: bot.id },
        data: { revokedAt: new Date() },
      });
      try {
        await logActivity({
          actorId: admin.id,
          action: "bot.revoked",
          entityType: "bot",
          entityId: bot.id,
          metadata: { name: bot.name },
        });
      } catch (err) {
        console.error("[bots] activity log failed", err);
      }
    }
    revalidatePath(PATH);
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[bots] revoke failed", err);
    return { error: "Could not revoke the bot key" };
  }
}
