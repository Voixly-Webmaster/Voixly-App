import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/session-guard";
import { deliveryReady } from "@/lib/auth-codes";
import { FormPanel } from "@/components/shared/form-panel";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { KeyRound, ShieldCheck } from "lucide-react";

export async function AccountSecurity() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { clientProfile: true, staffProfile: true },
  });
  if (!user) return null;

  const ready = await deliveryReady();
  const suggestedPhone = user.clientProfile?.phone || user.staffProfile?.phone || "";

  return (
    <div className="max-w-lg space-y-6">
      <FormPanel
        title="Password"
        description="Changing it signs you out on this device and everywhere else"
        icon={KeyRound}
      >
        <ChangePasswordForm />
      </FormPanel>
      <FormPanel
        title="Sign-in codes"
        description="A second step after your password"
        icon={ShieldCheck}
      >
        <TwoFactorForm
          email={user.email}
          emailOn={user.twoFactorEmail}
          smsOn={user.twoFactorSms}
          smsPhone={user.twoFactorPhone}
          suggestedPhone={suggestedPhone}
          emailReady={ready.email}
          smsReady={ready.sms}
        />
      </FormPanel>
    </div>
  );
}
