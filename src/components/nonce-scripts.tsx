import { headers } from 'next/headers';
import { PWAScripts } from '@/components/pwa/pwa-scripts';
import { CsrfTokenScript } from '@/lib/security/csrf';

export async function NonceScripts(): Promise<React.ReactElement> {
  let nonce = '';
  try {
    const headersList = await headers();
    nonce = headersList.get('x-nonce') ?? '';
  } catch {
    // headers() may throw in static/cached contexts — gracefully fall back to no nonce.
    // Scripts will still load; the nonce is optional when style-src uses 'unsafe-inline'.
    nonce = '';
  }

  return (
    <>
      <PWAScripts nonce={nonce} />
      <CsrfTokenScript nonce={nonce} />
    </>
  );
}
