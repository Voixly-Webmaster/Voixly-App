/** E.164, or a 10/11 digit US number rewritten with +1. */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `••• ••• ${last4}`;
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "your email";
  const visible = name.slice(0, 1);
  return `${visible}•••@${domain}`;
}
