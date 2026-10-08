import {
  AuthChallengePurpose,
  TwoFactorChannel,
  type User,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { passwordResetEmailHtml, sendEmail, signInCodeEmailHtml } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { maskEmail, maskPhone } from "@/lib/phone";
import { getAppUrl } from "@/lib/app-url";
import {
  cleanCode,
  codeHash,
  hashesMatch,
  newSecret,
  newSignInCode,
  normalizeEmail,
  resetHash,
  ticketHash,
} from "@/lib/passwords";

const CODE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SEND_COOLDOWN_MS = 30 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_SENDS = 5;
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_SENDS = 3;

export function enabledChannels(user: {
  twoFactorEmail: boolean;
  twoFactorSms: boolean;
  twoFactorPhone: string | null;
}): TwoFactorChannel[] {
  const channels: TwoFactorChannel[] = [];
  if (user.twoFactorEmail) channels.push(TwoFactorChannel.EMAIL);
  if (user.twoFactorSms && user.twoFactorPhone) channels.push(TwoFactorChannel.SMS);
  return channels;
}

export async function deliveryReady(): Promise<{ email: boolean; sms: boolean }> {
  const settings = await getSettings(["resend.apiKey", "voidfix.apiKey"]);
  const dev = process.env.NODE_ENV !== "production";
  return {
    email: Boolean(settings["resend.apiKey"]) || dev,
    sms: Boolean(settings["voidfix.apiKey"]) || dev,
  };
}

function destinationFor(
  user: { email: string; twoFactorPhone: string | null },
  channel: TwoFactorChannel,
  phoneOverride?: string | null
): string | null {
  if (channel === TwoFactorChannel.EMAIL) return user.email;
  return phoneOverride || user.twoFactorPhone;
}

export function maskDestination(channel: TwoFactorChannel, destination: string): string {
  return channel === TwoFactorChannel.EMAIL
    ? maskEmail(destination)
    : maskPhone(destination);
}

function codeCopy(purpose: AuthChallengePurpose, channel: TwoFactorChannel): {
  subject: string;
  reason: string;
  sms: string;
} {
  if (purpose === AuthChallengePurpose.LOGIN) {
    return {
      subject: "Your Voixly sign-in code",
      reason: "Sign-in code",
      sms: "Voixly sign-in code",
    };
  }
  if (purpose === AuthChallengePurpose.ENABLE) {
    return channel === TwoFactorChannel.EMAIL
      ? {
          subject: "Confirm email sign-in codes",
          reason: "Confirm email sign-in codes",
          sms: "Voixly code",
        }
      : {
          subject: "Confirm text sign-in codes",
          reason: "Confirm text sign-in codes",
          sms: "Voixly code to turn on text sign-in",
        };
  }
  return channel === TwoFactorChannel.EMAIL
    ? {
        subject: "Turn off email sign-in codes",
        reason: "Turn off email sign-in codes",
        sms: "Voixly code",
      }
    : {
        subject: "Turn off text sign-in codes",
        reason: "Turn off text sign-in codes",
        sms: "Voixly code to turn off text sign-in",
      };
}

async function deliver(params: {
  channel: TwoFactorChannel;
  destination: string;
  code: string;
  purpose: AuthChallengePurpose;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const copy = codeCopy(params.purpose, params.channel);
  const minutes = CODE_TTL_MS / 60_000;

  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth-code] ${params.channel} ${params.destination} ${params.code}`);
  }

  if (params.channel === TwoFactorChannel.EMAIL) {
    const result = await sendEmail({
      to: params.destination,
      subject: copy.subject,
      html: signInCodeEmailHtml({
        code: params.code,
        minutes,
        reason: copy.reason,
      }),
    });
    if ("dev" in result && result.dev && process.env.NODE_ENV === "production") {
      return { ok: false, error: "Email is not configured" };
    }
    if (!result.ok) return { ok: false, error: "Could not send the email" };
    return { ok: true };
  }

  const result = await sendSms({
    to: params.destination,
    message: `${copy.sms}: ${params.code}. It expires in ${minutes} minutes.`,
  });
  if ("dev" in result && result.dev && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Text messaging is not configured" };
  }
  if (!result.ok) return { ok: false, error: "Could not send the text message" };
  return { ok: true };
}

export async function issueChallenge(params: {
  user: { id: string; email: string; twoFactorPhone: string | null };
  purpose: AuthChallengePurpose;
  channel: TwoFactorChannel;
  phoneOverride?: string | null;
}): Promise<
  | { ok: true; challengeId: string; destination: string; masked: string }
  | { ok: false; error: string }
> {
  const destination = destinationFor(params.user, params.channel, params.phoneOverride);
  if (!destination) return { ok: false, error: "Add a mobile number first" };

  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const recent = await prisma.authChallenge.count({
    where: {
      userId: params.user.id,
      purpose: params.purpose,
      createdAt: { gt: since },
    },
  });
  if (recent >= LOGIN_MAX_SENDS) {
    return { ok: false, error: "Too many codes. Wait a few minutes and try again." };
  }

  const latest = await prisma.authChallenge.findFirst({
    where: { userId: params.user.id, purpose: params.purpose },
    orderBy: { createdAt: "desc" },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < SEND_COOLDOWN_MS) {
    return { ok: false, error: "Wait 30 seconds before requesting another code." };
  }

  const code = newSignInCode();
  const sent = await deliver({
    channel: params.channel,
    destination,
    code,
    purpose: params.purpose,
  });
  if (!sent.ok) return sent;

  await prisma.authChallenge.updateMany({
    where: { userId: params.user.id, purpose: params.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const challenge = await prisma.authChallenge.create({
    data: {
      userId: params.user.id,
      purpose: params.purpose,
      channel: params.channel,
      destination,
      codeHash: codeHash({
        purpose: params.purpose,
        userId: params.user.id,
        code,
      }),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  return {
    ok: true,
    challengeId: challenge.id,
    destination,
    masked: maskDestination(params.channel, destination),
  };
}

export async function verifyChallenge(params: {
  challengeId: string;
  code: string;
  purpose: AuthChallengePurpose;
  userId?: string;
}): Promise<
  | { ok: true; userId: string; channel: TwoFactorChannel; destination: string }
  | { ok: false; error: string }
> {
  const code = cleanCode(params.code);
  if (!code) return { ok: false, error: "Enter the 6-digit code" };

  const challenge = await prisma.authChallenge.findUnique({
    where: { id: params.challengeId },
  });
  if (
    !challenge ||
    challenge.purpose !== params.purpose ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() < Date.now() ||
    (params.userId && challenge.userId !== params.userId)
  ) {
    return { ok: false, error: "That code is incorrect or expired" };
  }

  const attempts = challenge.attempts + 1;
  if (attempts > MAX_ATTEMPTS) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: { attempts, consumedAt: new Date() },
    });
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const expected = codeHash({
    purpose: challenge.purpose,
    userId: challenge.userId,
    code,
  });
  if (!hashesMatch(challenge.codeHash, expected)) {
    await prisma.authChallenge.update({
      where: { id: challenge.id },
      data: {
        attempts,
        consumedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
      },
    });
    return {
      ok: false,
      error:
        attempts >= MAX_ATTEMPTS
          ? "Too many attempts. Request a new code."
          : "That code is incorrect or expired",
    };
  }

  const consumed = await prisma.authChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date(), attempts },
  });
  if (consumed.count !== 1) {
    return { ok: false, error: "That code is incorrect or expired" };
  }

  return {
    ok: true,
    userId: challenge.userId,
    channel: challenge.channel,
    destination: challenge.destination,
  };
}

export async function issueLoginTicket(userId: string): Promise<string> {
  const raw = newSecret();
  await prisma.loginTicket.deleteMany({
    where: { userId, usedAt: null },
  });
  await prisma.loginTicket.create({
    data: {
      userId,
      tokenHash: ticketHash(raw),
      expiresAt: new Date(Date.now() + TICKET_TTL_MS),
    },
  });
  return raw;
}

export async function consumeLoginTicket(email: string, raw: string) {
  if (!raw) return null;
  const tokenHash = ticketHash(raw);
  const ticket = await prisma.loginTicket.findUnique({
    where: { tokenHash },
    include: {
      user: { include: { clientProfile: true, staffProfile: true } },
    },
  });
  if (!ticket || ticket.usedAt || ticket.expiresAt.getTime() < Date.now()) return null;
  if (ticket.user.deletedAt) return null;
  if (normalizeEmail(ticket.user.email) !== normalizeEmail(email)) return null;

  const claimed = await prisma.loginTicket.updateMany({
    where: { id: ticket.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  return ticket.user;
}

export async function revokeSignInMaterial(userId: string): Promise<void> {
  await prisma.loginTicket.deleteMany({ where: { userId } });
  await prisma.authChallenge.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function requestPasswordReset(user: User): Promise<void> {
  const since = new Date(Date.now() - RESET_WINDOW_MS);
  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: since } },
  });
  if (recent >= RESET_MAX_SENDS) return;

  const raw = newSecret();
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: resetHash(raw),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  const appUrl = await getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(raw)}`;
  if (process.env.NODE_ENV !== "production") {
    console.info("[password-reset]", user.email, resetUrl);
  }
  const result = await sendEmail({
    to: user.email,
    subject: "Reset your Voixly password",
    html: passwordResetEmailHtml({ resetUrl }),
  });
  if (!result.ok && process.env.NODE_ENV === "production") {
    console.error("[password-reset] email failed", user.email);
  }
}

export async function consumePasswordReset(raw: string) {
  if (!raw) return null;
  const tokenHash = resetHash(raw);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) return null;
  if (row.user.deletedAt || !row.user.passwordHash) return null;

  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  return row.user;
}
