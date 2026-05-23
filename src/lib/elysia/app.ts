import { Elysia } from 'elysia';
import { logger } from '@/lib/logger';
import { chatsRoutes } from './routes/chats';
import { documentByIdRoutes } from './routes/document-by-id';
import { documentsRoutes } from './routes/documents';
import { rootRoutes } from './routes/root';
import { searchRoutes } from './routes/search';
import { workspacesRoutes } from './routes/workspaces';

export const app = new Elysia({ prefix: '/api/elysia' })
  .onRequest(({ request }) => {
    logger.debug(`Elysia: ${request.method} ${new URL(request.url).pathname}`);
  })
  .onAfterResponse(({ request, set }) => {
    const path = new URL(request.url).pathname;
    if (typeof set.status === 'number' && set.status >= 500) {
      logger.error(`Elysia error: ${request.method} ${path} -> ${set.status}`);
    }
  })
  .onError(({ code, error, request }) => {
    const path = new URL(request.url).pathname;
    logger.error(`Elysia unhandled: [${code}] ${request.method} ${path}`, {
      error: error instanceof Error ? error.message : String(error),
      code,
    });

    const isProd = process.env.NODE_ENV === 'production';

    if (code === 'VALIDATION') {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload' } }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      );
    }

    if (code === 'NOT_FOUND') {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Resource not found' } }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: isProd
            ? 'An unexpected error occurred'
            : error instanceof Error
              ? error.message
              : 'Unknown error',
        },
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  })
  .use(rootRoutes)
  .use(documentsRoutes)
  .use(documentByIdRoutes)
  .use(chatsRoutes)
  .use(workspacesRoutes)
  .use(searchRoutes);

export type App = typeof app;
