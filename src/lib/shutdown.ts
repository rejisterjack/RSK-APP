/**
 * Graceful Shutdown Orchestrator
 *
 * Single source of truth for process shutdown. Serializes cleanup
 * in the correct order: flush telemetry, disconnect database, then exit.
 */

import { disconnectDatabase } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { shutdownObservability } from '@/lib/observability';

let shuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  // 1. Flush OpenTelemetry traces
  await shutdownObservability();

  // 2. Disconnect database
  await disconnectDatabase();

  logger.info('Graceful shutdown complete');
  process.exit(0);
}

if (process.env.NODE_ENV === 'production') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}
