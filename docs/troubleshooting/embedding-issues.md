# Embedding Issues

This guide covers problems related to embedding generation, which is central to the RAG pipeline. Embeddings are configured via environment variables in `src/lib/env.ts` and the provider factory in `src/lib/ai/embeddings/index.ts`.

---

## "Dimension mismatch error"

You see an error like `vector dimension mismatch` or `expected 768 dimensions, got 1536` when inserting embeddings or searching.

### Understanding the dimension constraint

The `document_chunks` table in `prisma/schema.prisma` defines the embedding column as:

```prisma
embedding   Unsupported("vector(768)")?
```

This means the database column expects exactly 768-dimensional vectors. The default embedding provider is Google Gemini (`text-embedding-004`), which produces 768-dimensional vectors. If you switch providers without adjusting the column, you will get a dimension mismatch.

### Dimension reference by provider

| Provider | Model | Dimensions |
|---|---|---|
| Google | `text-embedding-004` (default) | 768 |
| Google | `embedding-001` | 768 |
| OpenAI | `text-embedding-3-small` | 1536 |
| OpenAI | `text-embedding-3-large` | 3072 |
| OpenAI | `text-embedding-ada-002` | 1536 |
| Ollama | `nomic-embed-text` | 768 |
| Ollama | `mxbai-embed-large` | 1024 |
| Ollama | `all-minilm` | 384 |

### Fixing the mismatch

**Option A: Switch to a provider with matching dimensions**

If your database column is `vector(768)`, use a 768D model. Set in `.env`:

```env
# Google Gemini (default, 768D)
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=text-embedding-004

# Or Ollama with nomic-embed-text (768D)
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434
```

**Option B: Change the database column to match the provider**

If you want to use OpenAI (1536D), you need to alter the vector column:

1. Create a new migration:

```bash
pnpm db:migrate
```

2. Write the SQL to alter the column. In the generated migration file:

```sql
-- Drop the existing index if present
DROP INDEX IF EXISTS "idx_chunks_embedding";

-- Alter the vector dimension
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(1536);

-- Recreate the index
CREATE INDEX "idx_chunks_embedding" ON "document_chunks"
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

3. Set the environment variable to match:

```env
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
OPENAI_API_KEY=sk-...
```

### Re-embedding after fixing dimensions

After changing the column or provider, existing documents will have incompatible embeddings. You must re-embed all documents. See the "Re-embedding after model change" section below.

---

## "Embedding provider returns 401"

You see a 401 Unauthorized error when the application tries to generate embeddings.

### Google Gemini (`EMBEDDING_PROVIDER=google`)

The Google provider uses `GOOGLE_GENERATIVE_AI_API_KEY`. Verify it is set:

```bash
grep GOOGLE_GENERATIVE_AI_API_KEY .env
```

Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey). The key should start with `AIzaSy...`.

Test the key:

```bash
curl -s "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/text-embedding-004","content":{"parts":[{"text":"hello"}]}}'
```

### OpenAI (`EMBEDDING_PROVIDER=openai`)

Requires `OPENAI_API_KEY`. Verify:

```bash
grep OPENAI_API_KEY .env
```

The key should start with `sk-...`. Test it:

```bash
curl https://api.openai.com/v1/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"hello"}'
```

### Quota exceeded (Google free tier)

The Google Gemini free tier allows approximately 1,500 embedding requests per day. The code tracks usage via Redis (see `src/lib/ai/embeddings/google.ts`). If you exceed the quota, you will see an `EmbeddingQuotaExceededError`.

Solutions:
- Wait for the daily reset
- Switch to a paid Google Cloud project
- Switch to a different provider (OpenAI or Ollama)

---

## "Ollama connection refused"

When using `EMBEDDING_PROVIDER=ollama`, you see `ECONNREFUSED` or `fetch failed` errors.

### Ollama is not running

Start Ollama:

```bash
# If installed as a native app (macOS)
open -a Ollama

# Or via CLI
ollama serve
```

Verify Ollama is responding:

```bash
curl http://localhost:11434/api/tags
```

### Wrong Ollama URL

The default URL is `http://localhost:11434`. If Ollama is running on a different host or port, set `OLLAMA_BASE_URL` in `.env`:

```env
OLLAMA_BASE_URL=http://192.168.1.100:11434
```

### Model not pulled

You must pull the embedding model before using it:

```bash
ollama pull nomic-embed-text
```

Verify the model is available:

```bash
ollama list
```

### Ollama in Docker

If both the RAG Starter Kit and Ollama are running in Docker, use the Docker network hostname:

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

On Linux, you may need `--add-host=host.docker.internal:host-gateway` in your Docker run command.

---

## Re-embedding after model change

When you switch embedding providers or models, all existing document embeddings become invalid. You must re-embed all documents for search to work correctly.

### Using the re-embed job

The Inngest background job system includes a `reEmbedWorkspaceJob` function (in `src/lib/inngest/functions.ts`). This processes all documents in a workspace through the new embedding provider.

Trigger it via the Inngest dashboard or by sending the appropriate event.

### Manual re-embedding

For a smaller number of documents, you can delete and re-ingest:

1. Delete existing document chunks and embeddings:

```bash
# Connect to the database
psql -U postgres -d ragdb

# Delete all chunks for a specific document
DELETE FROM document_chunks WHERE document_id = 'YOUR_DOCUMENT_ID';

# Reset the document status
UPDATE documents SET status = 'PENDING' WHERE id = 'YOUR_DOCUMENT_ID';
```

2. Re-trigger ingestion through the UI or API.

### Important warnings

- **Never mix embeddings from different models** in the same database. Vector similarity comparisons only work when all vectors use the same model and dimensions.
- **Re-embed all documents** after a provider change. Partial re-embedding will produce incorrect search results.
- **Update `EMBEDDING_DIMENSIONS`** to match the new model (e.g., 1536 for OpenAI).

---

## Slow embedding performance

Embedding generation is the bottleneck in document ingestion. Large documents can produce hundreds of chunks.

### Reduce batch size

The default batch size for embedding is 100. For providers with strict rate limits, reduce it:

In your `.env` or when calling the ingestion pipeline:

```typescript
const options = {
  batchSize: 25, // Process 25 chunks at a time
};
```

### Check provider rate limits

| Provider | Free Tier | Notes |
|---|---|---|
| Google Gemini | ~1,500 req/day | Tracked in Redis, warning at 93% |
| OpenAI | Pay per token | Rate limit: 3,000 RPM on Tier 1 |
| Ollama | Unlimited (local) | Limited by CPU/GPU speed |

### Use Ollama for local development

Ollama runs locally and has no rate limits. It is the fastest option for development:

```env
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434
```

The `nomic-embed-text` model produces 768D vectors, matching the default database column. No schema changes needed.

### Monitor embedding progress

During ingestion, check the `ingestion_jobs` table for progress:

```sql
SELECT document_id, status, progress, error
FROM ingestion_jobs
WHERE status IN ('QUEUED', 'PROCESSING');
```

Progress values: 0 (queued), 10 (parsing), 30 (chunking), 70 (embedding), 95 (storing), 100 (complete).

---

## Still having issues?

1. Check the server logs for the specific error message. Embedding errors are logged with the prefix `"Embedding generation failed"`.
2. Verify your embedding provider is reachable from the server (not blocked by firewall).
3. Try the embedding API directly with `curl` to isolate whether the issue is in the provider or in the application code.
4. Open a GitHub issue with the `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, and the full error message.
