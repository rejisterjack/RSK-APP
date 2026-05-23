/**
 * Test Setup Utilities
 *
 * Shared setup helpers for integration and unit tests.
 */

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Global test setup
beforeAll(() => {
  // Add any global test setup here
  // e.g., mocking environment variables
  process.env.NEXTAUTH_URL = 'http://localhost:7392';
  process.env.NEXTAUTH_SECRET = 'test-secret';
});

// Global test teardown
afterAll(() => {
  // Add any global cleanup here
});

// =============================================================================
// Mock Auth Helpers
// =============================================================================

/**
 * Internal state for the mock NextAuth session
 */
let _mockSession: unknown = null;

/**
 * Mock the NextAuth `auth()` function to return a specific session.
 *
 * Call this before running tests that depend on authentication state.
 *
 * @example
 * mockNextAuthSession({ user: { id: 'user-1', email: 'test@example.com' }, expires: '...' });
 * mockNextAuthSession(null); // unauthenticated
 */
export function mockNextAuthSession(session: unknown): void {
  _mockSession = session;

  // Also mock next-auth/react's useSession if needed
  vi.mock('next-auth/react', () => ({
    useSession: vi.fn(() => ({
      data: session,
      status: session ? 'authenticated' : 'unauthenticated',
      update: vi.fn(),
    })),
    getSession: vi.fn().mockResolvedValue(session),
    signIn: vi.fn(),
    signOut: vi.fn(),
  }));
}

/**
 * Get the currently mocked NextAuth session
 */
export function getMockNextAuthSession(): unknown {
  return _mockSession;
}

// =============================================================================
// Mock Request Helpers
// =============================================================================

/**
 * Create a mock request object for API testing
 */
export function createMockRequest(
  options: { method?: string; url?: string; body?: unknown; headers?: Record<string, string> } = {}
): Request {
  const { method = 'GET', url = 'http://localhost:7392/api/test', body, headers = {} } = options;

  return new Request(url, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Create a mock NextRequest object (for App Router API routes)
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    cookies?: Record<string, string>;
  } = {}
): Request {
  const request = new Request(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  });

  // Add cookie handling
  if (options.cookies) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    request.headers.set('Cookie', cookieHeader);
  }

  return request;
}

/**
 * Create a mock Response object
 */
export function createMockResponse(
  body: unknown = {},
  options: { status?: number; statusText?: string; headers?: Record<string, string> } = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// =============================================================================
// Utility Helpers
// =============================================================================

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock file for upload testing
 */
export function createMockFile(
  options: { name?: string; type?: string; size?: number; content?: string } = {}
): File {
  const { name = 'test.txt', type = 'text/plain', content = 'test content' } = options;
  return new File([content], name, { type });
}

/**
 * Create a mock FormData object with files
 */
export function createMockFormData(files: File[], fields: Record<string, string> = {}): FormData {
  const formData = new FormData();

  files.forEach((file, i) => {
    formData.append(`file-${i}`, file);
  });

  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  return formData;
}
