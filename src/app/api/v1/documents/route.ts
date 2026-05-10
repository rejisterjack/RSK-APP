/**
 * @openapi
 * /api/v1/documents:
 *   get:
 *     summary: List documents
 *     description: Retrieve a paginated list of documents in the workspace
 *     tags: [Documents]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - name: cursor
 *         in: query
 *         schema:
 *           type: string
 *           description: Cursor for next/previous page
 *       - name: direction
 *         in: query
 *         schema:
 *           type: string
 *           enum: [forward, backward]
 *           default: forward
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, processing, ready, error]
 *     responses:
 *       200:
 *         description: List of documents
 *       401:
 *         description: Unauthorized
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { DocumentStatus } from '@/generated/prisma/client';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import {
  buildCursorQuery,
  buildPaginationResult,
  createPaginationHeaders,
  parsePaginationParams,
  validatePaginationParams,
} from '@/lib/db/cursor-pagination';

const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/documents
 * List documents with cursor-based pagination and filtering
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  // Clean up stale PROCESSING documents — mark as FAILED if stuck >5 minutes
  try {
    const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MS);
    const staleDocs = await prisma.document.findMany({
      where: {
        workspaceId: workspace.id,
        status: 'PROCESSING',
        updatedAt: { lt: staleCutoff },
      },
      select: { id: true },
    });
    if (staleDocs.length > 0) {
      const staleIds = staleDocs.map((d) => d.id);
      await prisma.documentChunk
        .deleteMany({ where: { documentId: { in: staleIds } } })
        .catch(() => {});
      await prisma.ingestionJob
        .updateMany({
          where: { documentId: { in: staleIds } },
          data: { status: 'FAILED', error: 'Processing timed out', completedAt: new Date() },
        })
        .catch(() => {});
      const errorMeta = JSON.stringify({
        error: 'Processing timed out',
        failedAt: new Date().toISOString(),
      });
      for (const id of staleIds) {
        await prisma.$executeRaw`
          UPDATE documents SET status = 'FAILED',
            metadata = COALESCE(metadata, '{}'::jsonb) || ${errorMeta}::jsonb,
            "updatedAt" = NOW()
          WHERE id = ${id}
        `.catch(() => {});
      }
    }
  } catch {
    // Non-blocking — don't fail the list request if cleanup has issues
  }

  const { searchParams } = new URL(request.url);
  const paginationParams = parsePaginationParams(searchParams);
  const validation = validatePaginationParams(paginationParams);

  if (!validation.valid) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: validation.error } },
      { status: 400 }
    );
  }

  const status = searchParams.get('status') as DocumentStatus | undefined;
  const {
    takeCount,
    where: cursorWhere,
    orderBy,
  } = buildCursorQuery<{ id: string; updatedAt: Date }>(paginationParams, {
    cursorField: 'updatedAt',
  });

  const where = {
    workspaceId: workspace.id,
    ...(status && { status: status as DocumentStatus }),
    ...cursorWhere,
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy,
      take: takeCount,
      select: {
        id: true,
        name: true,
        contentType: true,
        status: true,
        size: true,
        updatedAt: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.document.count({
      where: { workspaceId: workspace.id, ...(status && { status: status as DocumentStatus }) },
    }),
  ]);

  const result = buildPaginationResult(documents, paginationParams, {
    cursorField: 'updatedAt',
    totalCount: total,
  });

  const headers = createPaginationHeaders(result);
  return NextResponse.json(
    {
      data: result.items.map((doc) => ({
        ...doc,
        size: Number(doc.size),
      })),
      pagination: result.pagination,
    },
    { headers }
  );
}
