import crypto from "crypto";
import { prisma } from "@/lib/db";

/**
 * App settings stored in the database, editable from Admin → Settings.
 * Every setting falls back to its environment variable when no DB value
 * is saved, so existing .env-based deployments keep working unchanged.
 * Secret values are encrypted at rest with a key derived from AUTH_SECRET.
 */

const ENC_PREFIX = "enc:v1:";

export const SETTING_DEFS = {
  "app.name": { env: null, secret: false, label: "App name" },
  "app.url": { env: "APP_URL", secret: false, label: "App URL" },
  "app.supportEmail": { env: null, secret: false, label: "Support email" },
  "stripe.secretKey": { env: "STRIPE_SECRET_KEY", secret: true, label: "Stripe secret key" },
  "stripe.publishableKey": { env: "STRIPE_PUBLISHABLE_KEY", secret: false, label: "Stripe publishable key" },
  "stripe.webhookSecret": { env: "STRIPE_WEBHOOK_SECRET", secret: true, label: "Stripe webhook secret" },
  "resend.apiKey": { env: "RESEND_API_KEY", secret: true, label: "Resend API key" },
  "resend.fromEmail": { env: "RESEND_FROM_EMAIL", secret: false, label: "From email" },
  "voidfix.apiKey": { env: "VOIDFIX_API_KEY", secret: true, label: "VoidFix API key" },
  "voidfix.deviceId": { env: "VOIDFIX_DEVICE_ID", secret: false, label: "VoidFix device ID" },
  "google.clientId": { env: "GOOGLE_CLIENT_ID", secret: false, label: "Google client ID" },
  "google.clientSecret": { env: "GOOGLE_CLIENT_SECRET", secret: true, label: "Google client secret" },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) must be set to store settings");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(stored: string): string {
  const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function envValue(key: SettingKey): string | null {
  const envVar = SETTING_DEFS[key].env;
  if (!envVar) return null;
  return process.env[envVar]?.trim() || null;
}

/** Resolved value: DB (decrypted) first, then environment variable. */
export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.value) {
    try {
      return row.value.startsWith(ENC_PREFIX) ? decrypt(row.value) : row.value;
    } catch {
      // AUTH_SECRET changed since the value was saved — fall back to env
      return envValue(key);
    }
  }
  return envValue(key);
}

export async function getSettings<K extends SettingKey>(
  keys: K[]
): Promise<Record<K, string | null>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<K, string | null>;
  for (const key of keys) {
    const stored = byKey.get(key);
    if (stored) {
      try {
        result[key] = stored.startsWith(ENC_PREFIX) ? decrypt(stored) : stored;
        continue;
      } catch {
        // fall through to env
      }
    }
    result[key] = envValue(key);
  }
  return result;
}

/**
 * Save a setting. Empty/null removes the DB override (reverting to the
 * env var, if any). Secret settings are encrypted before storage.
 */
export async function setSetting(key: SettingKey, value: string | null): Promise<void> {
  const trimmed = value?.trim();
  if (!trimmed) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  const stored = SETTING_DEFS[key].secret ? encrypt(trimmed) : trimmed;
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: stored },
    create: { key, value: stored },
  });
}

export type SettingStatus = {
  key: SettingKey;
  secret: boolean;
  /** Plaintext value for non-secret settings; null for secrets. */
  value: string | null;
  /** Whether any value (DB or env) is currently in effect. */
  isSet: boolean;
  /** Where the effective value comes from. */
  source: "database" | "environment" | null;
};

/** Status for the settings UI — never exposes secret plaintext. */
export async function getSettingsStatus(keys: SettingKey[]): Promise<SettingStatus[]> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });
  const dbKeys = new Set(rows.map((r) => r.key));
  const resolved = await getSettings(keys);

  return keys.map((key) => {
    const def = SETTING_DEFS[key];
    const value = resolved[key];
    return {
      key,
      secret: def.secret,
      value: def.secret ? null : value,
      isSet: Boolean(value),
      source: dbKeys.has(key) ? "database" : value ? "environment" : null,
    };
  });
}
