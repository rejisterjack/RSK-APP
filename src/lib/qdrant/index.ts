export { checkQdrantHealth, qdrant } from './client';
export {
  COLLECTION_DOCUMENT_CHUNKS,
  COLLECTION_IMAGE_EMBEDDINGS,
  ensureDocumentChunksCollection,
  ensureImageEmbeddingsCollection,
  getCollectionInfo,
  initializeQdrantCollections,
} from './collections';
export { buildQdrantFilter, buildQdrantFilterFromRetrievalOptions } from './filters';
export {
  type ChunkPointData,
  type SearchOptions as QdrantSearchOptions,
  type UpsertOptions,
  batchSearch,
  deleteByDocumentId,
  deleteImagePoints,
  getDocumentStats,
  searchHybrid,
  searchKeyword,
  searchSimilar,
  searchSimilarImages,
  upsertChunks,
  upsertImageEmbedding,
} from './points';
