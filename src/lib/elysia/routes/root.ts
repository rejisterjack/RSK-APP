import { Elysia } from 'elysia'

export const rootRoutes = new Elysia({ name: 'elysia/root' }).get('/', () => ({
  name: 'RAG Starter Kit API (Elysia)',
  version: '1.0.0',
  endpoints: {
    documents: '/api/elysia/documents',
    chats: '/api/elysia/chats',
    workspaces: '/api/elysia/workspaces',
    search: '/api/elysia/search',
  },
}))
