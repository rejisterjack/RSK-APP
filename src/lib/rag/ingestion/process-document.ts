/**
 * Synchronous Document Processor
 *
 * Processes a document (chunk + embed + store) without Inngest.
 * Used as a fallback when the Inngest dev server isn't running.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ChunkingEngine } from '@/lib/rag/chunking';
import { createEmbeddings } from '@/lib/rag/engine';
import { scrapeURL } from '@/lib/rag/ingestion/parsers/url';
import { isYouTubeUrl, parseYouTube } from '@/lib/rag/ingestion/parsers/youtube';

type ErrorCategory = 'PARSE_ERROR' | 'EMBEDDING_ERROR' | 'NETWORK_ERROR' | 'SIZE_LIMIT' | 'UNKNOWN';

function classifyError(error: unknown): ErrorCategory {
  const msg = error instanceof Error ? error.message.toLowerCase() : '';
  if (msg.includes('embed') || msg.includes('vector')) return 'EMBEDDING_ERROR';
  if (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch')
  )
    return 'NETWORK_ERROR';
  if (msg.includes('size') || msg.includes('limit') || msg.includes('too large'))
    return 'SIZE_LIMIT';
  if (msg.includes('parse') || msg.includes('extract') || msg.includes('content'))
    return 'PARSE_ERROR';
  return 'UNKNOWN';
}

const STALE_PROCESSING_MS = 5 * 60 * 1000; // 5 minutes — likely killed by function timeout

/**
 * Check that the document still exists and hasn't been deleted mid-processing.
 * Throws a specific error if the document is gone so the caller can stop cleanly.
 */
async function ensureDocumentExists(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true } });
  if (!doc) throw new Error(`Document deleted during processing: ${documentId}`);
}

export async function processDocumentDirect(
  documentId: string,
  _userId: string
): Promise<{ success: boolean; chunkCount: number; processingTimeMs: number }> {
  const startTime = Date.now();
  let job: { id: string } | null = null;
  let metadata: Record<string, unknown> = {};

  try {
    // Step 0: Detect stale processing from a previous killed attempt
    const existingJob = await prisma.ingestionJob.findUnique({ where: { documentId } });
    if (existingJob?.status === 'PROCESSING' && existingJob.startedAt) {
      const elapsed = Date.now() - existingJob.startedAt.getTime();
      if (elapsed > STALE_PROCESSING_MS) {
        // Previous processing was likely killed by function timeout — mark it failed
        logger.warn('Detected stale processing job, marking as failed', {
          documentId,
          elapsedMs: elapsed,
        });
        await prisma.ingestionJob.update({
          where: { id: existingJob.id },
          data: {
            status: 'FAILED',
            error: 'Processing timed out (function was likely killed)',
            completedAt: new Date(),
          },
        });
        // Preserve original metadata when marking as failed
        const existingDoc = await prisma.document.findUnique({
          where: { id: documentId },
          select: { metadata: true },
        });
        const existingMeta = (existingDoc?.metadata as Record<string, unknown>) || {};
        await prisma.document
          .update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              metadata: { ...existingMeta, error: 'Processing timed out' },
            },
          })
          .catch(() => {});
        // Clean up any partial chunks from the killed attempt
        await prisma.documentChunk.deleteMany({ where: { documentId } }).catch(() => {});
      }
    }

    // Step 1: Create/update ingestion job
    await prisma.ingestionJob.deleteMany({ where: { documentId } });
    job = await prisma.ingestionJob.create({
      data: { documentId, status: 'PROCESSING', progress: 5, startedAt: new Date() },
    });

    // Step 2: Fetch document
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new Error(`Document not found: ${documentId}`);
    metadata = (document.metadata as Record<string, unknown>) || {};

    await prisma.document.update({ where: { id: documentId }, data: { status: 'PROCESSING' } });

    // Step 2b: Parse content if needed
    let parsedText = document.content;

    if (!parsedText) {
      if (
        (document.contentType === 'VIDEO' || metadata.isYouTube) &&
        metadata.sourceUrl &&
        typeof metadata.sourceUrl === 'string' &&
        isYouTubeUrl(metadata.sourceUrl)
      ) {
        const ytResult = await parseYouTube(metadata.sourceUrl);
        parsedText = ytResult.text;
        await prisma.document.update({ where: { id: documentId }, data: { content: parsedText } });
      } else if (
        document.contentType === 'HTML' &&
        metadata.sourceUrl &&
        typeof metadata.sourceUrl === 'string'
      ) {
        const scraped = await scrapeURL(metadata.sourceUrl);
        parsedText = scraped.text;
        await prisma.document.update({ where: { id: documentId }, data: { content: parsedText } });
      } else {
        throw new Error('Document has no content');
      }
    }

    await prisma.ingestionJob.update({ where: { id: job.id }, data: { progress: 20 } });

    // Check document wasn't deleted before expensive chunking operation
    await ensureDocumentExists(documentId);

    // Step 3: Chunk
    const defaultChunkSize =
      document.contentType === 'PDF' ? 1200 : document.contentType === 'MD' ? 1500 : 1000;
    let strategy: 'fixed' | 'semantic' | 'hierarchical' | 'late' = 'fixed';
    let chunkSize = defaultChunkSize;
    let chunkOverlap = 200;

    if (document.workspaceId) {
      try {
        const workspace = await prisma.workspace.findUnique({
          where: { id: document.workspaceId },
          select: { settings: true },
        });
        if (workspace?.settings) {
          const settings = workspace.settings as Record<string, unknown>;
          const ragSettings = settings.rag as Record<string, unknown> | undefined;
          if (ragSettings?.chunkingStrategy)
            strategy = ragSettings.chunkingStrategy as typeof strategy;
          if (typeof ragSettings?.chunkSize === 'number') chunkSize = ragSettings.chunkSize;
          if (typeof ragSettings?.chunkOverlap === 'number')
            chunkOverlap = ragSettings.chunkOverlap;
        }
      } catch {
        // Fall back to defaults
      }
    }

    const chunks = await ChunkingEngine.chunk(parsedText, {
      strategy,
      chunkSize,
      chunkOverlap,
      documentId,
    });

    await prisma.ingestionJob.update({ where: { id: job.id }, data: { progress: 40 } });

    // Check document wasn't deleted before expensive embedding operation
    await ensureDocumentExists(documentId);

    // Step 4: Generate embeddings in batches
    const embeddings = createEmbeddings();
    const batchSize = 100;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const contents = batch.map((chunk) => chunk.content);
      const embeddingVectors = await embeddings.embedDocuments(contents);

      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const vector = embeddingVectors[j];
        await prisma.$executeRaw`
          INSERT INTO "document_chunks" (
            "id", "documentId", "content", "embedding", "index", "start", "end", "page", "section", "createdAt"
          ) VALUES (
            ${crypto.randomUUID()},
            ${documentId},
            ${chunk.content},
            ${vector}::vector,
            ${chunk.metadata.index},
            ${chunk.metadata.start},
            ${chunk.metadata.end},
            ${chunk.metadata.page ?? null},
            ${chunk.metadata.headings?.[0] ?? null},
            NOW()
          )
        `;
      }

      const progress = Math.round(50 + ((i + batch.length) / chunks.length) * 45);
      await prisma.ingestionJob.update({ where: { id: job.id }, data: { progress } });
    }

    // Step 5: Finalize
    const processingTime = Date.now() - startTime;
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        metadata: {
          ...metadata,
          processedAt: new Date().toISOString(),
          processingTimeMs: processingTime,
          totalChunks: chunks.length,
        },
      },
    });

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
    });

    logger.info('Document processed', {
      documentId,
      chunkCount: chunks.length,
      processingTimeMs: processingTime,
    });

    return { success: true, chunkCount: chunks.length, processingTimeMs: processingTime };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    const errorCategory = classifyError(error);

    logger.error('Document processing failed', {
      documentId,
      error: errorMessage,
      category: errorCategory,
    });

    // Clean up partial chunks
    await prisma.documentChunk.deleteMany({ where: { documentId } }).catch(() => {});

    // Mark document as failed
    await prisma.document
      .update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          metadata: {
            ...metadata,
            error: errorMessage,
            errorCategory,
            failedAt: new Date().toISOString(),
          },
        },
      })
      .catch(() => {});

    // Mark job as failed
    if (job?.id) {
      await prisma.ingestionJob
        .update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: errorMessage,
            errorCategory,
            completedAt: new Date(),
          },
        })
        .catch(() => {});
    }

    throw error;
  }
}
