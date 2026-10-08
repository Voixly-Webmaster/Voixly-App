import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { formatDateTime } from "@/lib/utils";
import { FormPanel } from "@/components/shared/form-panel";
import { BotKeys } from "@/components/settings/bot-keys";

export const metadata: Metadata = {
  title: "Bots",
  description: "Create a key so Grok can read texts and update ClientHub.",
};

export default async function BotsSettingsPage() {
  const [bots, appUrl] = await Promise.all([
    prisma.botToken.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    }),
    getAppUrl(),
  ]);

  return (
    <FormPanel
      title="Grok bots"
      description="A key for a bot to look up customers, text a customer or teammate, read the inbox, and update tasks. It cannot delete, change settings, or touch Stripe."
      icon={Bot}
    >
      <BotKeys
        apiBase={`${appUrl.replace(/\/$/, "")}/api/v1`}
        bots={bots.map((bot) => ({
          id: bot.id,
          name: bot.name,
          prefix: bot.prefix,
          scopes: bot.scopes,
          createdAt: formatDateTime(bot.createdAt),
          lastUsedAt: bot.lastUsedAt ? formatDateTime(bot.lastUsedAt) : null,
          revoked: Boolean(bot.revokedAt),
        }))}
      />
    </FormPanel>
  );
}
