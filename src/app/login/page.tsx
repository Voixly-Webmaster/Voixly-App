import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/shared/panel";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SiteJsonLd } from "@/components/seo/json-ld";
import { LOGIN_DESCRIPTION, LOGIN_TITLE, OG_DESCRIPTION, OG_TITLE } from "@/lib/seo";
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
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === UserRole.CLIENT ? "/portal" : "/admin");
  }

  const params = await searchParams;

  return (
    <div className="relative flex min-h-screen app-main-bg">
      <SiteJsonLd />
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="hidden flex-1 flex-col justify-between bg-brand p-12 text-brand-foreground lg:flex">
        <Image
          src="/brand/voixly-logo.png"
          alt="Voixly"
          width={160}
          height={48}
          className="brightness-0 invert"
          priority
        />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Your work, in one place.
          </h1>
          <p className="mt-3 max-w-md text-brand-muted">
            Invoices, projects, files, and support — the secure Voixly portal
            for clients and the team behind them.
          </p>
        </div>
        <p className="text-sm text-brand-muted/80">© Voixly Digital Marketing</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 pt-16 sm:pt-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Image
              src="/brand/voixly-logomark.png"
              alt="Voixly"
              width={48}
              height={48}
              className="rounded-xl"
              priority
            />
          </div>
          <Panel
            title="Sign in"
            description="Access your client portal or staff dashboard"
            accent="primary"
            className="shadow-lg"
          >
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
            <form
              action={async (formData) => {
                "use server";
                const { AuthError } = await import("next-auth");
                try {
                  await signIn("credentials", {
                    email: formData.get("email"),
                    password: formData.get("password"),
                    redirectTo: params.callbackUrl ?? "/",
                  });
                } catch (err) {
                  if (
                    err &&
                    typeof err === "object" &&
                    "digest" in err &&
                    String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
                  ) {
                    throw err;
                  }
                  if (err instanceof AuthError && err.type === "CredentialsSignin") {
                    redirect("/login?error=credentials");
                  }
                  console.error("[login]", err);
                  redirect("/login?error=server");
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  defaultValue={
                    process.env.NODE_ENV !== "production"
                      ? "admin@voixly.com"
                      : undefined
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
            {process.env.NODE_ENV !== "production" ? (
              <p className="mt-6 text-center text-xs text-muted-foreground">
                Demo: admin@voixly.com / client@acme.com — password: password123
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
