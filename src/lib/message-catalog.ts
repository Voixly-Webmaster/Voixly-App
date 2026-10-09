import {
  codeBlock,
  detailRows,
  emailParagraphs,
  emailShell,
  escapeHtml,
  quoteBlock,
} from "@/lib/email-layout";

export type MessageGroup =
  | "Account"
  | "Billing"
  | "Support"
  | "Announcements"
  | "Sign-in"
  | "Tests";

export type MessageLayout = "plain" | "details" | "quote" | "announcement" | "code";

export type MessageToken = {
  token: string;
  label: string;
  sample: string;
};

export type MessageField = {
  key: string;
  label: string;
  multiline?: boolean;
  defaultValue: string;
  requiredTokens?: string[];
};

export type MessageFlow = {
  id: string;
  group: MessageGroup;
  name: string;
  when: string;
  audience: string;
  layout: MessageLayout;
  buttonHref?: "loginUrl" | "payUrl" | "url" | "resetUrl";
  tokens: MessageToken[];
  fields: MessageField[];
};

export const MESSAGE_GROUPS: MessageGroup[] = [
  "Account",
  "Billing",
  "Support",
  "Announcements",
  "Sign-in",
  "Tests",
];

const SIGN_IN_EMAIL: MessageField[] = [
  { key: "subject", label: "Subject", defaultValue: "" },
  { key: "preheader", label: "Preview text", defaultValue: "" },
  { key: "title", label: "Heading", defaultValue: "" },
  {
    key: "body",
    label: "Body",
    multiline: true,
    defaultValue: "Enter this code to continue. It expires in {{minutes}} minutes.",
  },
  {
    key: "footnote",
    label: "Footnote",
    multiline: true,
    defaultValue: "If you did not request this, you can ignore this email.",
  },
];

function signInEmail(subject: string, title = subject): MessageField[] {
  return SIGN_IN_EMAIL.map((field) => {
    if (field.key === "subject") return { ...field, defaultValue: subject };
    if (field.key === "title") return { ...field, defaultValue: title };
    if (field.key === "preheader") return { ...field, defaultValue: "Your Voixly code is {{code}}" };
    return field;
  });
}

export const MESSAGE_FLOWS: MessageFlow[] = [
  {
    id: "welcome",
    group: "Account",
    name: "Welcome",
    when: "A client login is created",
    audience: "The new client",
    layout: "plain",
    buttonHref: "loginUrl",
    tokens: [
      { token: "greeting", label: "Hi, or Hi and their name", sample: "Hi Jordan Lee," },
      { token: "name", label: "Contact name", sample: "Jordan Lee" },
      { token: "company", label: "Company", sample: "Acme Co" },
      { token: "email", label: "Login email", sample: "jordan@acme.com" },
      { token: "loginUrl", label: "Sign-in link", sample: "https://app.voixly.com/login" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Welcome to your Voixly portal" },
      {
        key: "preheader",
        label: "Preview text",
        defaultValue: "Your Voixly portal for {{company}} is ready.",
      },
      { key: "title", label: "Heading", defaultValue: "Welcome to your portal" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue:
          "{{greeting}}\n\nYour client portal for {{company}} is ready. Sign in to pay invoices, follow your work, share files, and message the Voixly team.",
      },
      { key: "button", label: "Button", defaultValue: "Open your portal" },
      {
        key: "footnote",
        label: "Footnote",
        multiline: true,
        defaultValue:
          "Sign in as {{email}}. Your team will share the password with you. You can choose a new one anytime from the sign-in page.",
      },
    ],
  },
  {
    id: "client-invite",
    group: "Account",
    name: "Customer invite",
    when: "An admin invites a new customer",
    audience: "The new customer",
    layout: "plain",
    buttonHref: "url",
    tokens: [
      { token: "greeting", label: "Hi, or Hi and their name", sample: "Hi Jordan Lee," },
      { token: "name", label: "Contact name", sample: "Jordan Lee" },
      { token: "company", label: "Company", sample: "Acme Co" },
      { token: "email", label: "Login email", sample: "jordan@acme.com" },
      { token: "product", label: "Service", sample: "Website care" },
      { token: "amount", label: "Price", sample: "$250.00" },
      { token: "interval", label: "Billing interval", sample: "monthly" },
      {
        token: "service",
        label: "Service sentence, empty when no product was chosen",
        sample:
          " Your service is Website care, billed monthly at $250.00. Your first invoice will be waiting in Billing.",
      },
      { token: "url", label: "Setup link", sample: "https://app.voixly.com/invite" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Set up your Voixly account" },
      {
        key: "preheader",
        label: "Preview text",
        defaultValue: "Set up your Voixly account for {{company}}.",
      },
      { key: "title", label: "Heading", defaultValue: "You're invited" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue:
          "{{greeting}}\n\n{{company}} has a Voixly ClientHub account waiting.{{service}}\n\nChoose a password and add your mobile number to finish setup.",
      },
      { key: "button", label: "Button", defaultValue: "Set up your account" },
      {
        key: "footnote",
        label: "Footnote",
        multiline: true,
        defaultValue:
          "This link expires in 7 days and is for {{email}}. If you were not expecting it, you can ignore this email.",
      },
    ],
  },
  {
    id: "team-invite",
    group: "Account",
    name: "Team invite",
    when: "An admin invites a staff member or admin to set up their account",
    audience: "The new teammate",
    layout: "plain",
    buttonHref: "url",
    tokens: [
      { token: "greeting", label: "Hi, or Hi and their name", sample: "Hi Jordan Lee," },
      { token: "name", label: "Name", sample: "Jordan Lee" },
      { token: "email", label: "Login email", sample: "jordan@voixly.com" },
      { token: "role", label: "Role", sample: "Staff" },
      { token: "url", label: "Setup link", sample: "https://app.voixly.com/invite" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Set up your Voixly account" },
      {
        key: "preheader",
        label: "Preview text",
        defaultValue: "Finish setting up your Voixly team account.",
      },
      { key: "title", label: "Heading", defaultValue: "You're invited" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue:
          "{{greeting}}\n\nYou have a Voixly team account as {{role}}. Choose a password and add your mobile number to finish setup.",
      },
      { key: "button", label: "Button", defaultValue: "Set up your account" },
      {
        key: "footnote",
        label: "Footnote",
        multiline: true,
        defaultValue:
          "This link expires in 7 days and is for {{email}}. If you were not expecting it, you can ignore this email.",
      },
    ],
  },
  {
    id: "invoice",
    group: "Billing",
    name: "Invoice",
    when: "A one-time invoice is created",
    audience: "That client",
    layout: "details",
    buttonHref: "payUrl",
    tokens: [
      { token: "invoiceNumber", label: "Invoice number", sample: "INV-1042" },
      { token: "item", label: "What it is for", sample: "Website care plan" },
      { token: "amount", label: "Amount", sample: "$250.00" },
      { token: "dueDate", label: "Due date", sample: "Oct 20, 2026" },
      { token: "payUrl", label: "Billing link", sample: "https://app.voixly.com/portal/billing" },
    ],
    fields: [
      {
        key: "subject",
        label: "Subject",
        defaultValue: "Invoice {{invoiceNumber}} — {{item}}",
      },
      {
        key: "preheader",
        label: "Preview text",
        defaultValue: "Invoice {{invoiceNumber}} for {{amount}} is ready.",
      },
      { key: "title", label: "Heading", defaultValue: "Your invoice is ready" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue: "A new invoice is waiting in your portal.",
      },
      { key: "button", label: "Button", defaultValue: "Pay invoice" },
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly invoice {{invoiceNumber}} for {{amount}} is ready. Pay: {{payUrl}}",
        requiredTokens: ["payUrl"],
      },
    ],
  },
  {
    id: "subscription",
    group: "Billing",
    name: "Subscription",
    when: "A subscription invoice is created",
    audience: "That client",
    layout: "details",
    buttonHref: "payUrl",
    tokens: [
      { token: "invoiceNumber", label: "Invoice number", sample: "INV-1042" },
      { token: "item", label: "Plan name", sample: "Website care plan" },
      { token: "amount", label: "Amount", sample: "$250.00" },
      { token: "dueDate", label: "Due date", sample: "Oct 20, 2026" },
      { token: "payUrl", label: "Billing link", sample: "https://app.voixly.com/portal/billing" },
    ],
    fields: [
      {
        key: "subject",
        label: "Subject",
        defaultValue: "Invoice {{invoiceNumber}} — {{item}}",
      },
      {
        key: "preheader",
        label: "Preview text",
        defaultValue: "Invoice {{invoiceNumber}} for {{amount}} is ready.",
      },
      { key: "title", label: "Heading", defaultValue: "Your subscription is ready" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue:
          "This starts a recurring subscription. After you subscribe, Voixly charges the card on file each period.",
      },
      { key: "button", label: "Button", defaultValue: "Subscribe and pay" },
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly subscription {{item}} for {{amount}} is ready. Subscribe: {{payUrl}}",
        requiredTokens: ["payUrl"],
      },
    ],
  },
  {
    id: "payment-failed",
    group: "Billing",
    name: "Payment failed",
    when: "A card charge fails",
    audience: "That client",
    layout: "details",
    buttonHref: "payUrl",
    tokens: [
      { token: "invoiceNumber", label: "Invoice number", sample: "INV-1042" },
      { token: "item", label: "What it is for", sample: "Website care plan" },
      { token: "amount", label: "Amount", sample: "$250.00" },
      { token: "payUrl", label: "Billing link", sample: "https://app.voixly.com/portal/billing" },
    ],
    fields: [
      {
        key: "subject",
        label: "Subject",
        defaultValue: "Payment failed for invoice {{invoiceNumber}}",
      },
      {
        key: "preheader",
        label: "Preview text",
        defaultValue: "Payment failed for invoice {{invoiceNumber}}.",
      },
      { key: "title", label: "Heading", defaultValue: "Payment needs attention" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue: "Update the card in your portal to pay this invoice.",
      },
      { key: "button", label: "Button", defaultValue: "Review invoice" },
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue:
          "Voixly couldn't charge invoice {{invoiceNumber}} ({{amount}}). Update your card: {{payUrl}}",
        requiredTokens: ["payUrl"],
      },
    ],
  },
  {
    id: "ticket-opened",
    group: "Support",
    name: "Ticket opened for a client",
    when: "Your team opens a ticket",
    audience: "That client",
    layout: "quote",
    buttonHref: "url",
    tokens: [
      { token: "subject", label: "Ticket subject", sample: "Homepage update" },
      { token: "preview", label: "First message", sample: "The new header is ready for review." },
      { token: "url", label: "Ticket link", sample: "https://app.voixly.com/portal/support/example" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "New ticket: {{subject}}" },
      { key: "preheader", label: "Preview text", defaultValue: "{{subject}}" },
      { key: "title", label: "Heading", defaultValue: "New reply on your ticket" },
      { key: "body", label: "Body", multiline: true, defaultValue: "{{subject}}" },
      { key: "button", label: "Button", defaultValue: "View ticket" },
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly opened a ticket: {{subject}}. {{url}}",
        requiredTokens: ["url"],
      },
    ],
  },
  {
    id: "ticket-opened-staff",
    group: "Support",
    name: "Client opens a ticket",
    when: "A client opens a ticket",
    audience: "Admins and assigned staff",
    layout: "quote",
    buttonHref: "url",
    tokens: [
      { token: "subject", label: "Ticket subject", sample: "Homepage update" },
      { token: "preview", label: "First message", sample: "Can you update the header?" },
      { token: "url", label: "Ticket link", sample: "https://app.voixly.com/admin/tickets/example" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "New ticket: {{subject}}" },
      { key: "preheader", label: "Preview text", defaultValue: "{{subject}}" },
      { key: "title", label: "Heading", defaultValue: "New client message" },
      { key: "body", label: "Body", multiline: true, defaultValue: "{{subject}}" },
      { key: "button", label: "Button", defaultValue: "View ticket" },
    ],
  },
  {
    id: "ticket-reply",
    group: "Support",
    name: "Reply to a client",
    when: "Your team replies on a ticket",
    audience: "That client",
    layout: "quote",
    buttonHref: "url",
    tokens: [
      { token: "subject", label: "Ticket subject", sample: "Homepage update" },
      { token: "preview", label: "Reply", sample: "The new header is ready for review." },
      { token: "url", label: "Ticket link", sample: "https://app.voixly.com/portal/support/example" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Ticket update: {{subject}}" },
      { key: "preheader", label: "Preview text", defaultValue: "{{subject}}" },
      { key: "title", label: "Heading", defaultValue: "New reply on your ticket" },
      { key: "body", label: "Body", multiline: true, defaultValue: "{{subject}}" },
      { key: "button", label: "Button", defaultValue: "View ticket" },
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: 'Voixly replied to "{{subject}}". {{url}}',
        requiredTokens: ["url"],
      },
    ],
  },
  {
    id: "ticket-reply-staff",
    group: "Support",
    name: "Client replies",
    when: "A client replies on a ticket",
    audience: "Admins and assigned staff",
    layout: "quote",
    buttonHref: "url",
    tokens: [
      { token: "subject", label: "Ticket subject", sample: "Homepage update" },
      { token: "preview", label: "Reply", sample: "That looks good. Can we ship it?" },
      { token: "url", label: "Ticket link", sample: "https://app.voixly.com/admin/tickets/example" },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Ticket update: {{subject}}" },
      { key: "preheader", label: "Preview text", defaultValue: "{{subject}}" },
      { key: "title", label: "Heading", defaultValue: "New client message" },
      { key: "body", label: "Body", multiline: true, defaultValue: "{{subject}}" },
      { key: "button", label: "Button", defaultValue: "View ticket" },
    ],
  },
  {
    id: "announcement",
    group: "Announcements",
    name: "Announcement",
    when: "An announcement is published",
    audience: "Every active client",
    layout: "announcement",
    buttonHref: "url",
    tokens: [
      { token: "title", label: "Announcement title", sample: "Office hours" },
      { token: "body", label: "Announcement", sample: "We are closed Friday." },
      { token: "excerpt", label: "Short excerpt", sample: "We are closed Friday." },
      {
        token: "url",
        label: "Announcements link",
        sample: "https://app.voixly.com/portal/announcements",
      },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "{{title}}" },
      { key: "preheader", label: "Preview text", defaultValue: "{{title}}" },
      { key: "title", label: "Heading", defaultValue: "{{title}}" },
      { key: "body", label: "Quoted announcement", multiline: true, defaultValue: "{{body}}" },
      { key: "button", label: "Button", defaultValue: "View in the portal" },
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly: {{title}}. {{excerpt}} {{url}}",
        requiredTokens: ["url"],
      },
    ],
  },
  {
    id: "signin",
    group: "Sign-in",
    name: "Sign-in code",
    when: "Someone with codes turned on enters the right password",
    audience: "That person",
    layout: "code",
    tokens: [
      { token: "code", label: "6-digit code", sample: "482913" },
      { token: "minutes", label: "Minutes until it expires", sample: "10" },
    ],
    fields: [
      ...signInEmail("Your Voixly sign-in code", "Sign-in code"),
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly sign-in code: {{code}}. It expires in {{minutes}} minutes.",
        requiredTokens: ["code"],
      },
    ],
  },
  {
    id: "signin-enable-email",
    group: "Sign-in",
    name: "Turn on email codes",
    when: "A user turns on email sign-in codes",
    audience: "That user",
    layout: "code",
    tokens: [
      { token: "code", label: "6-digit code", sample: "482913" },
      { token: "minutes", label: "Minutes until it expires", sample: "10" },
    ],
    fields: signInEmail("Confirm email sign-in codes"),
  },
  {
    id: "signin-enable-sms",
    group: "Sign-in",
    name: "Turn on text codes",
    when: "A user turns on text sign-in codes",
    audience: "That user",
    layout: "code",
    tokens: [
      { token: "code", label: "6-digit code", sample: "482913" },
      { token: "minutes", label: "Minutes until it expires", sample: "10" },
    ],
    fields: [
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly code to turn on text sign-in: {{code}}. It expires in {{minutes}} minutes.",
        requiredTokens: ["code"],
      },
    ],
  },
  {
    id: "signin-disable-email",
    group: "Sign-in",
    name: "Turn off email codes",
    when: "A user turns off email sign-in codes",
    audience: "That user",
    layout: "code",
    tokens: [
      { token: "code", label: "6-digit code", sample: "482913" },
      { token: "minutes", label: "Minutes until it expires", sample: "10" },
    ],
    fields: signInEmail("Turn off email sign-in codes"),
  },
  {
    id: "signin-disable-sms",
    group: "Sign-in",
    name: "Turn off text codes",
    when: "A user turns off text sign-in codes",
    audience: "That user",
    layout: "code",
    tokens: [
      { token: "code", label: "6-digit code", sample: "482913" },
      { token: "minutes", label: "Minutes until it expires", sample: "10" },
    ],
    fields: [
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly code to turn off text sign-in: {{code}}. It expires in {{minutes}} minutes.",
        requiredTokens: ["code"],
      },
    ],
  },
  {
    id: "password-reset",
    group: "Sign-in",
    name: "Password reset",
    when: "Someone requests a password reset",
    audience: "The account for that email address",
    layout: "plain",
    buttonHref: "resetUrl",
    tokens: [
      {
        token: "resetUrl",
        label: "Reset link",
        sample: "https://app.voixly.com/reset-password?token=example",
      },
    ],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Reset your Voixly password" },
      { key: "preheader", label: "Preview text", defaultValue: "Choose a new Voixly password." },
      { key: "title", label: "Heading", defaultValue: "Reset your password" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue:
          "Use the button below to choose a new password. This link expires in 1 hour and works once.",
      },
      { key: "button", label: "Button", defaultValue: "Choose a new password" },
      {
        key: "footnote",
        label: "Footnote",
        multiline: true,
        defaultValue:
          "If you did not ask for a reset, you can ignore this email. Your password will stay the same.",
      },
    ],
  },
  {
    id: "test-email",
    group: "Tests",
    name: "Test email",
    when: "You send a test from Settings → Email",
    audience: "Your admin email",
    layout: "plain",
    tokens: [],
    fields: [
      { key: "subject", label: "Subject", defaultValue: "Voixly test email" },
      { key: "preheader", label: "Preview text", defaultValue: "Resend is connected to Voixly." },
      { key: "title", label: "Heading", defaultValue: "Email is connected" },
      {
        key: "body",
        label: "Body",
        multiline: true,
        defaultValue:
          "This is a test from ClientHub. Invoices, announcements, ticket updates, and welcome notes will arrive in this style.",
      },
    ],
  },
  {
    id: "test-sms",
    group: "Tests",
    name: "Test text",
    when: "You send a test from Settings → SMS",
    audience: "The mobile number you enter",
    layout: "plain",
    tokens: [],
    fields: [
      {
        key: "sms",
        label: "Text message",
        multiline: true,
        defaultValue: "Voixly is connected to VoidFix. This is a test text.",
      },
    ],
  },
];

const FIELD_LIMITS: Record<string, number> = {
  subject: 180,
  preheader: 180,
  title: 120,
  body: 4000,
  button: 60,
  footnote: 400,
  sms: 320,
};

export function getMessageFlow(id: string): MessageFlow | undefined {
  return MESSAGE_FLOWS.find((flow) => flow.id === id);
}

export function flowHasEmail(flow: MessageFlow): boolean {
  return flow.fields.some((field) => field.key === "subject");
}

export function flowHasSms(flow: MessageFlow): boolean {
  return flow.fields.some((field) => field.key === "sms");
}

export function sampleVars(flow: MessageFlow): Record<string, string> {
  return Object.fromEntries(flow.tokens.map((token) => [token.token, token.sample]));
}

export function mergeFlowValues(
  flow: MessageFlow,
  saved: Record<string, string> | undefined
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of flow.fields) {
    values[field.key] =
      saved && Object.prototype.hasOwnProperty.call(saved, field.key)
        ? saved[field.key]
        : field.defaultValue;
  }
  return values;
}

export function fillTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
  allowed: Set<string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!allowed.has(key)) return match;
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function composeMessage(
  flow: MessageFlow,
  values: Record<string, string>,
  vars: Record<string, string | null | undefined>
): { subject?: string; html?: string; sms?: string } {
  const allowed = new Set(flow.tokens.map((token) => token.token));
  const filled: Record<string, string> = {};
  for (const field of flow.fields) {
    filled[field.key] = fillTemplate(values[field.key] ?? "", vars, allowed).trim();
  }

  const result: { subject?: string; html?: string; sms?: string } = {};
  if (flowHasSms(flow)) {
    const sms = filled.sms ?? "";
    result.sms = flow.id === "announcement" ? sms.slice(0, 480) : sms;
  }
  if (!flowHasEmail(flow)) return result;

  const hrefKey = flow.buttonHref;
  const href = hrefKey ? String(vars[hrefKey] ?? "").trim() : "";
  const buttonLabel = filled.button?.trim() ?? "";
  result.subject = filled.subject ?? "";
  result.html = emailShell({
    preheader: filled.preheader || filled.title || result.subject,
    title: filled.title || result.subject,
    bodyHtml: bodyHtml(flow, filled, vars),
    button: href && buttonLabel ? { href, label: buttonLabel } : undefined,
    footnote: filled.footnote || undefined,
  });
  return result;
}

function bodyHtml(
  flow: MessageFlow,
  filled: Record<string, string>,
  vars: Record<string, string | null | undefined>
): string {
  const text = (key: string) => (vars[key] == null ? "" : String(vars[key]));
  if (flow.layout === "announcement") {
    return quoteBlock(escapeHtml(filled.body ?? "").replace(/\n/g, "<br>"));
  }
  const lead = emailParagraphs(filled.body ?? "");
  if (flow.layout === "quote") {
    return lead + quoteBlock(escapeHtml(text("preview")).replace(/\n/g, "<br>"));
  }
  if (flow.layout === "code") return lead + codeBlock(text("code"));
  if (flow.layout === "details") {
    const rows = [
      { label: "Invoice", value: text("invoiceNumber") },
      { label: "For", value: text("item") },
      { label: "Amount", value: text("amount") },
      { label: "Due", value: text("dueDate") },
    ].filter((row) => row.value);
    return lead + (rows.length ? detailRows(rows) : "");
  }
  return lead;
}

export function validateFlowValues(
  flow: MessageFlow,
  values: Record<string, string>
): string | null {
  for (const field of flow.fields) {
    const value = (values[field.key] ?? "").replace(/\r\n/g, "\n").replace(/\u0000/g, "");
    const limit = FIELD_LIMITS[field.key] ?? 1000;
    if (value.trim().length === 0 && field.key !== "footnote" && field.key !== "preheader") {
      return `${field.label} is required.`;
    }
    if (value.length > limit) return `${field.label} is too long.`;
    for (const token of field.requiredTokens ?? []) {
      if (!new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`).test(value)) {
        return `${field.label} must include {{${token}}}.`;
      }
    }
  }
  return null;
}

export function cleanFlowValues(
  flow: MessageFlow,
  values: Record<string, string>
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const field of flow.fields) {
    clean[field.key] = (values[field.key] ?? "").replace(/\r\n/g, "\n").replace(/\u0000/g, "");
  }
  return clean;
}
