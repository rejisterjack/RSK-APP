import { Elysia } from 'elysia'
import { rootRoutes } from './routes/root'
import { documentsRoutes } from './routes/documents'
import { documentByIdRoutes } from './routes/document-by-id'
import { chatsRoutes } from './routes/chats'
import { workspacesRoutes } from './routes/workspaces'
import { searchRoutes } from './routes/search'

export const app = new Elysia({ prefix: '/api/elysia' })
  .use(rootRoutes)
  .use(documentsRoutes)
  .use(documentByIdRoutes)
  .use(chatsRoutes)
  .use(workspacesRoutes)
  .use(searchRoutes)

export type App = typeof app
