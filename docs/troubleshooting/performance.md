# Performance Troubleshooting

This guide covers performance issues across the RAG pipeline, including vector search, memory usage, page load times, and database maintenance.

---

## "Slow vector search"

Vector similarity search queries take longer than expected, causing delayed chat responses or timeout errors.

### Check if an index exists

By default, `pgvector` performs a sequential scan on all rows. For tables with more than a few thousand rows, you need an index. Check for existing indexes:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks'
  AND indexdef LIKE '%embedding%';
```

### Create a vector index

The application includes index creation utilities in `src/lib/db/vector-operations.ts` and `src/lib/rag/retrieval/vector.ts`. Two index types are available:

**IVFFlat** (good for datasets up to ~1 million rows):

```sql
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

The `lists` parameter should be approximately `rows / 1000`. For 100,000 rows, use `lists = 100`.

**HNSW** (better for larger datasets, slower to build but faster to query):

```sql
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
ON document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### Tune query parameters

**IVFFlat probes**: The `probes` parameter controls how many lists are searched. Higher values are more accurate but slower:

```sql
SET ivfflat.probes = 10;  -- Default is 1, increase for better recall
```

**HNSW ef_search**: Controls search width. Higher values are more accurate:

```sql
SET hnsw.ef_search = 100;  -- Default is 40, increase for better recall
```

### Check query performance

Use `EXPLAIN ANALYZE` to understand query performance:

```sql
EXPLAIN ANALYZE
SELECT id, content,
  1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as score
FROM document_chunks
WHERE embedding IS NOT NULL
  AND 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) > 0.7
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

Look for:
- **Seq Scan**: No index is being used. Create an index.
- **Index Scan**: The index is being used. Check the execution time.
- **Bitmap Index Scan**: Partial index usage. May need tuning.

### Slow query logging

The application logs Prisma queries that take longer than 1 second (configured in `src/lib/db/client.ts`):

```typescript
// Warn on queries taking longer than 1000ms
if (durationMs > 1000) {
  logger.warn('Slow Prisma query', { model, operation, durationMs });
}
```

Check the logs for slow query warnings:

```bash
# In development
pnpm dev | grep "Slow Prisma query"
```

---

## "High memory usage"

The application uses more memory than expected, particularly during document ingestion.

### Embedding batch size

When ingesting documents, embeddings are generated in batches. The default batch size is 100 chunks. For large documents, this means 100 embedding vectors are held in memory simultaneously.

Reduce the batch size to lower memory usage:

```typescript
// In your ingestion call
const options = {
  batchSize: 25, // Process 25 chunks at a time instead of 100
};
```

### Document chunk count

Large documents produce many chunks. Check the chunk count:

```sql
SELECT d.name, COUNT(dc.id) as chunk_count
FROM documents d
JOIN document_chunks dc ON dc.document_id = d.id
GROUP BY d.id, d.name
ORDER BY chunk_count DESC
LIMIT 10;
```

Documents with thousands of chunks consume significant memory during re-embedding or search operations.

### Connection pool size

Each database connection uses memory. Check the pool configuration in `src/lib/db/client.ts`:

- Development: 3 connections
- Serverless: 5 connections
- Production: 15 connections

Override with `DB_POOL_MAX`:

```env
DB_POOL_MAX=10
```

### Node.js heap size

For large workloads, increase the Node.js heap size:

```bash
NODE_OPTIONS="--max-old-space-size=2048" pnpm start
```

Monitor memory usage:

```bash
# Get the process ID
lsof -i :3000 | grep LISTEN

# Check memory usage (macOS/Linux)
ps -o pid,rss,vsz,comm -p <PID>
```

---

## "Slow page load"

The web interface loads slowly, with high Time to First Byte (TTFB) or large bundle sizes.

### Analyze the bundle

The project includes `@next/bundle-analyzer` (configured in `next.config.ts`):

```bash
ANALYZE=true pnpm build
```

This opens a visualization of the JavaScript bundle in your browser. Look for:
- Large dependencies that could be code-split
- Unused exports that are not tree-shaken
- Client-side imports of server-only modules

### Code splitting

The `next.config.ts` includes optimized package imports:

```typescript
optimizePackageImports: [
  'recharts',
  'd3',
  'tesseract.js',
  'lucide-react',
  'date-fns',
  'framer-motion',
  'react-markdown',
  '@tanstack/react-virtual',
],
```

If you add a new large dependency, add it to this list so Next.js can tree-shake unused exports.

### Image optimization

The Next.js image configuration supports WebP and AVIF:

```typescript
images: {
  formats: ["image/avif", "image/webp"],
}
```

Use the `<Image>` component from `next/image` for automatic optimization. Do not use raw `<img>` tags for user-uploaded or static images.

### Static asset caching

The `vercel.json` configures long-lived caching for static assets:

```json
{
  "source": "/_next/static/(.*)",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
  ]
}
```

For non-Vercel deployments, configure your reverse proxy with similar caching headers.

### Server-side rendering performance

Use `loading.tsx` files for route-level suspense boundaries. The project includes `src/app/loading.tsx` with a skeleton loader. For slow data-fetching pages, ensure the loading state is shown immediately.

### Middleware execution time

The middleware (`src/middleware.ts`) runs on every request. If it is slow, it adds latency to every page load and API call. Profile it:

```bash
# Enable debug logging
LOG_LEVEL=debug pnpm dev
```

Look for middleware-related log entries with timing information.

---

## "Database bloat"

The database grows larger than expected, and queries become slower over time.

### Check table sizes

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname || '.' || tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### Check document_chunks size

The `document_chunks` table is typically the largest because it stores both text content and vector embeddings:

```sql
SELECT
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embeddings,
  pg_size_pretty(pg_total_relation_size('document_chunks')) as total_size
FROM document_chunks;
```

### VACUUM the database

PostgreSQL's autovacuum handles most maintenance, but for large tables, a manual VACUUM can help:

```sql
-- Standard VACUUM (does not lock the table)
VACUUM document_chunks;

-- VACUUM ANALYZE (also updates query planner statistics)
VACUUM ANALYZE document_chunks;

-- Full VACUUM (reclaims all space, but locks the table)
-- Only run during maintenance windows
VACUUM FULL document_chunks;
```

The application includes a `vacuumVectorTable` function in `src/lib/db/vector-operations.ts`.

### Partition management

The application includes a partition manager (`src/lib/db/partition-manager.ts`) for managing large datasets:

```typescript
import { ensurePartitions, checkPartitionHealth, detachOldPartitions } from '@/lib/db';
```

The Inngest background jobs include periodic partition health checks and maintenance.

### Archive old data

For workspaces that are no longer active, archive their documents:

```typescript
import { archiveWorkspaceDocuments } from '@/lib/db';
await archiveWorkspaceDocuments(workspaceId);
```

This moves old data to detached partitions, reducing the active table size.

### Remove orphaned vectors

Over time, chunks may become orphaned (the parent document was deleted but chunks remain):

```sql
-- Find orphaned chunks
SELECT COUNT(*) FROM document_chunks dc
LEFT JOIN documents d ON d.id = dc.document_id
WHERE d.id IS NULL;
```

The application includes `removeOrphanedVectors` in `src/lib/db/vector-operations.ts`:

```typescript
import { removeOrphanedVectors } from '@/lib/db';
await removeOrphanedVectors();
```

### Audit log cleanup

Audit logs accumulate over time. For GDPR compliance and performance, periodically archive or delete old logs:

```sql
-- Check audit log size
SELECT COUNT(*), pg_size_pretty(pg_total_relation_size('audit_logs'))
FROM audit_logs;

-- Delete logs older than 90 days (adjust retention as needed)
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
```

### Rate limit cleanup

The `rate_limits` table tracks request counts per time window. Old entries should be cleaned up:

```sql
DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
```

---

## Monitoring production performance

### RAG Events analytics

The `rag_events` table tracks every query through the RAG pipeline:

```sql
SELECT
  AVG(latency_ms) as avg_latency,
  MAX(latency_ms) as max_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
  COUNT(*) as total_queries
FROM rag_events
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### Slow queries dashboard

Query the slow query log from the application logs or use the database-level slow query log:

```sql
-- Enable slow query logging in PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
SELECT pg_reload_conf();
```

### Health check endpoint

The application exposes `/api/health` for monitoring. Use it with your uptime monitor:

```bash
curl -s http://localhost:3000/api/health | jq
```

---

## Still having issues?

1. Run `EXPLAIN ANALYZE` on your slowest queries to understand the execution plan.
2. Check the RAG events table for latency trends over time.
3. Use `ANALYZE=true pnpm build` to inspect the JavaScript bundle.
4. Monitor database connections with `pg_stat_activity`:

```sql
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;
```

5. Open a GitHub issue with the specific query or page that is slow, the dataset size, and the database provider.
