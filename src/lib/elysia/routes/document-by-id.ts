import { Elysia, t } from 'elysia'
import { prisma } from '@/lib/db'
import { requireAuth } from '../plugins/auth'

export const documentByIdRoutes = new Elysia({ name: 'elysia/document-by-id' })
  .use(requireAuth)
  .get(
    '/documents/:id',
    async ({ workspace, params: { id }, set }) => {
      if (!workspace) {
        set.status = 404
        return { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } }
      }

      const document = await prisma.document.findFirst({
        where: { id, workspaceId: workspace.id },
      })

      if (!document) {
        set.status = 404
        return { error: { code: 'NOT_FOUND', message: 'Document not found' } }
      }

      return { data: { ...document, size: Number(document.size) } }
    },
    { params: t.Object({ id: t.String() }) }
  )
  .delete(
    '/documents/:id',
    async ({ workspace, params: { id }, set }) => {
      if (!workspace) {
        set.status = 404
        return { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } }
      }

      const document = await prisma.document.findFirst({
        where: { id, workspaceId: workspace.id },
      })

      if (!document) {
        set.status = 404
        return { error: { code: 'NOT_FOUND', message: 'Document not found' } }
      }

      await prisma.document.delete({ where: { id } })
      return { data: { message: 'Document deleted successfully' } }
    },
    { params: t.Object({ id: t.String() }) }
  )
