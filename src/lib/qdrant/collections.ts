import { qdrant } from './client';

export const COLLECTION_DOCUMENT_CHUNKS = 'document_chunks';
export const COLLECTION_IMAGE_EMBEDDINGS = 'image_embeddings';

let documentChunksEnsured = false;
let imageEmbeddingsEnsured = false;

export function resetCollectionCache(): void {
  documentChunksEnsured = false;
  imageEmbeddingsEnsured = false;
}

export async function ensureDocumentChunksCollection(): Promise<void> {
  if (documentChunksEnsured) return;

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_DOCUMENT_CHUNKS);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_DOCUMENT_CHUNKS, {
      vectors: { size: 768, distance: 'Cosine' },
      hnsw_config: {
        m: 32,
        ef_construct: 128,
        full_scan_threshold: 10000,
      },
      optimizers_config: {
        indexing_threshold: 20000,
      },
    });
  }

  await Promise.allSettled([
    qdrant.createPayloadIndex(COLLECTION_DOCUMENT_CHUNKS, {
      field_name: 'documentId',
      field_schema: 'keyword',
      wait: false,
    }),
    qdrant.createPayloadIndex(COLLECTION_DOCUMENT_CHUNKS, {
      field_name: 'userId',
      field_schema: 'keyword',
      wait: false,
    }),
    qdrant.createPayloadIndex(COLLECTION_DOCUMENT_CHUNKS, {
      field_name: 'workspaceId',
      field_schema: 'keyword',
      wait: false,
    }),
    qdrant.createPayloadIndex(COLLECTION_DOCUMENT_CHUNKS, {
      field_name: 'documentType',
      field_schema: 'keyword',
      wait: false,
    }),
    qdrant.createPayloadIndex(COLLECTION_DOCUMENT_CHUNKS, {
      field_name: 'content',
      field_schema: {
        type: 'text',
        tokenizer: 'word',
        min_token_len: 2,
        max_token_len: 20,
        lowercase: true,
      },
      wait: false,
    }),
  ]);

  documentChunksEnsured = true;
}

export async function ensureImageEmbeddingsCollection(): Promise<void> {
  if (imageEmbeddingsEnsured) return;

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_IMAGE_EMBEDDINGS);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_IMAGE_EMBEDDINGS, {
      vectors: { size: 512, distance: 'Cosine' },
    });
  }

  await Promise.allSettled([
    qdrant.createPayloadIndex(COLLECTION_IMAGE_EMBEDDINGS, {
      field_name: 'documentId',
      field_schema: 'keyword',
      wait: false,
    }),
    qdrant.createPayloadIndex(COLLECTION_IMAGE_EMBEDDINGS, {
      field_name: 'userId',
      field_schema: 'keyword',
      wait: false,
    }),
  ]);

  imageEmbeddingsEnsured = true;
}

export async function getCollectionInfo(name: string) {
  return qdrant.getCollection(name);
}

export async function initializeQdrantCollections(): Promise<void> {
  await ensureDocumentChunksCollection();
  await ensureImageEmbeddingsCollection();
}
