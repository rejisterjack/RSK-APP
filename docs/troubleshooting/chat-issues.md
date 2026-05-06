# Chat Issues

This guide covers problems with the chat interface, LLM responses, and streaming. The chat pipeline is orchestrated in `src/lib/rag/engine.ts` and uses OpenRouter as the default LLM provider (configured in `src/lib/ai/openrouter.ts`).

---

## "Chat returns 500 error"

When you send a message in the chat, the server returns a 500 Internal Server Error.

### Check the server logs

The error is logged server-side. In development:

```bash
pnpm dev
# Look for "RAG pipeline error" or "Failed to generate response" in the output
```

### LLM provider issues

The most common cause is a problem with the LLM provider (OpenRouter by default).

**Invalid API key**: Verify `OPENROUTER_API_KEY` is set and valid:

```bash
# Test the key directly
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-3.1-8b-instruct:free",
    "messages": [{"role": "user", "content": "hello"}]
  }'
```

If the response contains `"error"`, your key is invalid or expired. Get a new key at https://openrouter.ai/keys.

**Model unavailable**: Free models on OpenRouter can be temporarily unavailable. Check the OpenRouter status page or try a different model. The default models are defined in `src/lib/ai/openrouter.ts`:

```typescript
export const FREE_MODELS = {
  MISTRAL_7B: 'mistralai/mistral-7b-instruct:free',
  GEMMA_2_9B: 'google/gemma-2-9b-it:free',
  LLAMA_3_1_8B: 'meta-llama/llama-3.1-8b-instruct:free',
  // ...
};
```

### No relevant documents (empty context)

If no documents match the query (or no documents have been uploaded to the workspace), the RAG pipeline will still try to generate a response, but the quality will be poor. Check:

1. Documents are uploaded and have status `COMPLETED`:

```sql
SELECT id, name, status FROM documents WHERE status != 'COMPLETED';
```

2. Document chunks have embeddings:

```sql
SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL;
```

### Embedding generation fails during chat

When a user sends a query, the system embeds the query text using the configured embedding provider. If this fails (API key issue, rate limit, network error), the chat will return a 500.

Check `src/lib/env.ts` for the embedding configuration:

```env
EMBEDDING_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

See [Embedding Issues](./embedding-issues.md) for detailed troubleshooting.

---

## "Streaming not working"

Chat responses appear all at once instead of streaming token-by-token.

### Server-Sent Events (SSE) issues

The chat uses SSE for streaming responses. If you are running behind a reverse proxy, it may buffer the response.

**nginx configuration**: Add these headers to prevent buffering:

```nginx
location /api/chat {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
    proxy_read_timeout 300s;
}
```

**Apache**: Use `FlushInput` and disable buffering:

```apache
<Location /api/chat>
    ProxyPass http://localhost:3000
    ProxyPassReverse http://localhost:3000
    SetEnv no-proxy 1
</Location>
```

### Content Security Policy blocking

The middleware in `src/middleware.ts` sets a strict CSP that allows connections to OpenRouter and other AI providers. If you have customized `CSP_CONNECT_SRC`, make sure it includes your LLM provider:

```env
CSP_CONNECT_SRC=https://openrouter.ai,https://*.openrouter.ai
```

### Vercel serverless timeout

On Vercel, the chat API has a max duration of 300 seconds (configured in `vercel.json`). For very long responses, the function may time out. The `vercel.json` configuration:

```json
{
  "functions": {
    "app/api/chat/**/*.ts": {
      "maxDuration": 300
    }
  }
}
```

If you are on the Hobby plan, the max duration is limited to 60 seconds. Upgrade to Pro for 300 seconds.

### Client-side issues

Check the browser console for errors. Common issues:
- Fetch API timeouts
- Aborted requests (user navigated away)
- CORS errors (check `ALLOWED_ORIGINS` in `.env`)

---

## "Chat responses are irrelevant"

The chat returns answers that do not relate to your uploaded documents.

### Check retrieval quality

The RAG pipeline retrieves relevant chunks before generating a response. If retrieval is poor, the response will be poor. Check these factors:

**Similarity threshold too high**: The default threshold is 0.7 (configured in `src/lib/rag/engine.ts`). If too few chunks pass the threshold, the LLM gets no context. Try lowering it:

```typescript
const config = {
  similarityThreshold: 0.5, // Lower threshold
  topK: 10,                 // Retrieve more chunks
};
```

**Chunk size too small**: Default chunk size is 1000 characters with 200 overlap. If chunks are too small, important context gets split across chunks. Adjust in `defaultRAGConfig`:

```typescript
chunkSize: 1500,
chunkOverlap: 300,
```

**Re-ranking not enabled**: The system supports re-ranking retrieved results for better relevance. Check if the reranker is configured in `src/lib/rag/retrieval/reranker.ts`.

### Check document quality

- Were the documents parsed correctly? Check the document content:

```sql
SELECT id, name, status, metadata FROM documents WHERE id = 'YOUR_DOC_ID';
```

- Are there enough chunks? A single-page document might produce very few chunks.

- Is the OCR confidence low? Check:

```sql
SELECT name, ocr_processed, ocr_confidence, ocr_error
FROM documents
WHERE ocr_processed = true AND (ocr_confidence IS NULL OR ocr_confidence < 60);
```

### LLM model quality

Free models on OpenRouter have varying quality. If responses are consistently poor:

1. Try a different model with better reasoning capabilities
2. Consider using a paid model on OpenRouter for production workloads
3. Adjust the system prompt in `src/lib/rag/engine.ts`

---

## "Context window exceeded"

The LLM returns an error about exceeding the context window, or the response is cut off.

### Understanding context composition

The total context sent to the LLM includes:
1. System prompt (RAG instructions)
2. Retrieved document chunks (source context)
3. Conversation history (previous messages)
4. Current user query

### Reduce the number of retrieved chunks

Lower `topK` to retrieve fewer chunks:

```typescript
const config = {
  topK: 3, // Retrieve only the top 3 most relevant chunks
};
```

### Manage conversation length

Long conversations accumulate tokens in the history. Solutions:

1. **Start a new chat** for a different topic
2. **Reduce `maxTokens`** in the config to limit response length
3. **Implement conversation summarization** to compress older messages

### Check model context limits

Each model has a maximum context window (defined in `src/lib/ai/openrouter.ts`):

```typescript
export const MODEL_CONFIG = {
  [FREE_MODELS.MISTRAL_7B]: { maxTokens: 8192, contextWindow: 32768 },
  [FREE_MODELS.LLAMA_3_1_8B]: { maxTokens: 8192, contextWindow: 128000 },
  [FREE_MODELS.PHI_3_MINI]: { maxTokens: 4096, contextWindow: 128000 },
  // ...
};
```

If your document chunks plus conversation history exceed the context window, switch to a model with a larger window (like `meta-llama/llama-3.1-8b-instruct:free` with 128K context).

---

## "OpenRouter rate limiting (429)"

You see HTTP 429 errors when using OpenRouter for chat or embeddings.

### Understanding the limits

OpenRouter rate limits depend on your plan:
- **Free tier**: Limited requests per minute, varies by model
- **Paid tier**: Higher limits based on credits

### Immediate fixes

1. **Retry with backoff**: The application includes built-in retry logic in `src/lib/rag/error-handling.ts` via the `ResilientRAGChain` class. Ensure it is configured with appropriate retry settings.

2. **Switch to a different model**: Free models share rate limits. Switching to a different model may bypass the limit:

```env
DEFAULT_MODEL=google/gemma-2-9b-it:free
```

3. **Upgrade your OpenRouter plan**: Add credits at https://openrouter.ai/credits for higher rate limits.

### Use a different LLM provider

The workspace model can be overridden per-workspace in the `workspaces` table:

```sql
UPDATE workspaces
SET llm_provider = 'openai', llm_model = 'gpt-4o-mini'
WHERE id = 'YOUR_WORKSPACE_ID';
```

Or configure directly in `.env`:

```env
OPENAI_API_KEY=sk-...
DEFAULT_MODEL=gpt-4o-mini
```

### Circuit breaker protection

The application includes a circuit breaker (`src/lib/rag/error-handling.ts`) that stops making requests to a failing provider after repeated failures. If the circuit breaker opens, wait for the reset timeout (default: 30 seconds) or restart the application.

---

## Still having issues?

1. Check the full error in the server logs. The RAG pipeline logs detailed error messages at each stage.
2. Verify your LLM provider is responding by testing the API directly with `curl`.
3. Check the `rag_events` table for query-level analytics:

```sql
SELECT query, latency_ms, total_tokens, model, created_at
FROM rag_events ORDER BY created_at DESC LIMIT 10;
```

4. Open a GitHub issue with the full error message, model name, and the steps to reproduce.
