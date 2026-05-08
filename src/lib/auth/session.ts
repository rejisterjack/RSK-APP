/**
 * Session Utilities & Auth Guards
 *
 * Helper functions for session management, workspace context,
 * and route protection. Extracted from NextAuth config for separation of concerns.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { AuthSession } from './index';
import { auth } from './index';

// =============================================================================
// Session Queries
// =============================================================================

/**
 * Get the current workspace from session
 */
export async function getServerSession() {
  const session = await auth();
  if (!session?.user?.id) return null;

  if (session.user.workspaceId) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: session.user.workspaceId,
        members: { some: { userId: session.user.id } },
      },
    });
    if (workspace) return workspace;
  }

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { joinedAt: 'asc' },
    include: { workspace: true },
  });

  return member?.workspace || null;
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id || null;
}

/**
 * Get current workspace ID from session
 */
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.workspaceId || null;
}

/**
 * Get current authenticated user with workspace info
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      workspaceMembers: { include: { workspace: true } },
    },
  });
}

// =============================================================================
// Auth Guards
// =============================================================================

/**
 * Require authentication for server components
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Check if user is admin
 */
export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  return session;
}

/**
 * Wrap an API route handler with authentication.
 * If the user is not authenticated, returns a 401 JSON response.
 *
 * @example
 * export const GET = withApiAuth(async (req, session) => {
 *   const userId = session.user.id;
 *   return NextResponse.json({ data });
 * });
 */
export function withApiAuth<TReq extends Request = Request, TContext = unknown>(
  handler: (req: TReq, session: AuthSession, context: TContext) => Promise<NextResponse>
): (req: TReq, context: TContext) => Promise<NextResponse> {
  function wrapper(req: TReq, context: TContext): Promise<NextResponse> {
    return (async () => {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      return handler(req, session as AuthSession, context);
    })();
  }
  return wrapper;
}
