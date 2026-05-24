'use client';

import { PWAScripts } from '@/components/pwa/pwa-scripts';
import { CsrfTokenScript } from '@/lib/security/csrf';

/**
 * Client-side scripts for PWA and CSRF initialization.
 *
 * Previously this was a server component that read the CSP nonce from
 * request headers via headers(). That forced the entire layout into
 * dynamic (streaming) mode, which caused "Connection closed" errors when
 * Vercel deployment protection blocked the RSC stream requests.
 *
 * Since script-src uses 'nonce-...' for third-party scripts and our own
 * inline scripts are trusted first-party code, we render them without a
 * nonce here. The CSP nonce is still generated per-request in proxy.ts
 * and applied to Next.js's own script tags via the layout's <head>.
 */
export function NonceScripts(): React.ReactElement {
  return (
    <>
      <PWAScripts />
      <CsrfTokenScript />
    </>
  );
}
