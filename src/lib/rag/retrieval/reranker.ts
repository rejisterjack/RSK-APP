/**
 * Re-ranking Module
 *
 * Provides pluggable re-ranking implementations for the retrieval pipeline:
 * - CrossEncoderReranker: uses the configured LLM to score relevance (zero-shot)
 * - CohereReranker: uses Cohere's dedicated rerank API for high-quality re-ranking
 * - IdentityReranker: pass-through fallback that preserves original ordering
 *
 * The active reranker is selected via the RERANKER_PROVIDER env var and
 * activated via RERANKER_ENABLED.
 *
 * @module rag/retrieval/reranker
 */

import { createProviderFromEnv, type LLMProvider } from '@/lib/ai/llm/factory';
import type { LLMMessage } from '@/lib/ai/llm/types';
import { logger } from '@/lib/logger';
import type { RetrievedChunk } from './types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A document to be re-ranked. Maps from RetrievedChunk in the pipeline.
 */
export interface RerankDocument {
  id: string;
  content: string;
  /** Original retrieval score (e.g. RRF or cosine similarity). */
  score?: number;
  metadata?: Record<string, unknown>;
}

/**
 * A single re-ranked result with a new relevance score.
 */
export interface RerankResult {
  id: string;
  /** Normalised relevance score in the 0-1 range. */
  relevanceScore: number;
  /** The original retrieval score, if one was provided. */
  originalScore?: number;
  content: string;
}

/**
 * Options that can be passed at call-time to override defaults.
 */
export interface RerankOptions {
  /** Number of results to return after re-ranking (default: 5). */
  topN?: number;
  /** Model identifier (provider-specific). */
  model?: string;
}

/**
 * Contract that every reranker must implement.
 */
export interface Reranker {
  readonly name: string;
  rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions
  ): Promise<RerankResult[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert RetrievedChunk[] coming out of the hybrid pipeline into
 * RerankDocument[] suitable for the reranker.
 */
export function chunksToRerankDocs(chunks: RetrievedChunk[]): RerankDocument[] {
  return chunks.map((c) => ({
    id: c.id,
    content: c.content,
    score: c.score,
    metadata: { ...c.metadata, retrievalMethod: c.retrievalMethod },
  }));
}

/**
 * Apply RerankResult[] back onto the original RetrievedChunk[], preserving
 * metadata and updating scores and ordering.
 */
export function applyRerankResults(
  original: RetrievedChunk[],
  results: RerankResult[]
): RetrievedChunk[] {
  const chunkMap = new Map(original.map((c) => [c.id, c]));

  return results
    .map((r) => {
      const chunk = chunkMap.get(r.id);
      if (!chunk) return null;
      return {
        ...chunk,
        score: r.relevanceScore,
        retrievalMethod: `${chunk.retrievalMethod}-reranked`,
      } satisfies RetrievedChunk;
    })
    .filter((c): c is RetrievedChunk => c !== null);
}

// ---------------------------------------------------------------------------
// IdentityReranker (pass-through)
// ---------------------------------------------------------------------------

/**
 * Pass-through reranker that simply returns documents in their original
 * order, normalising the original score to 0-1 if present.
 */
export class IdentityReranker implements Reranker {
  readonly name = 'identity';

  async rerank(
    _query: string,
    documents: RerankDocument[],
    options?: RerankOptions
  ): Promise<RerankResult[]> {
    const topN = options?.topN ?? 5;
    const sliced = documents.slice(0, topN);

    return sliced.map((doc) => ({
      id: doc.id,
      relevanceScore: doc.score ?? 0,
      originalScore: doc.score,
      content: doc.content,
    }));
  }
}

// ---------------------------------------------------------------------------
// CrossEncoderReranker (LLM-based, zero-shot)
// ---------------------------------------------------------------------------

/**
 * Uses the project's configured LLM provider to score each document's
 * relevance to a query on a 0-10 scale, then normalises to 0-1.
 *
 * This is a zero-shot approach that works with any LLM.
 */
export class CrossEncoderReranker implements Reranker {
  readonly name = 'llm';
  private provider: LLMProvider;
  private defaultModel?: string;

  constructor(provider?: LLMProvider, model?: string) {
    this.provider = provider ?? createProviderFromEnv();
    this.defaultModel = model;
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions
  ): Promise<RerankResult[]> {
    if (documents.length === 0) return [];

    const topN = options?.topN ?? 5;

    // Score documents concurrently (with bounded parallelism)
    const scored = await this.scoreAll(query, documents);

    // Sort by relevance descending
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return scored.slice(0, topN);
  }

  // ---- internal helpers ----

  /**
   * Score all documents, running up to 5 concurrent LLM calls.
   */
  private async scoreAll(query: string, documents: RerankDocument[]): Promise<RerankResult[]> {
    const concurrency = 5;
    const results: RerankResult[] = [];

    for (let i = 0; i < documents.length; i += concurrency) {
      const batch = documents.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((doc) => this.scoreOne(query, doc)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Ask the LLM to rate a single document's relevance.
   */
  private async scoreOne(query: string, doc: RerankDocument): Promise<RerankResult> {
    const systemPrompt = `You are a relevance scoring assistant. Your job is to rate how relevant a document is to a given query.
Respond with ONLY a single integer between 0 and 10 where:
- 0 means completely irrelevant
- 10 means perfectly relevant
Do not include any explanation or additional text.`;

    const userPrompt = `Query: "${query}"

Document:
"""
${doc.content.slice(0, 2000)}
"""

Rate the relevance of this document to the query on a scale of 0-10.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const response = await this.provider.generate(messages, {
        model: this.defaultModel,
        temperature: 0,
        maxTokens: 5,
      });

      const parsed = parseScore(response.content);
      const normalised = parsed / 10; // 0-10 -> 0-1

      return {
        id: doc.id,
        relevanceScore: normalised,
        originalScore: doc.score,
        content: doc.content,
      };
    } catch (error: unknown) {
      logger.warn('LLM reranking failed for document, falling back to original score', {
        docId: doc.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        id: doc.id,
        relevanceScore: doc.score ?? 0,
        originalScore: doc.score,
        content: doc.content,
      };
    }
  }
}

/**
 * Parse a numeric score from the LLM response text.
 * Accepts plain integers, decimals, and responses that embed
 * the number in short phrases like "Relevance: 8".
 */
function parseScore(text: string): number {
  const trimmed = text.trim();

  // Direct integer/float
  const direct = Number.parseFloat(trimmed);
  if (!Number.isNaN(direct)) {
    return clampScore(direct);
  }

  // Extract first number found
  const match = trimmed.match(/\b(\d+(?:\.\d+)?)\b/);
  if (match?.[1]) {
    return clampScore(Number.parseFloat(match[1]));
  }

  // Fallback to neutral score
  return 5;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(10, n));
}

// ---------------------------------------------------------------------------
// CohereReranker
// ---------------------------------------------------------------------------

/** Shape returned by the Cohere v2 rerank endpoint. */
interface CohereV2RerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
    document?: { text: string };
  }>;
}

/**
 * Re-ranks documents using Cohere's dedicated rerank API.
 *
 * Supports the v2 endpoint (https://api.cohere.com/v2/rerank) with models
 * such as `rerank-v3.5` and `rerank-english-v3.0`.
 *
 * Requires the COHERE_API_KEY environment variable.
 */
export class CohereReranker implements Reranker {
  readonly name = 'cohere';
  private apiKey: string;
  private model: string;
  private topN: number;

  constructor(apiKey?: string, model?: string, topN?: number) {
    this.apiKey = apiKey ?? process.env.COHERE_API_KEY ?? '';
    this.model = model ?? 'rerank-v3.5';
    this.topN = topN ?? 5;

    if (!this.apiKey) {
      logger.warn(
        'CohereReranker created without an API key. Set COHERE_API_KEY to enable Cohere re-ranking.'
      );
    }
  }

  async rerank(
    query: string,
    documents: RerankDocument[],
    options?: RerankOptions
  ): Promise<RerankResult[]> {
    if (documents.length === 0) return [];

    if (!this.apiKey) {
      throw new Error(
        'Cohere API key is not configured. Set the COHERE_API_KEY environment variable.'
      );
    }

    const topN = options?.topN ?? this.topN;
    const model = options?.model ?? this.model;

    try {
      const body = {
        model,
        query,
        documents: documents.map((d) => d.content),
        top_n: Math.min(topN, documents.length),
      };

      const response = await fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'unknown');
        throw new Error(`Cohere rerank API returned ${response.status}: ${errorBody}`);
      }

      const data = (await response.json()) as CohereV2RerankResponse;

      return data.results.map((r) => {
        const doc = documents[r.index];
        return {
          id: doc.id,
          relevanceScore: r.relevance_score,
          originalScore: doc.score,
          content: doc.content,
        };
      });
    } catch (error: unknown) {
      logger.error('Cohere reranking failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export type RerankerType = 'llm' | 'cohere' | 'identity';

/**
 * Create a reranker instance based on the requested type.
 *
 * If no type is provided the factory falls back to the RERANKER_PROVIDER
 * environment variable, and ultimately to `identity`.
 */
export function createReranker(type?: RerankerType): Reranker {
  const resolved = type ?? (process.env.RERANKER_PROVIDER as RerankerType) ?? 'identity';

  switch (resolved) {
    case 'llm':
      return new CrossEncoderReranker();
    case 'cohere':
      return new CohereReranker();
    case 'identity':
      return new IdentityReranker();
    default:
      logger.warn(`Unknown RERANKER_PROVIDER "${resolved}", falling back to identity reranker`);
      return new IdentityReranker();
  }
}

/**
 * Check whether re-ranking is enabled via environment configuration.
 */
export function isRerankerEnabled(): boolean {
  return (process.env.RERANKER_ENABLED ?? 'false').toLowerCase() === 'true';
}
