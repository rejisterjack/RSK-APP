/**
 * Server-side Instrumentation
 *
 * Runs once per server process at startup, before any requests are handled.
 * Use for OpenTelemetry setup, metric collection, and service initialization.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initObservability } = await import('@/lib/observability');
    await initObservability();

    // Load shutdown orchestrator (registers SIGTERM/SIGINT handlers)
    await import('@/lib/shutdown');
  }
}
