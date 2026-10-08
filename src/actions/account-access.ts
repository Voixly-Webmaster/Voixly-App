"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { AuthChallengePurpose, TwoFactorChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { verifyPassword } from "@/lib/credentials";
import { requireAdminRole, requireAuth } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { normalizePhone } from "@/lib/phone";
import {
  assertPassword,
  dummyPasswordCheck,
  normalizeEmail,
  safeNextPath,
} from "@/lib/passwords";
import {
  consumePasswordReset,
  deliveryReady,
  enabledChannels,
  issueChallenge,
  issueLoginTicket,
  requestPasswordReset,
  revokeSignInMaterial,
  verifyChallenge,
} from "@/lib/auth-codes";

function isRedirect(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function revalidateSecurity() {
  revalidatePath("/admin/security");
  revalidatePath("/portal/profile");
  revalidatePath("/admin/settings/users");
}

export async function beginSignIn(input: { email: string; password: string }) {
  const user = await verifyPassword(input.email, input.password);
  if (!user) return { status: "invalid" as const };

  const channels = enabledChannels(user);
  if (channels.length === 0) {
    const ticket = await issueLoginTicket(user.id);
    return { status: "ticket" as const, email: user.email, ticket };
  }

  let lastError = "Could not send a sign-in code";
  for (const channel of channels) {
    const sent = await issueChallenge({
      user,
      purpose: AuthChallengePurpose.LOGIN,
      channel,
    });
    if (!sent.ok) {
      lastError = sent.error;
      continue;
    }
    return {
      status: "2fa" as const,
      challengeId: sent.challengeId,
      channel,
      destination: sent.masked,
      channels,
    };
  }

  return { status: "error" as const, message: lastError };
}

export async function resendSignInCode(
  challengeId: string,
  channel: TwoFactorChannel
) {
  const existing = await prisma.authChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true },
  });
  if (
    !existing ||
    existing.purpose !== AuthChallengePurpose.LOGIN ||
    existing.consumedAt ||
    existing.expiresAt.getTime() < Date.now() ||
    existing.user.deletedAt
  ) {
    return {
      status: "error" as const,
      message: "Sign in again to get a new code.",
    };
  }

  const channels = enabledChannels(existing.user);
  if (!channels.includes(channel)) {
    return { status: "error" as const, message: "That method is not turned on." };
  }

  const sent = await issueChallenge({
    user: existing.user,
    purpose: AuthChallengePurpose.LOGIN,
    channel,
  });
  if (!sent.ok) return { status: "error" as const, message: sent.error };

  return {
    status: "2fa" as const,
    challengeId: sent.challengeId,
    channel,
    destination: sent.masked,
    channels,
  };
}

export async function verifySignInCode(challengeId: string, code: string) {
  const result = await verifyChallenge({
    challengeId,
    code,
    purpose: AuthChallengePurpose.LOGIN,
  });
  if (!result.ok) return { status: "invalid" as const, message: result.error };

  const user = await prisma.user.findFirst({
    where: { id: result.userId, deletedAt: null },
  });
  if (!user) {
    return { status: "invalid" as const, message: "That code is incorrect or expired" };
  }

  const ticket = await issueLoginTicket(user.id);
  return { status: "ticket" as const, email: user.email, ticket };
}

export async function finishSignIn(
  email: string,
  ticket: string,
  callbackUrl: string
) {
  try {
    await signIn("credentials", {
      email,
      loginTicket: ticket,
      redirectTo: safeNextPath(callbackUrl),
    });
  } catch (err) {
    if (isRedirect(err)) throw err;
    if (err instanceof AuthError) redirect("/login?error=credentials");
    console.error("[login]", err);
    redirect("/login?error=server");
  }
}

export async function requestPasswordResetAction(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return { ok: true as const };

  const user = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
  });
  if (user?.passwordHash) {
    await requestPasswordReset(user);
  } else {
    await dummyPasswordCheck(normalized);
  }
  return { ok: true as const };
}

export async function resetPasswordWithToken(
  token: string,
  password: string,
  confirm: string
) {
  const problem = assertPassword(password);
  if (problem) return { ok: false as const, error: problem };
  if (password !== confirm) {
    return { ok: false as const, error: "Passwords do not match" };
  }

  const user = await consumePasswordReset(token);
  if (!user) {
    return {
      ok: false as const,
      error: "This reset link is invalid or expired. Request a new one.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      passwordChangedAt: new Date(),
    },
  });
  await revokeSignInMaterial(user.id);
  await logActivity({
    actorId: user.id,
    action: "user.password_changed",
    entityType: "user",
    entityId: user.id,
  });
  return { ok: true as const };
}

export async function changePassword(
  current: string,
  password: string,
  confirm: string
) {
  const session = await requireAuth();
  const problem = assertPassword(password);
  if (problem) throw new Error(problem);
  if (password !== confirm) throw new Error("Passwords do not match");

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash || user.deletedAt) throw new Error("Account not found");

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");
  if (await bcrypt.compare(password, user.passwordHash)) {
    throw new Error("Choose a different password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      passwordChangedAt: new Date(),
    },
  });
  await revokeSignInMaterial(user.id);
  await logActivity({
    actorId: user.id,
    action: "user.password_changed",
    entityType: "user",
    entityId: user.id,
  });
}

export async function sendTwoFactorCode(channel: TwoFactorChannel, phone: string) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || user.deletedAt) throw new Error("Account not found");

  const ready = await deliveryReady();
  let phoneOverride: string | null = null;
  if (channel === TwoFactorChannel.SMS) {
    if (!ready.sms) throw new Error("Text messaging is not set up yet");
    phoneOverride = normalizePhone(phone);
    if (!phoneOverride) {
      throw new Error("Enter a mobile number with country code, like +1 555 123 4567");
    }
  } else if (!ready.email) {
    throw new Error("Email delivery is not set up yet");
  }

  const sent = await issueChallenge({
    user,
    purpose: AuthChallengePurpose.ENABLE,
    channel,
    phoneOverride,
  });
  if (!sent.ok) throw new Error(sent.error);
  return { challengeId: sent.challengeId, destination: sent.masked };
}

export async function confirmTwoFactor(challengeId: string, code: string) {
  const session = await requireAuth();
  const result = await verifyChallenge({
    challengeId,
    code,
    purpose: AuthChallengePurpose.ENABLE,
    userId: session.id,
  });
  if (!result.ok) throw new Error(result.error);

  if (result.channel === TwoFactorChannel.EMAIL) {
    await prisma.user.update({
      where: { id: session.id },
      data: { twoFactorEmail: true },
    });
  } else {
    await prisma.user.update({
      where: { id: session.id },
      data: { twoFactorSms: true, twoFactorPhone: result.destination },
    });
  }

  await logActivity({
    actorId: session.id,
    action: "user.two_factor_enabled",
    entityType: "user",
    entityId: session.id,
    metadata: { channel: result.channel },
  });
  revalidateSecurity();
}

export async function sendDisableCode(channel: TwoFactorChannel, password: string) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash || user.deletedAt) throw new Error("Account not found");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");
  if (channel === TwoFactorChannel.EMAIL && !user.twoFactorEmail) {
    throw new Error("Email codes are already off");
  }
  if (channel === TwoFactorChannel.SMS && !user.twoFactorSms) {
    throw new Error("Text codes are already off");
  }

  const sent = await issueChallenge({
    user,
    purpose: AuthChallengePurpose.DISABLE,
    channel,
  });
  if (!sent.ok) throw new Error(sent.error);
  return { challengeId: sent.challengeId, destination: sent.masked };
}

export async function confirmDisableTwoFactor(challengeId: string, code: string) {
  const session = await requireAuth();
  const result = await verifyChallenge({
    challengeId,
    code,
    purpose: AuthChallengePurpose.DISABLE,
    userId: session.id,
  });
  if (!result.ok) throw new Error(result.error);

  await prisma.user.update({
    where: { id: session.id },
    data:
      result.channel === TwoFactorChannel.EMAIL
        ? { twoFactorEmail: false }
        : { twoFactorSms: false },
  });
  await logActivity({
    actorId: session.id,
    action: "user.two_factor_disabled",
    entityType: "user",
    entityId: session.id,
    metadata: { channel: result.channel },
  });
  revalidateSecurity();
}

export async function clearUserTwoFactor(userId: string) {
  const admin = await requireAdminRole();
  if (userId === admin.id) {
    throw new Error("Turn off your own codes from Security");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (!user.twoFactorEmail && !user.twoFactorSms) return;

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEmail: false, twoFactorSms: false },
  });
  await revokeSignInMaterial(userId);
  await logActivity({
    actorId: admin.id,
    action: "user.two_factor_disabled",
    entityType: "user",
    entityId: userId,
    metadata: { byAdmin: true },
  });
  revalidateSecurity();
}
