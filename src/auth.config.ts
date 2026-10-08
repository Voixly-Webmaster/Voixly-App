import type { NextAuthConfig } from "next-auth";
import { authSecret } from "@/lib/database-url";

export const authConfig = {
  secret: authSecret(),
  // Hostinger (and most reverse proxies) terminate TLS; trust the forwarded host.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const isPublic =
        pathname === "/" ||
        pathname === "/login" ||
        pathname === "/forgot-password" ||
        pathname === "/reset-password" ||
        pathname === "/invite" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/webhooks") ||
        pathname.startsWith("/api/v1");
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
