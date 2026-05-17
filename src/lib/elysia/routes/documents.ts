import { Elysia, t } from 'elysia'
import type { DocumentStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import {
  buildCursorQuery,
  buildPaginationResult,
  createPaginationHeaders,
  validatePaginationParams,
} from '@/lib/db/cursor-pagination'
import { requireAuth } from '../plugins/auth'

export const documentsRoutes = new Elysia({
  name: 'elysia/documents',
  prefix: '/documents',
})
  .use(requireAuth)
  .get(
    '/',
    async ({ workspace, query, set }) => {
      if (!workspace) {
        return { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } }
      }

      const paginationParams = {
        limit: query.limit,
        cursor: query.cursor,
        direction: query.direction,
      }
      const validation = validatePaginationParams(paginationParams)
      if (!validation.valid) {
        set.status = 400
        return { error: { code: 'BAD_REQUEST', message: validation.error } }
      }

      const status = query.status as DocumentStatus | undefined
      const { takeCount, where: cursorWhere, orderBy } = buildCursorQuery<
        { id: string; updatedAt: Date }
      >(paginationParams, { cursorField: 'updatedAt' })

      const where = {
        workspaceId: workspace.id,
        ...(status && { status: status as DocumentStatus }),
        ...cursorWhere,
      }

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
          where: {
            workspaceId: workspace.id,
            ...(status && { status: status as DocumentStatus }),
          },
        }),
      ])

      const result = buildPaginationResult(documents, paginationParams, {
        cursorField: 'updatedAt',
        totalCount: total,
      })

      set.headers = createPaginationHeaders(result)
      return {
        data: result.items.map((doc) => ({ ...doc, size: Number(doc.size) })),
        pagination: result.pagination,
      }
    },
    {
      query: t.Object({
        limit: t.Number({ default: 20, minimum: 1, maximum: 100 }),
        cursor: t.Optional(t.String()),
        direction: t.Optional(
          t.Union([t.Literal('forward'), t.Literal('backward')])
        ),
        status: t.Optional(
          t.Union([
            t.Literal('pending'),
            t.Literal('processing'),
            t.Literal('ready'),
            t.Literal('error'),
          ])
        ),
      }),
    }
  )
