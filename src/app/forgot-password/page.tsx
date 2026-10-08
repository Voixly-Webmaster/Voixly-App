import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Email yourself a link to choose a new Voixly password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      title="Reset your password"
      description="We’ll email you a link if an account exists for that address"
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
