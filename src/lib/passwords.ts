import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { authSecret } from "@/lib/database-url";

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function assertPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

let dummyHash: string | null = null;

/** Spend a bcrypt compare even when the account does not exist. */
export async function dummyPasswordCheck(password: string): Promise<void> {
  dummyHash ??= await bcrypt.hash("invalid-password-placeholder", 12);
  await bcrypt.compare(password, dummyHash);
}

function hmac(label: string, value: string): string {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is required");
  return createHmac("sha256", secret).update(`${label}:${value}`).digest("hex");
}

export function hashesMatch(stored: string, computed: string): boolean {
  const left = Buffer.from(stored);
  const right = Buffer.from(computed);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function ticketHash(raw: string): string {
  return hmac("ticket", raw);
}

export function resetHash(raw: string): string {
  return hmac("reset", raw);
}

export function newSignInCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function codeHash(params: {
  purpose: string;
  userId: string;
  code: string;
}): string {
  return hmac("code", `${params.purpose}:${params.userId}:${params.code}`);
}

export function cleanCode(value: string): string | null {
  const code = value.replace(/\D/g, "");
  return code.length === 6 ? code : null;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  let path = value.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return "/";
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("://")) {
    return "/";
  }
  return path;
}
