# Document Ingestion Issues

This guide covers problems encountered during the document ingestion pipeline. The pipeline is defined in `src/lib/rag/ingestion/pipeline.ts` and `src/lib/rag/ingestion/index.ts`, with background processing handled by Inngest in `src/lib/inngest/functions.ts`.

---

## Error Categories

The ingestion system classifies errors into categories (defined in `src/lib/rag/ingestion/errors.ts`):

| Category | Description |
|---|---|
| `PARSE_ERROR` | File is corrupted or uses an unsupported format |
| `EMBEDDING_ERROR` | Embedding provider failure (API key, rate limit, dimensions) |
| `SIZE_LIMIT` | File exceeds the maximum allowed size |
| `OCR_FAILURE` | Tesseract OCR processing failed |
| `PROVIDER_ERROR` | LLM or AI provider returned an error |
| `NETWORK_ERROR` | Connection timeout, DNS failure, connection refused |
| `UNKNOWN` | Unexpected error not matching other patterns |

You can check the error category for a specific document:

```sql
SELECT d.name, ij.status, ij.error, ij.error_category
FROM ingestion_jobs ij
JOIN documents d ON d.id = ij.document_id
WHERE ij.status = 'FAILED';
```

---

## "Document upload fails"

The upload request returns an error before processing begins.

### File size limits

The ingestion pipeline defaults to a 50 MB maximum file size (configured in `src/lib/rag/ingestion/pipeline.ts`):

```typescript
maxFileSize: 50 * 1024 * 1024, // 50MB
```

Additionally, the Next.js server action body size limit is set to 4 MB in `next.config.ts`:

```typescript
serverActions: {
  bodySizeLimit: '4mb',
}
```

For larger files, use the direct upload API endpoint instead of server actions, or increase the limit in `next.config.ts`.

### Unsupported file format

The pipeline supports these formats (defined in the `MIME_TYPE_MAP` and `EXTENSION_MAP` in `src/lib/rag/ingestion/pipeline.ts`):

- **Documents**: PDF, DOCX, TXT, Markdown, HTML
- **Spreadsheets**: XLSX
- **Presentations**: PPTX
- **Images**: PNG, JPEG, TIFF, BMP, WebP, GIF
- **Audio**: MP3, WAV, WebM, OGG, M4A, FLAC
- **Video**: MP4, WebM, MOV, AVI, MKV

If you upload a file with an unsupported extension (e.g., `.rtf`, `.epub`, `.odt`), the system will attempt to process it as plain text, which may fail or produce garbage output.

### Virus scan blocking

If ClamAV integration is enabled (`enableVirusScan: true`), infected files will be rejected. Check the server logs for virus scan results.

---

## "Ingestion stuck in 'processing'"

The document shows a status of `PROCESSING` or the ingestion job stays in `QUEUED`/`PROCESSING` indefinitely.

### Check the Inngest dashboard

Document ingestion is handled as a background job by Inngest. If Inngest is not running, jobs will queue but never process.

1. Start the Inngest dev server:

```bash
pnpm inngest:dev
```

2. Open the Inngest dev dashboard (usually http://localhost:8288) to see job status.

3. For production, configure `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` in your environment, and set up the Inngest webhook URL in the Inngest dashboard.

### Redis connection issues

Inngest uses Redis for job coordination. If Redis is unavailable:

1. Check Redis connectivity:

```bash
# For local Docker Redis
docker compose exec redis redis-cli ping
# Should return: PONG
```

2. Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set correctly in production.

3. In development, the application falls back to an in-memory Redis mock (see `src/lib/redis.ts`). This mock does not persist across restarts.

### Check the ingestion job status

```sql
SELECT ij.*, d.name as document_name
FROM ingestion_jobs ij
JOIN documents d ON d.id = ij.document_id
WHERE ij.status IN ('QUEUED', 'PROCESSING')
ORDER BY ij.created_at DESC;
```

### Reset a stuck job

If a job is truly stuck (not just slow):

```sql
-- Reset the job to allow re-processing
UPDATE ingestion_jobs
SET status = 'FAILED', error = 'Manually reset: job was stuck'
WHERE id = 'YOUR_JOB_ID';

-- Reset the document status
UPDATE documents
SET status = 'PENDING'
WHERE id = 'YOUR_DOCUMENT_ID';
```

Then re-trigger ingestion through the UI or API.

---

## "OCR failure on scanned PDF"

OCR processing fails or produces very low quality text from scanned documents.

### Tesseract requirements

The application uses `tesseract.js` for OCR, which runs entirely in JavaScript. No system-level Tesseract installation is required, but it does download language data files on first use.

### OCR configuration

OCR settings are managed in `src/lib/rag/ingestion/ocr-config.ts`. Key settings:

```typescript
const DEFAULT_OCR_CONFIG = {
  language: 'eng',
  oem: OCREngineMode.LSTM_ONLY,      // Neural net engine
  psm: PageSegmentationMode.AUTO,     // Auto page segmentation
  confidenceThreshold: 60,            // Min confidence (0-100)
  preprocessing: {
    enabled: true,
    deskew: true,                     // Straighten tilted scans
    denoise: true,                    // Remove noise
    contrastEnhancement: true,        // Improve contrast
    maxDimension: 3000,              // Resize if larger
    minDpi: 150,                     // Minimum DPI
  },
  timeoutMs: 120000,                  // 2 minute timeout
};
```

### Improve OCR quality

1. **Use higher quality scans**: Ensure the PDF was scanned at 300 DPI or higher. Low-resolution scans produce poor OCR results.

2. **Set the correct language**: If the document is not in English, set the OCR language:

```env
OCR_LANGUAGE=deu    # German
OCR_LANGUAGE=fra    # French
OCR_LANGUAGE=chi_sim  # Simplified Chinese
```

For multilingual documents, combine languages with `+`:

```env
OCR_LANGUAGE=eng+deu
```

3. **Enable preprocessing**: Ensure preprocessing is enabled in the OCR config. It applies deskewing, denoising, and contrast enhancement before recognition.

4. **Increase timeout**: Large scanned documents may exceed the default 2-minute timeout:

```env
OCR_TIMEOUT_MS=300000   # 5 minutes
```

### Check OCR results

```sql
SELECT name, ocr_processed, ocr_confidence, ocr_error, ocr_processing_time_ms
FROM documents
WHERE ocr_processed = true
ORDER BY ocr_confidence ASC;
```

Documents with `ocr_confidence` below 60 may have poor quality text. Consider re-scanning the source document at higher resolution.

---

## "Parsing error on specific file"

The ingestion fails with a `PARSE_ERROR` category.

### File corruption

Download the original file and try opening it in the native application (Adobe Reader for PDF, Word for DOCX). If the file is corrupted, re-export or re-download it.

### Encoding issues

Text files with non-UTF-8 encoding may cause parsing errors. Convert the file to UTF-8:

```bash
iconv -f ISO-8859-1 -t UTF-8 input.txt > output.txt
```

### PDF-specific issues

Some PDFs use non-standard encodings, have embedded fonts without Unicode mapping, or are password-protected. The `pdf-parse` library handles most standard PDFs but may fail on:

- **Password-protected PDFs**: Remove the password before uploading
- **PDFs with only images** (scanned): Enable OCR (see above)
- **Corrupted PDF structure**: Re-save with `qpdf`:

```bash
qpdf --linearize input.pdf output.pdf
```

### DOCX-specific issues

Complex DOCX files with embedded objects, macros, or unusual formatting may not parse cleanly. Try saving as plain text or simpler DOCX format before uploading.

---

## "Embedding fails during ingestion"

The document is parsed and chunked successfully, but embedding generation fails. This produces an `EMBEDDING_ERROR` category.

### Check the provider status

The embedding provider is determined by `EMBEDDING_PROVIDER` in `.env`. Common failures:

1. **API key invalid or expired**: See [Embedding Issues](./embedding-issues.md) for provider-specific troubleshooting.
2. **Rate limit exceeded**: The Google Gemini free tier allows ~1,500 requests per day. Large documents with many chunks can exhaust this quickly.
3. **Dimension mismatch**: If the embedding model dimensions do not match the database column (`vector(768)` by default), insertion will fail. See the "Dimension mismatch error" section in [Embedding Issues](./embedding-issues.md).
4. **Provider down**: Check the provider status page. OpenAI, Google, and Ollama can have outages.

### Partial failures

The ingestion pipeline supports partial failures. Chunks that fail to embed are tracked separately, and the document can still be marked as `COMPLETED` with some chunks missing embeddings. Check the ingestion job error field:

```sql
SELECT error, error_category
FROM ingestion_jobs
WHERE document_id = 'YOUR_DOCUMENT_ID';
```

### Retry failed ingestion

Reset the document and re-ingest:

```sql
UPDATE documents SET status = 'PENDING' WHERE id = 'YOUR_DOCUMENT_ID';
DELETE FROM ingestion_jobs WHERE document_id = 'YOUR_DOCUMENT_ID';
```

Then trigger ingestion again via the UI or the `/api/ingest` endpoint.

---

## Monitoring ingestion progress

### Pipeline stages and progress values

The `ingestion_jobs` table tracks progress as a percentage:

| Progress | Stage |
|---|---|
| 0 | Queued |
| 10 | Parsing document |
| 30 | Creating chunks |
| 70 | Generating embeddings |
| 95 | Storing in database |
| 100 | Complete |

### Query active jobs

```sql
SELECT
  d.name,
  ij.status,
  ij.progress,
  ij.error,
  ij.error_category,
  ij.started_at,
  ij.created_at
FROM ingestion_jobs ij
JOIN documents d ON d.id = ij.document_id
ORDER BY ij.created_at DESC
LIMIT 20;
```

### Check chunk counts per document

```sql
SELECT
  d.name,
  COUNT(dc.id) as total_chunks,
  COUNT(dc.embedding) as embedded_chunks
FROM documents d
LEFT JOIN document_chunks dc ON dc.document_id = d.id
GROUP BY d.id, d.name
ORDER BY d.created_at DESC;
```

---

## Still having issues?

1. Check the ingestion job error and error_category in the database.
2. Look at the server logs for the full stack trace during ingestion.
3. Try uploading a small, simple file (e.g., a plain `.txt` file) to verify the pipeline works end-to-end.
4. If using Inngest, check the Inngest dashboard for function execution logs.
5. Open a GitHub issue with the file type, file size, error message, and error category.
