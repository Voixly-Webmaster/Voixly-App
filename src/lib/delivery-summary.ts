export type BroadcastResult = {
  recipients: number;
  emailed: number;
  emailFailed: number;
  texted: number;
  textFailed: number;
  emailUnconfigured: boolean;
  smsUnconfigured: boolean;
};

export function deliverySummary(result: BroadcastResult): string {
  if (result.recipients === 0) return "No active clients to notify.";

  const email = result.emailUnconfigured
    ? "Email is not configured."
    : result.emailFailed
      ? `Emailed ${result.emailed}. ${result.emailFailed} failed.`
      : `Emailed ${result.emailed}.`;

  const sms = result.smsUnconfigured
    ? "Text messaging is not configured."
    : result.texted + result.textFailed === 0
      ? "No mobile numbers on file."
      : result.textFailed
        ? `Texted ${result.texted}. ${result.textFailed} failed.`
        : `Texted ${result.texted}.`;

  return `${email} ${sms}`;
}
