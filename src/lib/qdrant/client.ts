import { QdrantClient } from '@qdrant/js-client-rest';

type GlobalWithQdrant = typeof globalThis & { _qdrantClient?: QdrantClient };

const g = globalThis as GlobalWithQdrant;

export const qdrant =
  g._qdrantClient ??
  new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    timeout: 10_000,
  });

if (process.env.NODE_ENV !== 'production') {
  g._qdrantClient = qdrant;
}

export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const result = await Promise.race([
      qdrant.getCollections(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Qdrant health check timeout')), 5_000)
      ),
    ]);
    return Array.isArray((result as { collections: unknown[] }).collections);
  } catch {
    return false;
  }
}
