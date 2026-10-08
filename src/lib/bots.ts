import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseScopes, type BotScope } from "@/lib/bot-scopes";

export type { BotScope } from "@/lib/bot-scopes";
const WINDOW_MS = 60_000;
const LIMIT = 60;
const FAILURE_LIMIT = 30;

const hits = new Map<string, number[]>();
const failures = new Map<string, number[]>();

export type BotContext = {
  id: string;
  name: string;
  createdById: string;
  scopes: BotScope[];
};

export function botJson(body: unknown, status = 200, extra?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extra },
  });
}

export function botError(status: number, error: string, extra?: HeadersInit) {
  return botJson({ error }, status, extra);
}

export function generateBotToken(): { secret: string; hash: string; prefix: string } {
  const secret = `vx_live_${randomBytes(32).toString("base64url")}`;
  return { secret, hash: hashBotToken(secret), prefix: secret.slice(0, 16) };
}

export function hashBotToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function allow(bucket: Map<string, number[]>, key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (bucket.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= limit) {
    bucket.set(key, recent);
    return false;
  }
  recent.push(now);
  bucket.set(key, recent);
  if (bucket.size > 2000) {
    for (const [id, times] of bucket) {
      if (times.every((at) => now - at >= WINDOW_MS)) bucket.delete(id);
    }
  }
  return true;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

function rejectedKey(req: Request, message: string): Response {
  if (!allow(failures, `ip:${clientIp(req)}`, FAILURE_LIMIT)) {
    return botError(429, "Too many requests. Try again in a minute.", { "Retry-After": "60" });
  }
  return botError(401, message);
}

async function authenticate(req: Request): Promise<BotContext | Response> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(vx_live_[A-Za-z0-9_-]{20,})$/.exec(header);
  if (!match) {
    return rejectedKey(req, "Send a bot key as Authorization: Bearer vx_live_…");
  }

  const row = await prisma.botToken.findUnique({
    where: { tokenHash: hashBotToken(match[1]) },
    select: {
      id: true,
      name: true,
      scopes: true,
      revokedAt: true,
      createdById: true,
      createdBy: { select: { deletedAt: true, role: true } },
    },
  });
  if (
    !row ||
    row.revokedAt ||
    row.createdBy.deletedAt ||
    row.createdBy.role !== UserRole.ADMIN
  ) {
    return rejectedKey(req, "That bot key is not valid");
  }

  return {
    id: row.id,
    name: row.name,
    createdById: row.createdById,
    scopes: parseScopes(row.scopes),
  };
}

export async function withBot(
  req: Request,
  scope: BotScope | null,
  handler: (bot: BotContext) => Promise<Response>
): Promise<Response> {
  try {
    const bot = await authenticate(req);
    if (bot instanceof Response) return bot;
    if (scope && !bot.scopes.includes(scope)) {
      return botError(403, "This bot cannot do that");
    }
    if (!allow(hits, bot.id, LIMIT)) {
      return botError(429, "Too many requests. Try again in a minute.", { "Retry-After": "60" });
    }

    void prisma.botToken
      .update({ where: { id: bot.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => console.error("[bots] last used failed", err));

    const write = req.method === "POST" || req.method === "PATCH";
    if (!write) return handler(bot);

    const key = req.headers.get("idempotency-key")?.trim() ?? "";
    if (key.length < 8 || key.length > 128 || /[^\x21-\x7e]/.test(key)) {
      return botError(400, "Send an Idempotency-Key header");
    }
    const path = new URL(req.url).pathname;
    try {
      await prisma.botIdempotency.create({
        data: { tokenId: bot.id, key, method: req.method, path, status: 0, body: "" },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
      const existing = await prisma.botIdempotency.findUnique({
        where: { tokenId_key: { tokenId: bot.id, key } },
      });
      if (!existing || existing.method !== req.method || existing.path !== path) {
        return botError(409, "That Idempotency-Key was already used for a different request");
      }
      if (existing.status === 0) return botError(409, "That request is already in progress");
      return new Response(existing.body, {
        status: existing.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const response = await handler(bot);
    const text = await response.clone().text();
    if (response.status >= 500) {
      await prisma.botIdempotency.deleteMany({ where: { tokenId: bot.id, key } });
      return new Response(text, {
        status: response.status,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    await prisma.botIdempotency.update({
      where: { tokenId_key: { tokenId: bot.id, key } },
      data: { status: response.status, body: text.slice(0, 20_000) },
    });
    return new Response(text, {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[bots] request failed", err);
    return botError(500, "Something went wrong");
  }
}
