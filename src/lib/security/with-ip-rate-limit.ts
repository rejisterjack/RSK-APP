import { type NextRequest, NextResponse } from 'next/server';
import { checkIPRateLimit } from '@/lib/security/ip-rate-limiter';

type RouteHandler = (req: NextRequest, context?: unknown) => Promise<Response | NextResponse>;

/**
 * Wraps an API route handler with IP-based rate limiting for unauthenticated requests.
 * Authenticated requests (with x-user-id header set by proxy) skip the check.
 */
export function withIpRateLimit<T extends RouteHandler>(handler: T): T {
  const wrapped = async (req: NextRequest, context?: unknown) => {
    if (req.headers.get('x-user-id')) {
      return handler(req, context);
    }

    const result = await checkIPRateLimit(req);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          requiresCaptcha: result.requiresCaptcha,
          isBlocked: result.isBlocked,
          resetAt: new Date(result.resetTime).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return handler(req, context);
  };
  return wrapped as T;
}
