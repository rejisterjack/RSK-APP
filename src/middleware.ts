import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';

// =============================================================================
// Edge-Safe Env Access
// =============================================================================

const env = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  CSP_CONNECT_SRC: process.env.CSP_CONNECT_SRC ?? '',
  NEXT_PUBLIC_ANALYTICS_HOST: process.env.NEXT_PUBLIC_ANALYTICS_HOST ?? '',
} as const;

// =============================================================================
// Route Configuration
// =============================================================================

const PUBLIC_ROUTES = [
  '/',
  '/demo',
  '/api/demo',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/api/auth',
  '/api/webhook',
  '/api/health',
  '/api/docs',
  '/api/csp-report',
  '/api/error-report',
  '/_next',
  '/static',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

const PROTECTED_API_ROUTES = ['/api/chat', '/api/ingest', '/api/documents', '/api/workspaces'];
const ADMIN_ROUTES = ['/admin', '/api/admin'];

// =============================================================================
// CORS Helpers
// =============================================================================

function computeCorsOrigin(req: NextRequest): string | null {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? env.NEXTAUTH_URL).split(',').map((s) => s.trim());
  return allowedOrigins.includes(origin) ? origin : null;
}

function getCorsHeaders(req: NextRequest) {
  const corsOrigin = computeCorsOrigin(req);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Request-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
  }
  return headers;
}

// =============================================================================
// Response Helper
// =============================================================================

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  return response;
}

// =============================================================================
// Middleware
// =============================================================================

// Edge-compatible auth instance for JWT decoding in middleware
const { auth } = NextAuth(authConfig);

export default auth(async function middleware(req) {
  const { nextUrl } = req;
  const { pathname } = nextUrl;

  try {
    const requestId = req.headers.get('X-Request-ID') ?? crypto.randomUUID();

    // CSP nonce per request
    const nonceBytes = new Uint8Array(16);
    crypto.getRandomValues(nonceBytes);
    const cspNonce = btoa(String.fromCharCode(...nonceBytes));

    // Auth state from the auth() wrapper
    const isLoggedIn = !!req.auth;
    const authUser = req.auth?.user;
    const user = authUser
      ? { id: authUser.id, role: authUser.role, workspaceId: authUser.workspaceId }
      : null;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204, headers: getCorsHeaders(req) });
      return withRequestId(response, requestId);
    }

    // Public routes
    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (isPublicRoute) {
      const headers = new Headers(req.headers);
      headers.set('x-request-id', requestId);
      headers.set('x-nonce', cspNonce);

      const response = NextResponse.next({ request: { headers } });
      addSecurityHeaders(response, requestId, cspNonce);

      if (pathname.startsWith('/api/')) {
        for (const [k, v] of Object.entries(getCorsHeaders(req))) {
          response.headers.set(k, v);
        }
      }

      return withRequestId(response, requestId);
    }

    // Check if route requires auth
    const requiresAuth =
      PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route)) ||
      pathname.startsWith('/chat');

    // Rate limiting for ALL unauthenticated API requests (including API key requests)
    if (!isLoggedIn && pathname.startsWith('/api/')) {
      const { checkIPRateLimit } = await import('@/lib/security/ip-rate-limiter-edge');
      const ipResult = await checkIPRateLimit(req);

      if (!ipResult.allowed) {
        const response = NextResponse.json(
          {
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT',
            requiresCaptcha: ipResult.requiresCaptcha,
            isBlocked: ipResult.isBlocked,
            resetAt: new Date(ipResult.resetTime).toISOString(),
          },
          {
            status: 429,
            headers: {
              ...getCorsHeaders(req),
              'Retry-After': Math.ceil((ipResult.resetTime - Date.now()) / 1000).toString(),
            },
          }
        );
        return withRequestId(response, requestId);
      }
    }

    // API key header: validate format, then forward for downstream key verification
    // Rate limiting has already been applied above
    const apiKey = req.headers.get('X-API-Key');
    if (apiKey && pathname.startsWith('/api/')) {
      if (apiKey.length < 20 || apiKey.length > 200) {
        const response = NextResponse.json(
          { error: 'Invalid API key format', code: 'INVALID_API_KEY' },
          { status: 401, headers: getCorsHeaders(req) }
        );
        return withRequestId(response, requestId);
      }

      const headers = new Headers(req.headers);
      headers.set('x-request-id', requestId);
      headers.set('x-nonce', cspNonce);

      const response = NextResponse.next({ request: { headers } });
      addSecurityHeaders(response, requestId, cspNonce);
      for (const [k, v] of Object.entries(getCorsHeaders(req))) {
        response.headers.set(k, v);
      }
      return withRequestId(response, requestId);
    }

    // Redirect unauthenticated users
    if (!isLoggedIn && requiresAuth) {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Unauthorized', code: 'UNAUTHORIZED' },
          { status: 401, headers: getCorsHeaders(req) }
        );
        return withRequestId(response, requestId);
      }

      const loginUrl = new URL('/login', nextUrl);
      const callbackUrl = nextUrl.search ? `${pathname}${nextUrl.search}` : pathname;
      loginUrl.searchParams.set('callbackUrl', callbackUrl);
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }

    // Admin routes
    const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));
    if (isAdminRoute && user?.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Forbidden', code: 'FORBIDDEN' },
          { status: 403, headers: getCorsHeaders(req) }
        );
        return withRequestId(response, requestId);
      }
      return withRequestId(NextResponse.redirect(new URL('/', nextUrl)), requestId);
    }

    // Authenticated request — forward with user context headers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-request-id', requestId);
    requestHeaders.set('x-nonce', cspNonce);

    if (isLoggedIn && user) {
      requestHeaders.set('x-user-id', user.id as string);
      requestHeaders.set('x-user-role', (user.role as string) ?? 'USER');
      if (user.workspaceId) {
        requestHeaders.set('x-workspace-id', user.workspaceId as string);
      }
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    addSecurityHeaders(response, requestId, cspNonce);

    if (pathname.startsWith('/api/')) {
      for (const [k, v] of Object.entries(getCorsHeaders(req))) {
        response.headers.set(k, v);
      }
    }

    return withRequestId(response, requestId);
  } catch (error) {
    // Do NOT silently pass requests through on middleware failure
    if (env.NODE_ENV === 'development') {
      console.error('[Middleware Error]', error instanceof Error ? error.message : 'Unknown');
    }

    if (pathname?.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'MIDDLEWARE_ERROR', message: 'Request could not be processed' } },
        { status: 500 }
      );
    }

    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }
});

// =============================================================================
// Security Headers
// =============================================================================

function addSecurityHeaders(response: NextResponse, requestId?: string, nonce?: string): void {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '0');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'credentialless');

  const n = nonce ?? '';

  const defaultConnectSrc = [
    "'self'",
    'https://api.openai.com',
    'https://*.vercel.app',
    'https://openrouter.ai',
    'https://*.openrouter.ai',
    'https://generativelanguage.googleapis.com',
    'https://*.googleapis.com',
    'https://*.upstash.io',
    'https://vitals.vercel-insights.com',
    'https://*.vercel-scripts.com',
    'https://va.vercel-scripts.com',
    'https://*.plausible.io',
    process.env.NEXT_PUBLIC_ANALYTICS_HOST,
    'https://*.inngest.com',
    ...(env.NODE_ENV === 'development' ? ['http://localhost:*', 'ws://localhost:*'] : []),
    'wss://*.vercel.app',
    'wss://*.inngest.com',
  ];

  const customConnectSrc =
    env.CSP_CONNECT_SRC?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const connectSrc = [...defaultConnectSrc, ...customConnectSrc].join(' ');

  const scriptSrc =
    env.NODE_ENV === 'development'
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8000 https://*.vercel-scripts.com https://va.vercel-scripts.com`
      : `script-src 'self' 'nonce-${n}' https://*.vercel-scripts.com https://va.vercel-scripts.com`;

  const styleSrc =
    env.NODE_ENV === 'development'
      ? "style-src 'self' 'unsafe-inline'"
      : `style-src 'self' 'nonce-${n}'`;

  const csp = [
    "default-src 'self'",
    scriptSrc,
    `${styleSrc} https://cdn.jsdelivr.net`,
    "img-src 'self' blob: data: https://res.cloudinary.com https://*.githubusercontent.com https://*.googleusercontent.com",
    "font-src 'self' https://cdn.jsdelivr.net",
    `connect-src https://api.github.com ${connectSrc}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "worker-src 'self' blob:",
    "form-action 'self'",
    ...(env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
    'report-uri /api/csp-report',
    'report-to csp-endpoint',
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  response.headers.set(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 86400,
      endpoints: [{ url: '/api/csp-report' }],
    })
  );

  if (env.NODE_ENV === 'development' && requestId && n) {
    response.headers.set('X-Nonce', n);
  }

  if (env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), interest-cohort=()'
  );
}

// =============================================================================
// Config
// =============================================================================

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$).*)',
  ],
};
