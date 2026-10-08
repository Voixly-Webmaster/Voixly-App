import type { Metadata } from "next";
import Link from "next/link";
import { AuthScreen } from "@/components/auth/auth-screen";
import { AccountSetupForm } from "@/components/auth/account-setup-form";
import { getInvitePreview } from "@/actions/invites";

export const metadata: Metadata = {
  title: "Set up your account",
  description: "Choose a password and add your mobile number to open your Voixly portal.",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const preview = token ? await getInvitePreview(token) : null;

  return (
    <AuthScreen
      title="Set up your account"
      description="Choose a password, add your mobile number, and allow texts from Voixly."
    >
      {preview ? (
        <AccountSetupForm token={token} preview={preview} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-destructive" role="alert">
            This invite link is invalid or has expired. Ask Voixly to send a new one.
          </p>
          <Link href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      )}
    </AuthScreen>
  );
}
