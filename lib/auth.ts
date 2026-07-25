import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
    // Without this, any sign-in failure (expired/replayed OAuth callback,
    // a transient server restart mid-flow, etc.) lands on Auth.js's bare,
    // undecorated default error page with no way back in. Routing it back
    // to /login lets that page show a friendly, retry-able message instead.
    error: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.customRole = user.customRoleId
        ? await prisma.customRole.findUnique({ where: { id: user.customRoleId } })
        : null;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

      const isAllowlisted =
        !!user.email && adminEmails.includes(user.email.toLowerCase());
      const isFirstUser = (await prisma.user.count()) === 1;

      if (isAllowlisted || isFirstUser) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }
    },
  },
});
