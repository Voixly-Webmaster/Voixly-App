import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
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
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/webhooks");
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
