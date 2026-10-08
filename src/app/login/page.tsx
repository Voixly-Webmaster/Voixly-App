import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { AuthScreen } from "@/components/auth/auth-screen";
import { LoginForm } from "@/components/auth/login-form";
import { LOGIN_DESCRIPTION, LOGIN_TITLE, OG_DESCRIPTION, OG_TITLE } from "@/lib/seo";
import { safeNextPath } from "@/lib/passwords";
import { UserRole } from "@prisma/client";

export const metadata: Metadata = {
  title: LOGIN_TITLE,
  description: LOGIN_DESCRIPTION,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: "/login" },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: "/login",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: OG_DESCRIPTION,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: ["/twitter-image.png"],
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; notice?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === UserRole.CLIENT ? "/portal" : "/admin");
  }

  const params = await searchParams;
  const callbackUrl = safeNextPath(params.callbackUrl);

  return (
    <>
      <SiteJsonLd />
      <AuthScreen
        title="Sign in"
        description="Access your client portal or staff dashboard"
      >
        {params.notice === "password-changed" || params.notice === "password-reset" ? (
          <p className="mb-4 rounded-lg border border-success/30 bg-success-muted px-3 py-2 text-sm text-success-foreground">
            Password updated. Sign in with your new password.
          </p>
        ) : null}
        {params.notice === "account-ready" ? (
          <p className="mb-4 rounded-lg border border-success/30 bg-success-muted px-3 py-2 text-sm text-success-foreground">
            Your account is ready. Sign in with the email from your invite.
          </p>
        ) : null}
        {params.error === "credentials" && (
          <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Invalid email or password.
          </p>
        )}
        {params.error === "server" && (
          <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {process.env.NODE_ENV === "production"
              ? "Sign-in is temporarily unavailable. Please try again in a moment."
              : "Could not reach the local database. Run npm run db:setup, then try again."}
          </p>
        )}
        <LoginForm
          callbackUrl={callbackUrl}
          defaultEmail={
            process.env.NODE_ENV !== "production" ? "admin@voixly.com" : undefined
          }
        />
        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Demo: admin@voixly.com / client@acme.com — password: password123.{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Forgot password?
            </Link>
          </p>
        ) : null}
      </AuthScreen>
    </>
  );
}
