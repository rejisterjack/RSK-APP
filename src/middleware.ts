/**
 * Next.js Middleware Entry Point
 *
 * Re-exports the proxy middleware which handles:
 * - CSP nonce generation
 * - Authentication & authorization
 * - CORS headers
 * - Security headers
 * - Request ID tracking
 *
 * Next.js requires this file to be named `middleware.ts` at the src/ root.
 * The actual implementation lives in `src/proxy.ts`.
 */

export { config, default } from './proxy';
