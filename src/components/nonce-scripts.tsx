import { headers } from 'next/headers';
import { PWAScripts } from '@/components/pwa/pwa-scripts';
import { CsrfTokenScript } from '@/lib/security/csrf';

export async function NonceScripts(): Promise<React.ReactElement> {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <>
      <PWAScripts nonce={nonce} />
      <CsrfTokenScript nonce={nonce} />
    </>
  );
}
