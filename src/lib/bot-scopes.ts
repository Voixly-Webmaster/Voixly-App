export const BOT_SCOPES = [
  "customers:read",
  "texts:read",
  "texts:reply",
  "tasks:write",
  "billing:read",
  "support:read",
  "support:write",
] as const;

export type BotScope = (typeof BOT_SCOPES)[number];

export const INBOX_SCOPES: BotScope[] = [
  "customers:read",
  "texts:read",
  "texts:reply",
  "tasks:write",
];

const SCOPE_SET = new Set<string>(BOT_SCOPES);

export function parseScopes(value: string): BotScope[] {
  const seen = new Set<BotScope>();
  for (const part of value.split(/\s+/)) {
    if (SCOPE_SET.has(part)) seen.add(part as BotScope);
  }
  return [...seen];
}

export function scopesToString(scopes: BotScope[]): string {
  return BOT_SCOPES.filter((scope) => scopes.includes(scope)).join(" ");
}
