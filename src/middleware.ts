import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Let Auth.js handle its own API routes (session, signin, etc.)
  // /api/files enforces its own auth, but unauthenticated requests should
  // get 401 (handled by the route itself), not be redirected to /login.
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/files")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && role === UserRole.CLIENT) {
    return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  }

  if (pathname.startsWith("/portal") && role && role !== UserRole.CLIENT) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl.origin));
  }

  if (!isLoggedIn && pathname !== "/login" && pathname !== "/") {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand).*)"],
};
