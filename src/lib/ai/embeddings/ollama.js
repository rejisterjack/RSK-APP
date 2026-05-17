"use strict";
/**
 * Ollama Embedding Provider
 *
 * Support for local self-hosted embeddings using Ollama.
 * Models: nomic-embed-text, mxbai-embed-large
 * Good for cost-sensitive deployments and privacy.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaEmbeddingProvider = void 0;
exports.createOllamaProvider = createOllamaProvider;
const logger_1 = require("@/lib/logger");
const retry_1 = require("@/lib/utils/retry");
const types_1 = require("./types");
/**
 * Ollama Embedding Provider Implementation
 */
class OllamaEmbeddingProvider {
    config;
    baseUrl;
    lastRequestTime = 0;
    minRequestInterval;
    constructor(config) {
        this.config = {
            batchSize: 25, // Ollama typically handles smaller batches
            maxRetries: 3,
            retryDelayMs: 1000,
            timeoutMs: 60000, // Longer timeout for local inference
            apiKey: '',
            baseUrl: 'http://localhost:11434',
            ...config,
        };
        // Validate model
        if (!this.isValidModel(this.config.model)) {
            throw new Error(`Invalid Ollama model: ${this.config.model}. ` +
                `Supported models: ${Object.keys(types_1.OLLAMA_MODELS).join(', ')}`);
        }
        this.baseUrl = this.config.baseUrl ?? 'http://localhost:11434';
        // Rate limiting for local inference (conservative)
        const requestsPerMinute = 60;
        this.minRequestInterval = 60000 / requestsPerMinute;
    }
    get name() {
        return 'ollama';
    }
    get modelName() {
        return this.config.model;
    }
    get dimensions() {
        return this.config.dimensions;
    }
    /**
     * Validate if the model is a supported Ollama model
     */
    isValidModel(model) {
        return model in types_1.OLLAMA_MODELS;
    }
    /**
     * Rate limiter - prevents overwhelming local Ollama instance
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
     * Make request to Ollama API
     */
    async makeRequest(endpoint, body) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    /**
     * Embed a single query string
     */
    async embedQuery(text) {
        if (!text || text.trim().length === 0) {
            throw new Error('Cannot embed empty text');
        }
        // Truncate if needed
        const truncatedText = this.truncateText(text, types_1.OLLAMA_MODELS[this.config.model].maxTokens);
        return (0, retry_1.withRetry)(async () => {
            await this.throttle();
            try {
                const response = await this.makeRequest('/api/embeddings', {
                    model: this.config.model,
                    prompt: truncatedText,
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    // Check for specific errors
                    if (response.status === 404) {
                        throw new Error(`Model "${this.config.model}" not found. ` + `Run: ollama pull ${this.config.model}`);
                    }
                    if (response.status === 503 || response.status === 504) {
                        throw new retry_1.RetryableError('Ollama is busy, retrying...', true);
                    }
                    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
                }
                const data = (await response.json());
                if (!data.embedding || !Array.isArray(data.embedding)) {
                    throw new Error('Invalid response from Ollama: missing embedding');
                }
                return data.embedding;
            }
            catch (error) {
                if (error instanceof retry_1.RetryableError) {
                    throw error;
                }
                if (error instanceof Error) {
                    if (error.name === 'AbortError') {
                        throw new retry_1.RetryableError('Request timeout', true);
                    }
                    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
                        throw new retry_1.RetryableError('Ollama connection failed, is it running?', true);
                    }
                    if (this.isRetryableError(error)) {
                        throw new retry_1.RetryableError(error.message, true);
                    }
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
     * Embed multiple documents in batches
     * Note: Ollama doesn't support batch embedding natively, so we process sequentially
     */
    async embedDocuments(texts) {
        if (texts.length === 0) {
            return [];
        }
        // Filter out empty texts
        const validTexts = texts
            .map((text) => text.trim())
            .filter((text) => text.length > 0)
            .map((text) => this.truncateText(text, types_1.OLLAMA_MODELS[this.config.model].maxTokens));
        if (validTexts.length === 0) {
            throw new Error('No valid texts to embed');
        }
        // Ollama processes one at a time
        const results = [];
        for (const text of validTexts) {
            const embedding = await this.embedQuery(text);
            results.push(embedding);
        }
        return results;
    }
    /**
     * Embed documents with partial failure handling
     */
    async embedDocumentsWithFallback(texts) {
        const embeddings = [];
        const failedIndices = [];
        const errors = [];
        for (let i = 0; i < texts.length; i++) {
            try {
                const embedding = await this.embedQuery(texts[i] ?? '');
                embeddings.push(embedding);
            }
            catch (error) {
                failedIndices.push(i);
                errors.push(error instanceof Error ? error.message : 'Unknown error');
                embeddings.push(new Array(this.dimensions).fill(0));
            }
        }
        return { embeddings, failedIndices, errors };
    }
    /**
     * Check if Ollama is available and the model is loaded
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                return false;
            }
            const data = (await response.json());
            const models = data.models ?? [];
            // Check if our model is available
            return models.some((m) => m.name.includes(this.config.model));
        }
        catch (error) {
            logger_1.logger.debug('Ollama model availability check failed', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }
    /**
     * Get list of available models from Ollama
     */
    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                throw new Error(`Failed to list models: ${response.status}`);
            }
            const data = (await response.json());
            return (data.models ?? []).map((m) => m.name);
        }
        catch (error) {
            throw new Error(`Failed to list Ollama models: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Pull a model from Ollama
     */
    async pullModel(modelName) {
        const model = modelName ?? this.config.model;
        try {
            const response = await this.makeRequest('/api/pull', {
                name: model,
                stream: false,
            });
            if (!response.ok) {
                throw new Error(`Failed to pull model: ${response.status}`);
            }
        }
        catch (error) {
            throw new Error(`Failed to pull model "${model}": ${error instanceof Error ? error.message : 'Unknown error'}`);
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
     * Check if error is retryable
     */
    isRetryableError(error) {
        const message = error.message.toLowerCase();
        return (message.includes('timeout') ||
            message.includes('network') ||
            message.includes('econnreset') ||
            message.includes('socket hang up') ||
            message.includes('busy') ||
            message.includes('temporarily unavailable'));
    }
}
exports.OllamaEmbeddingProvider = OllamaEmbeddingProvider;
/**
 * Create Ollama embedding provider with default config
 */
function createOllamaProvider(model = 'nomic-embed-text', baseUrl) {
    return new OllamaEmbeddingProvider({
        provider: 'ollama',
        model,
        dimensions: types_1.OLLAMA_MODELS[model].dimensions,
        baseUrl: baseUrl ?? process.env.OLLAMA_BASE_URL,
    });
}
