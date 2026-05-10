/**
 * Google Gemini Embedding Provider
 *
 * Uses Google's Gemini API via Vercel AI SDK.
 * Free tier available through Google AI Studio.
 *
 * Models:
 * - gemini-embedding-2 (latest, supports outputDimensionality, 768 dims)
 * - gemini-embedding-001 (3072 dimensions, requires outputDimensionality for 768)
 * - text-embedding-004 (deprecated, replaced by gemini-embedding-001)
 *
 * Get API key: https://aistudio.google.com/app/apikey
 *
 * Quota tracking:
 * - Free tier: 1,500 requests per day
 * - Tracks usage via Redis with daily TTL
 */

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';
import type { EmbeddingProvider } from './types';

const OUTPUT_DIMENSIONALITY = 768;

/**
 * Supported Google embedding models
 */
export const GOOGLE_MODELS = {
  'gemini-embedding-2': {
    dimensions: 768,
    description: 'Latest Gemini embedding model with configurable dimensions',
    maxTokens: 8192,
  },
  'gemini-embedding-001': {
    dimensions: 3072,
    description: 'Gemini embedding model (use outputDimensionality for 768)',
    maxTokens: 2048,
  },
  'text-embedding-004': {
    dimensions: 768,
    description: 'Deprecated — use gemini-embedding-2 instead',
    maxTokens: 2048,
  },
} as const;

export type GoogleModel = keyof typeof GOOGLE_MODELS;

// Daily quota configuration
const DAILY_QUOTA_LIMIT = 1400;
const QUOTA_WARNING_THRESHOLD = Math.floor(DAILY_QUOTA_LIMIT * 0.93); // 93% of limit

/**
 * Custom error for quota exceeded
 */
export class EmbeddingQuotaExceededError extends Error {
  constructor(used: number, limit: number) {
    super(`Google Gemini embedding quota exceeded: ${used}/${limit} requests used today`);
    this.name = 'EmbeddingQuotaExceededError';
  }
}

/**
 * Get Redis key for daily quota tracking
 */
function getQuotaKey(): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `gemini:embed:${today}`;
}

/**
 * Check and increment embedding quota
 * @returns Current usage count after increment
 * @throws EmbeddingQuotaExceededError if quota exceeded
 */
async function checkAndIncrementQuota(): Promise<number> {
  try {
    const key = getQuotaKey();

    // Increment the counter
    const count = await redis.incr(key);

    // Set TTL on first increment (86400 seconds = 1 day)
    if (count === 1) {
      await redis.expire(key, 86400);
    }

    // Check if we're approaching the limit
    if (count >= DAILY_QUOTA_LIMIT) {
      logger.warn('Gemini embedding quota exceeded', {
        used: count,
        limit: DAILY_QUOTA_LIMIT,
      });
      throw new EmbeddingQuotaExceededError(count, DAILY_QUOTA_LIMIT);
    }

    // Warn if approaching limit
    if (count >= QUOTA_WARNING_THRESHOLD) {
      logger.warn('Gemini embedding quota approaching', {
        used: count,
        limit: DAILY_QUOTA_LIMIT,
        remaining: DAILY_QUOTA_LIMIT - count,
      });
    }

    return count;
  } catch (error) {
    // If it's our quota error, re-throw it
    if (error instanceof EmbeddingQuotaExceededError) {
      throw error;
    }

    // If Redis is unavailable, log warning but don't block embeddings
    logger.warn('Redis quota tracking failed, proceeding without quota check', {
      error: error instanceof Error ? error.message : String(error),
    });

    return 0;
  }
}

/**
 * Google Gemini Embedding Provider
 */
export class GoogleEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'google';
  readonly modelName: string;
  readonly dimensions: number;
  private readonly apiKey: string;

  constructor(model: GoogleModel = 'gemini-embedding-2', apiKey?: string, _baseUrl?: string) {
    const modelInfo = GOOGLE_MODELS[model];
    if (!modelInfo) {
      throw new Error(
        `Invalid Google model: ${model}. ` + `Supported: ${Object.keys(GOOGLE_MODELS).join(', ')}`
      );
    }

    const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      throw new Error(
        'Google Gemini API key is required. ' +
          'Set GOOGLE_GENERATIVE_AI_API_KEY in .env or pass it to the constructor. ' +
          'Get a free key at https://aistudio.google.com/app/apikey'
      );
    }

    this.modelName = model;
    this.dimensions = modelInfo.dimensions;
    this.apiKey = key;
  }

  private async callEmbedAPI(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:batchEmbedContents?key=${this.apiKey}`;

    const requests = texts.map((text) => ({
      model: `models/${this.modelName}`,
      content: { parts: [{ text }] },
      outputDimensionality: OUTPUT_DIMENSIONALITY,
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Google embedding API timed out after 30s (${texts.length} texts)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google embedding API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.embeddings.map((e: { values: number[] }) => e.values);
  }

  /**
   * Embed a single query string
   */
  async embedQuery(text: string): Promise<number[]> {
    // Check quota before making request
    await checkAndIncrementQuota();

    const results = await this.callEmbedAPI([text]);
    return results[0] ?? [];
  }

  /**
   * Embed multiple documents in batches
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Check quota before making request (one batch = one request for quota purposes)
    await checkAndIncrementQuota();

    // Process in batches of 100 (Google's limit)
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const results = await this.callEmbedAPI(batch);
      embeddings.push(...results);
    }

    return embeddings;
  }

  /**
   * Check if the provider is ready
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embedQuery('test');
      return true;
    } catch (error: unknown) {
      logger.debug('Google embedding health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

/**
 * Create a Google embedding provider
 */
export function createGoogleProvider(
  model: GoogleModel = 'gemini-embedding-2',
  apiKey?: string
): GoogleEmbeddingProvider {
  return new GoogleEmbeddingProvider(model, apiKey);
}

/**
 * Validate Google model name
 */
export function isValidGoogleModel(model: string): model is GoogleModel {
  return model in GOOGLE_MODELS;
}

/**
 * Get model info
 */
export function getGoogleModelInfo(model: GoogleModel) {
  return GOOGLE_MODELS[model];
}
