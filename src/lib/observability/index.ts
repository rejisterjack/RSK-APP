/**
 * Observability Module
 *
 * Initializes OpenTelemetry for distributed tracing and metrics
 * in production. No-op in development unless explicitly enabled.
 */

import { logger } from '@/lib/logger';

let initialized = false;
let otelSdk: InstanceType<typeof import('@opentelemetry/sdk-node').NodeSDK> | null = null;

export async function initObservability(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.NODE_ENV !== 'production') {
    logger.debug('Observability: skipping (no OTEL endpoint configured)');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');

    otelSdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME || 'rag-starter-kit',
    });

    otelSdk.start();

    logger.info('Observability: OpenTelemetry initialized');
  } catch {
    logger.warn('Observability: OpenTelemetry packages not available, skipping');
  }
}

export async function shutdownObservability(): Promise<void> {
  if (otelSdk) {
    try {
      await otelSdk.shutdown();
      logger.info('Observability: OpenTelemetry shutdown complete');
    } catch (err) {
      logger.error('OTEL SDK shutdown failed', {
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  }
}

export { initialized };
