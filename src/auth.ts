import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import type { Point, Role } from "@prisma/client";

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const ACCOUNT_LOCKED_CODE = "account_locked";

export class AccountLockedError extends CredentialsSignin {
  code = ACCOUNT_LOCKED_CODE;
}

const {
  handlers,
  auth: nextAuth,
  signIn,
  signOut,
} = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        phone: {},
        password: {},
      },
      async authorize(credentials) {
        const rawPhone = credentials?.phone as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!rawPhone || !password) return null;
        const phone = normalizePhone(rawPhone);

        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user || !user.isActive) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new AccountLockedError();
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_LOGIN_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: shouldLock
              ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
              : { failedLoginAttempts: attempts },
          });
          if (shouldLock) throw new AccountLockedError();
          return null;
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          name: user.fullName,
          role: user.role,
          point: user.point,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.point = user.point;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      session.user.point = token.point as Point | null;
      return session;
    },
  },
});

// Memoized per-request: a Server Action's response re-renders the current
// route in the same round-trip (see Next.js's "single response carries
// data and UI" model), which calls auth() again from the layout — without
// this, that second call was observed to sometimes fail to recover the
// still-valid session (root cause unconfirmed, likely a next-auth v5 beta
// JWT-rotation race triggered by two auth() calls landing in the same
// request), bouncing the user to /login even though nothing was actually
// wrong with their session. cache() makes every auth() call within one
// request resolve to the exact same result instead of re-deriving it.
export const auth = cache(nextAuth);
export { handlers, signIn, signOut };
