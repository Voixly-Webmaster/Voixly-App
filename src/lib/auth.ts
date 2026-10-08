import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";
import { authConfig } from "@/auth.config";
import { consumeLoginTicket } from "@/lib/auth-codes";
import { normalizeEmail } from "@/lib/passwords";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginTicket: { label: "Login ticket", type: "text" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const loginTicket = String(credentials?.loginTicket ?? "");
        if (!email || !loginTicket) return null;

        const user = await consumeLoginTicket(email, loginTicket);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clientId: user.clientProfile?.id ?? null,
          staffProfileId: user.staffProfile?.id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = (user as { role: UserRole }).role;
        token.clientId = (user as { clientId?: string | null }).clientId ?? null;
        token.staffProfileId =
          (user as { staffProfileId?: string | null }).staffProfileId ?? null;
        const signedIn = await prisma.user.findFirst({
          where: { id: user.id },
          select: { passwordChangedAt: true },
        });
        token.pwAt = signedIn?.passwordChangedAt?.getTime() ?? 0;
        return token;
      }

      const userId = (token.id as string | undefined) || token.sub;
      if (!userId) return token;

      const dbUser = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: { clientProfile: true, staffProfile: true },
      });
      if (!dbUser) return null;

      const changed = dbUser.passwordChangedAt?.getTime() ?? 0;
      if (typeof token.pwAt !== "number") {
        if (changed !== 0) return null;
        token.pwAt = 0;
      } else if (token.pwAt !== changed) {
        return null;
      }

      token.id = dbUser.id;
      token.role = dbUser.role;
      token.clientId = dbUser.clientProfile?.id ?? null;
      token.staffProfileId = dbUser.staffProfile?.id ?? null;
      token.email = dbUser.email;
      token.name = dbUser.name;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.clientId = (token.clientId as string | null) ?? null;
        session.user.staffProfileId =
          (token.staffProfileId as string | null) ?? null;
      }
      return session;
    },
  },
});

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    role: session.user.role,
    clientId: session.user.clientId,
    staffProfileId: session.user.staffProfileId,
  };
}
