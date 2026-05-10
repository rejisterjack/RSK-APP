/**
 * Next.js Instrumentation
 * Initializes Sentry and OpenTelemetry on server startup, validates configuration
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry (no-op if SENTRY_DSN is not set)
    if (process.env.SENTRY_DSN) {
      try {
        await import('./sentry.server.config');
      } catch (error) {
        console.error('Sentry initialization failed:', error instanceof Error ? error.message : String(error));
      }
    }

    // Only initialize tracing in production — OTEL SDK is heavy and slows dev startup
    if (process.env.NODE_ENV === 'production') {
      try {
        const { initTracing } = await import('./src/lib/tracing');
        initTracing();
      } catch (error) {
        console.error('Instrumentation failed:', error instanceof Error ? error.message : String(error));
      }
    }

    // Validate that the configured embedding model dimensions match the database schema
    try {
      const { validateEmbeddingDimensions } = await import('./src/lib/ai/embeddings');
      const result = validateEmbeddingDimensions();
      if (result.message) {
        if (result.valid) {
          console.warn(`[EMBEDDING WARNING] ${result.message}`);
        } else {
          console.error(`[EMBEDDING ERROR] ${result.message}`);
        }
      }
    } catch (error) {
      // Don't block startup if validation fails to import
      console.error(
        'Embedding validation failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
