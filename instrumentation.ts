/**
 * Next.js Instrumentation
 * Initializes OpenTelemetry on server startup and validates configuration
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initTracing } = await import('./src/lib/tracing');
      initTracing();
    } catch (error) {
      console.error('Instrumentation failed:', error instanceof Error ? error.message : String(error));
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
