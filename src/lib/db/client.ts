/**
 * Prisma Client Singleton (Prisma 7 + Accelerate)
 *
 * Uses Prisma Accelerate for connection pooling, edge compatibility,
 * and query caching. The DATABASE_URL points to Prisma's accelerate endpoint.
 *
 * Pattern:
 * - In development, store client on globalThis to prevent hot-reload exhaustion.
 * - In production, module-level singleton (one per process).
 */

import { PrismaClient } from '@/generated/prisma/client';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GlobalWithPrisma = typeof globalThis & {
  _prismaClient: PrismaClient | undefined;
  _prismaReadClient: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Prisma client factory
// ---------------------------------------------------------------------------

function createPrismaClient(url?: string): PrismaClient {
  return new PrismaClient({
    accelerateUrl: url ?? env.DATABASE_URL,
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });
}

// ---------------------------------------------------------------------------
// Slow Query Middleware
// ---------------------------------------------------------------------------

function extendWithSlowQueryMiddleware<T extends PrismaClient>(client: T): T {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = Date.now();
          const result = await query(args);
          const durationMs = Date.now() - start;

          if (durationMs > 1000) {
            logger.warn('Slow Prisma query', {
              model,
              operation,
              durationMs,
              ...(env.NODE_ENV === 'development' && { args }),
            });
          }

          return result;
        },
      },
    },
  }) as unknown as T;
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

const g = globalThis as GlobalWithPrisma;

const basePrisma = g._prismaClient ?? createPrismaClient();

export const prisma = extendWithSlowQueryMiddleware(basePrisma);

if (env.NODE_ENV !== 'production') {
  g._prismaClient = basePrisma;
}

// ---------------------------------------------------------------------------
// Read Replica (optional)
// ---------------------------------------------------------------------------

const READ_REPLICA_URL = env.DATABASE_READ_REPLICA_URL;

function createReadClient(): PrismaClient {
  return new PrismaClient({
    accelerateUrl: READ_REPLICA_URL as string,
    log: ['warn', 'error'],
  });
}

export const prismaRead: PrismaClient = READ_REPLICA_URL
  ? extendWithSlowQueryMiddleware(
      ((): PrismaClient => {
        const g = globalThis as GlobalWithPrisma;
        const base = g._prismaReadClient ?? createReadClient();
        if (env.NODE_ENV !== 'production') {
          g._prismaReadClient = base;
        }
        return base;
      })()
    )
  : prisma;

export type { PrismaClient };
