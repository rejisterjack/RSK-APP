"use strict";
/**
 * OpenAI Embedding Provider
 *
 * Uses @ai-sdk/openai and the `ai` package for embeddings.
 * Supports text-embedding-3-small (1536 dims, fast)
 * and text-embedding-3-large (3072 dims, best quality).
 * Includes batch processing, rate limiting, and retry logic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIEmbeddingProvider = void 0;
exports.createOpenAIProvider = createOpenAIProvider;
const openai_1 = require("@ai-sdk/openai");
const ai_1 = require("ai");
const logger_1 = require("@/lib/logger");
const retry_1 = require("@/lib/utils/retry");
const types_1 = require("./types");
/**
 * OpenAI Embedding Provider Implementation
 */
class OpenAIEmbeddingProvider {
    config;
    lastRequestTime = 0;
    minRequestInterval;
    openai;
    constructor(config) {
        this.config = {
            batchSize: 100,
            maxRetries: 3,
            retryDelayMs: 1000,
            timeoutMs: 30000,
            apiKey: process.env.OPENAI_API_KEY ?? '',
            baseUrl: '',
            ...config,
        };
        // Validate model
        if (!this.isValidModel(this.config.model)) {
            throw new Error(`Invalid OpenAI model: ${this.config.model}. ` +
                `Supported models: ${Object.keys(types_1.OPENAI_MODELS).join(', ')}`);
        }
        // Calculate minimum interval between requests (requests per minute -> ms)
        // OpenAI's rate limit: 3000 RPM for text-embedding-3-small
        const requestsPerMinute = 3000;
        this.minRequestInterval = 60000 / requestsPerMinute;
        this.openai = (0, openai_1.createOpenAI)({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseUrl || undefined,
        });
    }
    get name() {
        return 'openai';
    }
    get modelName() {
        return this.config.model;
    }
    get dimensions() {
        return this.config.dimensions;
    }
    /**
     * Validate if the model is a supported OpenAI model
     */
    isValidModel(model) {
        return model in types_1.OPENAI_MODELS;
    }
    /**
     * Rate limiter - ensures we don't exceed rate limits
     */
    async throttle() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            const delay = this.minRequestInterval - timeSinceLastRequest;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        this.lastRequestTime = Date.now();
    }
    /**
     * Get the AI SDK embedding model instance
     */
    getEmbeddingModel() {
        return this.openai.embedding(this.config.model, {
            dimensions: this.config.dimensions,
        });
    }
    /**
     * Embed a single query string with retry logic
     */
    async embedQuery(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Cannot embed empty text');
        }
        // Truncate if needed (OpenAI has token limits)
        const truncatedText = this.truncateText(text, types_1.OPENAI_MODELS[this.config.model].maxTokens);
        return (0, retry_1.withRetry)(async () => {
            await this.throttle();
            try {
                const { embedding } = await (0, ai_1.embed)({
                    model: this.getEmbeddingModel(),
                    value: truncatedText,
                });
                return embedding;
            }
            catch (error) {
                // Check if it's a rate limit error
                if (this.isRateLimitError(error)) {
                    throw new retry_1.RetryableError('Rate limit exceeded', true);
                }
                // Check if it's a retryable error
                if (this.isRetryableError(error)) {
                    throw new retry_1.RetryableError(error instanceof Error ? error.message : 'Unknown error', true);
                }
                throw error;
            }
        }, {
            maxRetries: this.config.maxRetries,
            delayMs: this.config.retryDelayMs,
            backoffMultiplier: 2,
            maxDelayMs: 30000,
        });
    }
    /**
     * Embed multiple documents in batches with retry logic
     */
    async embedDocuments(texts) {
        if (texts.length === 0) {
            return [];
        }
        // Filter out empty texts and truncate
        const validTexts = texts
            .map((text) => text.trim())
            .filter((text) => text.length > 0)
            .map((text) => this.truncateText(text, types_1.OPENAI_MODELS[this.config.model].maxTokens));
        if (validTexts.length === 0) {
            throw new Error('No valid texts to embed');
        }
        // Process in batches
        const results = [];
        const batchSize = this.config.batchSize;
        for (let i = 0; i < validTexts.length; i += batchSize) {
            const batch = validTexts.slice(i, i + batchSize);
            const batchResult = await (0, retry_1.withRetry)(async () => {
                await this.throttle();
                try {
                    const { embeddings } = await (0, ai_1.embedMany)({
                        model: this.getEmbeddingModel(),
                        values: batch,
                    });
                    return embeddings;
                }
                catch (error) {
                    if (this.isRateLimitError(error)) {
                        throw new retry_1.RetryableError('Rate limit exceeded', true);
                    }
                    if (this.isRetryableError(error)) {
                        throw new retry_1.RetryableError(error instanceof Error ? error.message : 'Unknown error', true);
                    }
                    throw error;
                }
            }, {
                maxRetries: this.config.maxRetries,
                delayMs: this.config.retryDelayMs,
                backoffMultiplier: 2,
                maxDelayMs: 30000,
            });
            results.push(...batchResult);
        }
        return results;
    }
    /**
     * Embed documents with partial failure handling
     * Returns successful embeddings and tracks failures
     */
    async embedDocumentsWithFallback(texts) {
        const embeddings = [];
        const failedIndices = [];
        const errors = [];
        // Process one by one to handle partial failures
        for (let i = 0; i < texts.length; i++) {
            try {
                const embedding = await this.embedQuery(texts[i] ?? '');
                embeddings.push(embedding);
            }
            catch (error) {
                failedIndices.push(i);
                errors.push(error instanceof Error ? error.message : 'Unknown error');
                // Push zero vector as placeholder to maintain index alignment
                embeddings.push(new Array(this.dimensions).fill(0));
            }
        }
        return { embeddings, failedIndices, errors };
    }
    /**
     * Check if provider is healthy
     */
    async healthCheck() {
        try {
            await this.embedQuery('health check');
            return true;
        }
        catch (error) {
            logger_1.logger.error('OpenAI embedding health check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    /**
     * Truncate text to fit within token limit
     * Rough estimate: 1 token ≈ 4 characters for English text
     */
    truncateText(text, maxTokens) {
        const maxChars = maxTokens * 4;
        if (text.length <= maxChars) {
            return text;
        }
        return text.slice(0, maxChars);
    }
    /**
     * Check if error is a rate limit error
     */
    isRateLimitError(error) {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (message.includes('rate limit') ||
                message.includes('too many requests') ||
                message.includes('429'));
        }
        return false;
    }
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (message.includes('timeout') ||
                message.includes('network') ||
                message.includes('econnreset') ||
                message.includes('socket hang up') ||
                message.includes('503') ||
                message.includes('502') ||
                message.includes('504'));
        }
        return false;
    }
}
exports.OpenAIEmbeddingProvider = OpenAIEmbeddingProvider;
/**
 * Create OpenAI embedding provider with default config
 */
function createOpenAIProvider(model = 'text-embedding-3-small', apiKey) {
    return new OpenAIEmbeddingProvider({
        provider: 'openai',
        model,
        dimensions: types_1.OPENAI_MODELS[model].dimensions,
        apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
}
