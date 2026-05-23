'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error page convention
export default function Error({ error, reset }: ErrorProps): React.ReactElement {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(error, {
          tags: { digest: error.digest },
        });
      }

      try {
        const payload = {
          message: error.message,
          digest: error.digest,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        };

        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            '/api/error-report',
            new Blob([JSON.stringify(payload)], { type: 'application/json' })
          );
        }
      } catch {}
    }
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-destructive">Error</h1>
        <h2 className="mt-4 text-2xl font-semibold">Something went wrong</h2>
        <p className="mt-2 text-muted-foreground">
          {isDev
            ? error.message || 'An unexpected error occurred.'
            : 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-muted-foreground/60">Error ID: {error.digest}</p>
        )}
        <div className="mt-6 flex gap-4 justify-center">
          <Button onClick={reset}>Try Again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
