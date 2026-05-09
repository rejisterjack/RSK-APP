-- Add HNSW index on document_chunks.embedding for fast vector similarity search.
-- Uses cosine distance (most common for text embeddings).
-- Requires pgvector extension (already enabled).

-- Set HNSW build parameters for better recall at modest build-time cost.
-- Use SET LOCAL to scope the parameter to the current transaction.
-- Neon/pgvector newer versions use "vectors." prefix for these params.
SET vectors.hnsw_ef_construction = 128;

CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops);
