"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import bcrypt from "bcryptjs";
import {
  ClientTier,
  InvoiceStatus,
  RecurringStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/session-guard";
import { logActivity } from "@/lib/activity";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/message-templates";
import { getAppUrl } from "@/lib/app-url";
import { generateInvoiceNumber, intervalLabel } from "@/lib/billing";
import { normalizePhone } from "@/lib/phone";
import { assertPassword, inviteHash, newSecret } from "@/lib/passwords";
import { formatCurrency } from "@/lib/utils";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function parseClientTier(value: unknown): ClientTier | null {
  if (
    value === "PLATINUM" ||
    value === "GOLD" ||
    value === "SILVER" ||
    value === "BRONZE"
  ) {
    return value;
  }
  return null;
}

function databaseCode(err: unknown): string | null {
  if (typeof err !== "object" || err === null || !("code" in err)) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && /^P\d+$/.test(code) ? code : null;
}

async function issueInvite(userId: string): Promise<string> {
  const raw = newSecret();
  await prisma.accountInvite.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.accountInvite.create({
    data: {
      userId,
      tokenHash: inviteHash(raw),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return raw;
}

function roleLabel(role: UserRole): string {
  if (role === UserRole.ADMIN) return "Admin";
  if (role === UserRole.STAFF) return "Staff";
  return "Client";
}

async function sendInviteEmail(params: {
  email: string;
  name: string;
  company: string;
  product: string;
  amount: string;
  interval: string;
  setupUrl: string;
}): Promise<boolean> {
  try {
    const rendered = await renderEmail("client-invite", {
      greeting: params.name ? `Hi ${params.name},` : "Hi,",
      name: params.name,
      company: params.company,
      email: params.email,
      product: params.product,
      amount: params.amount,
      interval: params.interval,
      url: params.setupUrl,
    });
    const result = await sendEmail({
      to: params.email,
      subject: rendered.subject,
      html: rendered.html,
    });
    if ("dev" in result && result.dev && process.env.NODE_ENV === "production") return false;
    if (process.env.NODE_ENV !== "production") {
      console.info("[invite]", params.email, params.setupUrl);
    }
    return result.ok;
  } catch (err) {
    console.error("[invite] email failed", err);
    return false;
  }
}

async function setupUrlFor(raw: string): Promise<string> {
  return `${await getAppUrl()}/invite?token=${encodeURIComponent(raw)}`;
}

export async function sendTeamSetupInvite(params: {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}): Promise<boolean> {
  const raw = await issueInvite(params.userId);
  const setupUrl = await setupUrlFor(raw);
  try {
    const rendered = await renderEmail("team-invite", {
      greeting: params.name ? `Hi ${params.name},` : "Hi,",
      name: params.name,
      email: params.email,
      role: roleLabel(params.role),
      url: setupUrl,
    });
    const result = await sendEmail({
      to: params.email,
      subject: rendered.subject,
      html: rendered.html,
    });
    if ("dev" in result && result.dev && process.env.NODE_ENV === "production") return false;
    if (process.env.NODE_ENV !== "production") {
      console.info("[invite]", params.email, setupUrl);
    }
    return result.ok;
  } catch (err) {
    console.error("[invite] team email failed", err);
    return false;
  }
}

export async function resendTeamInvite(
  userId: string
): Promise<{ ok: true; emailSent: boolean } | { error: string }> {
  try {
    const admin = await requireAdminRole();
    if (!userId) return { error: "Choose a teammate" };
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null, role: { in: [UserRole.STAFF, UserRole.ADMIN] } },
    });
    if (!user) return { error: "That teammate was not found" };
    if (user.passwordHash) return { error: "This teammate already finished setup" };

    const emailSent = await sendTeamSetupInvite({
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      role: user.role,
    });

    try {
      await logActivity({
        actorId: admin.id,
        action: "user.invite_resent",
        entityType: "user",
        entityId: user.id,
        metadata: { email: user.email, emailSent },
      });
    } catch (err) {
      console.error("[invite] activity log failed", err);
    }

    revalidatePath("/admin/settings/users");
    return { ok: true, emailSent };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[invite] team resend failed", err);
    return { error: "Could not resend the invite. Try again." };
  }
}

export async function inviteClient(
  formData: FormData
): Promise<{ ok: true; emailSent: boolean } | { error: string }> {
  try {
    const admin = await requireAdminRole();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const name = String(formData.get("name") ?? "").trim();
    const companyName = String(formData.get("companyName") ?? "").trim();
    const tier = parseClientTier(formData.get("tier"));
    const productId = String(formData.get("productId") ?? "").trim();

    if (!name) return { error: "Name is required" };
    if (!email || !email.includes("@")) return { error: "Enter a valid email" };
    if (!companyName) return { error: "Company name is required" };
    if (!productId) return { error: "Choose a product" };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return {
        error: existing.passwordHash
          ? "A user with that email already exists"
          : "That email already has an invite. Open the client and resend it.",
      };
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, active: true, deletedAt: null },
    });
    if (!product) return { error: "That product is not available" };

    const invoiceNumber = await generateInvoiceNumber();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    dueDate.setHours(12, 0, 0, 0);

    const clientUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          role: UserRole.CLIENT,
          clientProfile: {
            create: { companyName, contactName: name, tier },
          },
        },
        include: { clientProfile: true },
      });
      const clientId = created.clientProfile?.id;
      if (!clientId) throw new Error("Client profile was not created");
      await tx.recurringInvoice.create({
        data: {
          clientId,
          productId: product.id,
          title: product.name,
          description: product.description,
          amountCents: product.amountCents,
          interval: product.interval,
          status: RecurringStatus.PENDING,
          createdById: admin.id,
          invoices: {
            create: {
              clientId,
              invoiceNumber,
              title: product.name,
              description: product.description,
              amountCents: product.amountCents,
              status: InvoiceStatus.SENT,
              dueDate,
              sentAt: new Date(),
            },
          },
        },
      });
      return created;
    });

    const clientId = clientUser.clientProfile?.id;
    const raw = await issueInvite(clientUser.id);
    const emailSent = await sendInviteEmail({
      email,
      name,
      company: companyName,
      product: product.name,
      amount: formatCurrency(product.amountCents),
      interval: intervalLabel(product.interval),
      setupUrl: await setupUrlFor(raw),
    });

    try {
      await logActivity({
        actorId: admin.id,
        clientId,
        action: "client.invited",
        entityType: "client",
        entityId: clientId,
        metadata: {
          email,
          product: product.name,
          tier,
          emailSent,
        },
      });
    } catch (err) {
      console.error("[invite] activity log failed", err);
    }

    revalidatePath("/admin/clients");
    revalidatePath("/admin/invoices");
    return { ok: true, emailSent };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[invite] create failed", err);
    if (databaseCode(err) === "P2002") {
      return { error: "A user with that email already exists" };
    }
    const code = databaseCode(err);
    return {
      error: code ? `Could not send the invite (${code}).` : "Could not send the invite. Try again.",
    };
  }
}

export async function resendClientInvite(
  clientId: string
): Promise<{ ok: true; emailSent: boolean } | { error: string }> {
  try {
    const admin = await requireAdminRole();
    const client = await prisma.client.findFirst({
      where: { id: clientId, deletedAt: null },
      include: {
        user: true,
        recurringInvoices: {
          where: { status: { not: RecurringStatus.CANCELLED } },
          include: { product: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!client) return { error: "Client not found" };
    if (client.user.passwordHash) return { error: "This customer already finished setup" };

    const service = client.recurringInvoices[0];
    const raw = await issueInvite(client.user.id);
    const emailSent = await sendInviteEmail({
      email: client.user.email,
      name: client.contactName ?? client.user.name ?? "",
      company: client.companyName,
      product: service?.product?.name ?? service?.title ?? "your Voixly service",
      amount: service ? formatCurrency(service.amountCents) : "",
      interval: service ? intervalLabel(service.interval) : "",
      setupUrl: await setupUrlFor(raw),
    });

    try {
      await logActivity({
        actorId: admin.id,
        clientId: client.id,
        action: "client.invite_resent",
        entityType: "client",
        entityId: client.id,
        metadata: { email: client.user.email, emailSent },
      });
    } catch (err) {
      console.error("[invite] activity log failed", err);
    }

    revalidatePath(`/admin/clients/${client.id}`);
    return { ok: true, emailSent };
  } catch (err) {
    unstable_rethrow(err);
    console.error("[invite] resend failed", err);
    return { error: "Could not resend the invite. Try again." };
  }
}

export type InvitePreview = {
  email: string;
  name: string;
  kind: "client" | "team";
  roleLabel: string;
  company: string;
  product: string;
  description: string | null;
  amount: string;
  interval: string;
};

export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const raw = token.trim();
  if (!raw) return null;
  const invite = await prisma.accountInvite.findUnique({
    where: { tokenHash: inviteHash(raw) },
    include: {
      user: {
        include: {
          clientProfile: {
            include: {
              recurringInvoices: {
                where: { status: { not: RecurringStatus.CANCELLED } },
                include: { product: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt.getTime() < Date.now()) return null;
  const user = invite.user;
  if (user.deletedAt || user.passwordHash) return null;
  const client = user.clientProfile;
  if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
    return {
      email: user.email,
      name: user.name ?? "",
      kind: "team",
      roleLabel: roleLabel(user.role),
      company: "",
      product: "",
      description: null,
      amount: "",
      interval: "",
    };
  }
  if (!client || user.role !== UserRole.CLIENT) return null;
  const service = client.recurringInvoices[0];
  return {
    email: user.email,
    name: client.contactName ?? user.name ?? "",
    kind: "client",
    roleLabel: "Client",
    company: client.companyName,
    product: service?.product?.name ?? service?.title ?? "your Voixly service",
    description: service?.product?.description ?? service?.description ?? null,
    amount: service ? formatCurrency(service.amountCents) : "",
    interval: service ? intervalLabel(service.interval) : "",
  };
}

export async function completeAccountSetup(input: {
  token: string;
  password: string;
  confirm: string;
  phone: string;
  allowSms: boolean;
}): Promise<{ ok: true } | { error: string }> {
  try {
    const raw = input.token.trim();
    if (!raw) return { error: "This invite link is missing. Ask Voixly for a new one." };
    if (input.password !== input.confirm) return { error: "Passwords do not match" };
    const passwordError = assertPassword(input.password);
    if (passwordError) return { error: passwordError };
    if (!input.allowSms) {
      return { error: "Allow text messages to finish setting up your account" };
    }
    const phone = normalizePhone(input.phone);
    if (!phone) return { error: "Enter a mobile number with the area code" };

    const invite = await prisma.accountInvite.findUnique({
      where: { tokenHash: inviteHash(raw) },
      include: { user: { include: { clientProfile: true } } },
    });
    const teamRole =
      invite?.user.role === UserRole.STAFF || invite?.user.role === UserRole.ADMIN;
    if (
      !invite ||
      invite.usedAt ||
      invite.expiresAt.getTime() < Date.now() ||
      invite.user.deletedAt ||
      invite.user.passwordHash ||
      (invite.user.role === UserRole.CLIENT && !invite.user.clientProfile) ||
      (!teamRole && invite.user.role !== UserRole.CLIENT)
    ) {
      return { error: "This invite link has expired. Ask Voixly to send a new one." };
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const clientId = invite.user.clientProfile?.id;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.accountInvite.updateMany({
        where: { id: invite.id, usedAt: null },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new Error("USED");
      await tx.user.update({
        where: { id: invite.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          twoFactorPhone: phone,
          smsConsentAt: now,
        },
      });
      if (clientId) {
        await tx.client.update({
          where: { id: clientId },
          data: { phone },
        });
      }
    });

    try {
      await logActivity(
        clientId
          ? {
              clientId,
              action: "client.setup_completed",
              entityType: "client",
              entityId: clientId,
            }
          : {
              action: "user.setup_completed",
              entityType: "user",
              entityId: invite.userId,
            }
      );
    } catch (err) {
      console.error("[invite] activity log failed", err);
    }

    revalidatePath("/portal");
    revalidatePath("/admin/clients");
    revalidatePath("/admin/settings/users");
    return { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === "USED") {
      return { error: "This invite was already used. Sign in instead." };
    }
    console.error("[invite] setup failed", err);
    return { error: "Could not finish setup. Try again." };
  }
}
