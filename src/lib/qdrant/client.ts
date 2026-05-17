import { QdrantClient } from '@qdrant/js-client-rest';

type GlobalWithQdrant = typeof globalThis & { _qdrantClient?: QdrantClient };

const g = globalThis as GlobalWithQdrant;

export const qdrant =
  g._qdrantClient ??
  new QdrantClient({
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
  });

if (process.env.NODE_ENV !== 'production') {
  g._qdrantClient = qdrant;
}

export async function checkQdrantHealth(): Promise<boolean> {
  try {
    await qdrant.getCollections();
    return true;
  } catch {
    return false;
  }
}
