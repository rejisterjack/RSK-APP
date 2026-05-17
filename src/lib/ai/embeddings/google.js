"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleEmbeddingProvider = exports.EmbeddingQuotaExceededError = exports.GOOGLE_MODELS = void 0;
exports.createGoogleProvider = createGoogleProvider;
exports.isValidGoogleModel = isValidGoogleModel;
exports.getGoogleModelInfo = getGoogleModelInfo;
const logger_1 = require("@/lib/logger");
const redis_1 = require("@/lib/redis");
const OUTPUT_DIMENSIONALITY = 768;
/**
 * Supported Google embedding models
 */
exports.GOOGLE_MODELS = {
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
};
// Daily quota configuration
const DAILY_QUOTA_LIMIT = 1400;
const QUOTA_WARNING_THRESHOLD = Math.floor(DAILY_QUOTA_LIMIT * 0.93); // 93% of limit
/**
 * Custom error for quota exceeded
 */
class EmbeddingQuotaExceededError extends Error {
    constructor(used, limit) {
        super(`Google Gemini embedding quota exceeded: ${used}/${limit} requests used today`);
        this.name = 'EmbeddingQuotaExceededError';
    }
}
exports.EmbeddingQuotaExceededError = EmbeddingQuotaExceededError;
/**
 * Get Redis key for daily quota tracking
 */
function getQuotaKey() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `gemini:embed:${today}`;
}
/**
 * Check and increment embedding quota
 * @returns Current usage count after increment
 * @throws EmbeddingQuotaExceededError if quota exceeded
 */
async function checkAndIncrementQuota() {
    try {
        const key = getQuotaKey();
        // Increment the counter
        const count = await redis_1.redis.incr(key);
        // Set TTL on first increment (86400 seconds = 1 day)
        if (count === 1) {
            await redis_1.redis.expire(key, 86400);
        }
        // Check if we're approaching the limit
        if (count >= DAILY_QUOTA_LIMIT) {
            logger_1.logger.warn('Gemini embedding quota exceeded', {
                used: count,
                limit: DAILY_QUOTA_LIMIT,
            });
            throw new EmbeddingQuotaExceededError(count, DAILY_QUOTA_LIMIT);
        }
        // Warn if approaching limit
        if (count >= QUOTA_WARNING_THRESHOLD) {
            logger_1.logger.warn('Gemini embedding quota approaching', {
                used: count,
                limit: DAILY_QUOTA_LIMIT,
                remaining: DAILY_QUOTA_LIMIT - count,
            });
        }
        return count;
    }
    catch (error) {
        // If it's our quota error, re-throw it
        if (error instanceof EmbeddingQuotaExceededError) {
            throw error;
        }
        // If Redis is unavailable, log warning but don't block embeddings
        logger_1.logger.warn('Redis quota tracking failed, proceeding without quota check', {
            error: error instanceof Error ? error.message : String(error),
        });
        return 0;
    }
}
/**
 * Google Gemini Embedding Provider
 */
class GoogleEmbeddingProvider {
    name = 'google';
    modelName;
    dimensions;
    apiKey;
    constructor(model = 'gemini-embedding-2', apiKey, _baseUrl) {
        const modelInfo = exports.GOOGLE_MODELS[model];
        if (!modelInfo) {
            throw new Error(`Invalid Google model: ${model}. ` + `Supported: ${Object.keys(exports.GOOGLE_MODELS).join(', ')}`);
        }
        const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!key) {
            throw new Error('Google Gemini API key is required. ' +
                'Set GOOGLE_GENERATIVE_AI_API_KEY in .env or pass it to the constructor. ' +
                'Get a free key at https://aistudio.google.com/app/apikey');
        }
        this.modelName = model;
        this.dimensions = modelInfo.dimensions;
        this.apiKey = key;
    }
    async callEmbedAPI(texts) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:batchEmbedContents?key=${this.apiKey}`;
        const requests = texts.map((text) => ({
            model: `models/${this.modelName}`,
            content: { parts: [{ text }] },
            outputDimensionality: OUTPUT_DIMENSIONALITY,
        }));
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30_000);
        let response;
        try {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requests }),
                signal: controller.signal,
            });
        }
        catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error(`Google embedding API timed out after 30s (${texts.length} texts)`);
            }
            throw error;
        }
        finally {
            clearTimeout(timeoutId);
        }
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google embedding API error: ${response.status} - ${error}`);
        }
        const data = await response.json();
        return data.embeddings.map((e) => e.values);
    }
    /**
     * Embed a single query string
     */
    async embedQuery(text) {
        // Check quota before making request
        await checkAndIncrementQuota();
        const results = await this.callEmbedAPI([text]);
        return results[0] ?? [];
    }
    /**
     * Embed multiple documents in batches
     */
    async embedDocuments(texts) {
        // Check quota before making request (one batch = one request for quota purposes)
        await checkAndIncrementQuota();
        // Process in batches of 100 (Google's limit)
        const batchSize = 100;
        const embeddings = [];
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
    async healthCheck() {
        try {
            await this.embedQuery('test');
            return true;
        }
        catch (error) {
            logger_1.logger.debug('Google embedding health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
}
exports.GoogleEmbeddingProvider = GoogleEmbeddingProvider;
/**
 * Create a Google embedding provider
 */
function createGoogleProvider(model = 'gemini-embedding-2', apiKey) {
    return new GoogleEmbeddingProvider(model, apiKey);
}
/**
 * Validate Google model name
 */
function isValidGoogleModel(model) {
    return model in exports.GOOGLE_MODELS;
}
/**
 * Get model info
 */
function getGoogleModelInfo(model) {
    return exports.GOOGLE_MODELS[model];
}
