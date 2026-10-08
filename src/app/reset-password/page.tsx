import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Set a new password for your Voixly account.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthScreen
      title="Choose a new password"
      description="Use at least 8 characters. This signs every device out."
    >
      <ResetPasswordForm token={params.token ?? ""} />
    </AuthScreen>
  );
}
