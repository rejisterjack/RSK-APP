/**
 * Edge-Compatible Auth Configuration
 *
 * Used by middleware (Edge Runtime) for JWT decoding without database access.
 * The full auth config in index.ts extends this with the Prisma adapter,
 * providers, and database-dependent callbacks.
 *
 * @see https://authjs.dev/getting-started/migrating-to-v5
 */

import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
    newUser: '/register',
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = typeof token.id === 'string' ? token.id : '';
        session.user.role = typeof token.role === 'string' ? token.role : 'USER';
        session.user.workspaceId =
          typeof token.workspaceId === 'string' ? token.workspaceId : undefined;
        session.user.workspaceRole =
          typeof token.workspaceRole === 'string' ? token.workspaceRole : undefined;
      }
      return session;
    },
  },
};
