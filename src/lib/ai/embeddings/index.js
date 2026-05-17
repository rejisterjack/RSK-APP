"use strict";
/**
 * Embedding Provider Factory
 *
 * Central export point for all embedding providers.
 * Provides factory function to create appropriate provider based on config.
 *
 * DEFAULT: Google Gemini (free tier via AI Studio)
 * - text-embedding-004: 768 dimensions, high quality
 * - Get API key: https://aistudio.google.com/app/apikey
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIEmbeddingProvider = exports.createOpenAIProvider = exports.OllamaEmbeddingProvider = exports.createOllamaProvider = exports.imageEmbeddingHealthCheck = exports.getImageEmbeddingDimensions = exports.generateTextEmbeddingForImageSearch = exports.generateImageEmbeddings = exports.generateImageEmbedding = exports.imageCosineSimilarity = exports.clearImageEmbeddingCache = exports.GoogleEmbeddingProvider = exports.GOOGLE_MODELS = exports.createGoogleProvider = void 0;
exports.createEmbeddingProvider = createEmbeddingProvider;
exports.createEmbeddingProviderFromEnv = createEmbeddingProviderFromEnv;
exports.getDefaultProvider = getDefaultProvider;
exports.createProviderWithFallback = createProviderWithFallback;
exports.createCachedProvider = createCachedProvider;
exports.getModelDimensions = getModelDimensions;
exports.validateEmbeddingDimensions = validateEmbeddingDimensions;
const logger_1 = require("@/lib/logger");
const google_1 = require("./google");
const ollama_1 = require("./ollama");
const openai_1 = require("./openai");
const types_1 = require("./types");
var google_2 = require("./google");
Object.defineProperty(exports, "createGoogleProvider", { enumerable: true, get: function () { return google_2.createGoogleProvider; } });
Object.defineProperty(exports, "GOOGLE_MODELS", { enumerable: true, get: function () { return google_2.GOOGLE_MODELS; } });
Object.defineProperty(exports, "GoogleEmbeddingProvider", { enumerable: true, get: function () { return google_2.GoogleEmbeddingProvider; } });
var image_1 = require("./image");
Object.defineProperty(exports, "clearImageEmbeddingCache", { enumerable: true, get: function () { return image_1.clearImageEmbeddingCache; } });
Object.defineProperty(exports, "imageCosineSimilarity", { enumerable: true, get: function () { return image_1.cosineSimilarity; } });
Object.defineProperty(exports, "generateImageEmbedding", { enumerable: true, get: function () { return image_1.generateImageEmbedding; } });
Object.defineProperty(exports, "generateImageEmbeddings", { enumerable: true, get: function () { return image_1.generateImageEmbeddings; } });
Object.defineProperty(exports, "generateTextEmbeddingForImageSearch", { enumerable: true, get: function () { return image_1.generateTextEmbeddingForImageSearch; } });
Object.defineProperty(exports, "getImageEmbeddingDimensions", { enumerable: true, get: function () { return image_1.getImageEmbeddingDimensions; } });
Object.defineProperty(exports, "imageEmbeddingHealthCheck", { enumerable: true, get: function () { return image_1.healthCheck; } });
var ollama_2 = require("./ollama");
Object.defineProperty(exports, "createOllamaProvider", { enumerable: true, get: function () { return ollama_2.createOllamaProvider; } });
Object.defineProperty(exports, "OllamaEmbeddingProvider", { enumerable: true, get: function () { return ollama_2.OllamaEmbeddingProvider; } });
var openai_2 = require("./openai");
Object.defineProperty(exports, "createOpenAIProvider", { enumerable: true, get: function () { return openai_2.createOpenAIProvider; } });
Object.defineProperty(exports, "OpenAIEmbeddingProvider", { enumerable: true, get: function () { return openai_2.OpenAIEmbeddingProvider; } });
// Re-export all types and providers
__exportStar(require("./types"), exports);
/**
 * Create an embedding provider based on configuration
 */
function createEmbeddingProvider(config) {
    switch (config.provider) {
        case 'google':
            return new google_1.GoogleEmbeddingProvider(config.model, config.apiKey);
        case 'openai':
            return new openai_1.OpenAIEmbeddingProvider(config);
        case 'ollama':
            return new ollama_1.OllamaEmbeddingProvider(config);
        default:
            throw new Error(`Unknown provider: ${config.provider}. Supported providers: google, openai, ollama`);
    }
}
/**
 * Create embedding provider from environment variables
 *
 * Environment variables:
 * - EMBEDDING_PROVIDER: 'google', 'openai', or 'ollama' (default: 'google')
 * - EMBEDDING_MODEL: Model name (default: text-embedding-004 for Google)

 * - OPENAI_API_KEY: OpenAI API key (if using OpenAI)
 * - OLLAMA_BASE_URL: Ollama base URL (if using Ollama)
 */
function createEmbeddingProviderFromEnv(overrides) {
    const provider = overrides?.provider ??
        process.env.EMBEDDING_PROVIDER ??
        'google';
    switch (provider) {
        case 'google': {
            const model = overrides?.model ?? process.env.EMBEDDING_MODEL ?? 'gemini-embedding-2';
            if (!isValidGoogleModel(model)) {
                throw new Error(`Invalid Google model: ${model}. ` + `Supported: ${Object.keys(google_1.GOOGLE_MODELS).join(', ')}`);
            }
            const apiKey = overrides?.apiKey;
            return (0, google_1.createGoogleProvider)(model, apiKey);
        }
        case 'ollama': {
            const model = overrides?.model ?? process.env.EMBEDDING_MODEL ?? 'nomic-embed-text';
            if (!isValidOllamaModel(model)) {
                throw new Error(`Invalid Ollama model: ${model}. ` + `Supported: ${Object.keys(types_1.OLLAMA_MODELS).join(', ')}`);
            }
            return (0, ollama_1.createOllamaProvider)(model, overrides?.baseUrl ?? process.env.OLLAMA_BASE_URL);
        }
        case 'openai': {
            const model = overrides?.model ?? process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';
            if (!isValidOpenAIModel(model)) {
                throw new Error(`Invalid OpenAI model: ${model}. ` + `Supported: ${Object.keys(types_1.OPENAI_MODELS).join(', ')}`);
            }
            return (0, openai_1.createOpenAIProvider)(model, overrides?.apiKey ?? process.env.OPENAI_API_KEY);
        }
        default:
            throw new Error(`Unknown provider: ${provider}. Supported: google, openai, ollama`);
    }
}
/**
 * Get default provider (Google Gemini - free via AI Studio)
 */
function getDefaultProvider() {
    return (0, google_1.createGoogleProvider)('gemini-embedding-2');
}
/**
 * Get provider with fallback - tries primary, falls back to secondary on failure
 */
async function createProviderWithFallback(primary, fallback) {
    try {
        const primaryProvider = createEmbeddingProvider(primary);
        // Test if primary is available
        if (await primaryProvider.healthCheck?.()) {
            return primaryProvider;
        }
    }
    catch (error) {
        logger_1.logger.error('Primary embedding provider failed, using fallback', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
    return createEmbeddingProvider(fallback);
}
/**
 * Create a cached embedding provider wrapper
 */
function createCachedProvider(provider, cache, options) {
    const ttl = options?.ttl ?? 86400;
    const hashFn = options?.hashFn ?? defaultHash;
    return {
        name: `${provider.name}-cached`,
        modelName: provider.modelName,
        dimensions: provider.dimensions,
        async embedQuery(text) {
            const cacheKey = `embed:query:${hashFn(text)}:${provider.modelName}`;
            // Try cache first
            const cached = await cache.get(cacheKey);
            if (cached) {
                return cached;
            }
            // Generate embedding
            const embedding = await provider.embedQuery(text);
            // Cache result
            await cache.set(cacheKey, embedding, ttl);
            return embedding;
        },
        async embedDocuments(texts) {
            const results = [];
            const missingIndices = [];
            const missingTexts = [];
            // Check cache for each text
            for (let i = 0; i < texts.length; i++) {
                const cacheKey = `embed:doc:${hashFn(texts[i] ?? '')}:${provider.modelName}`;
                const cached = await cache.get(cacheKey);
                if (cached) {
                    results[i] = cached;
                }
                else {
                    missingIndices.push(i);
                    missingTexts.push(texts[i] ?? '');
                }
            }
            // Generate embeddings for missing texts
            if (missingTexts.length > 0) {
                const newEmbeddings = await provider.embedDocuments(missingTexts);
                // Store results and cache them
                for (let i = 0; i < missingIndices.length; i++) {
                    const index = missingIndices[i] ?? 0;
                    const embedding = newEmbeddings[i] ?? [];
                    results[index] = embedding;
                    const cacheKey = `embed:doc:${hashFn(texts[index] ?? '')}:${provider.modelName}`;
                    await cache.set(cacheKey, embedding, ttl);
                }
            }
            return results;
        },
        healthCheck: provider.healthCheck?.bind(provider),
    };
}
/**
 * Simple hash function for cache keys
 */
function defaultHash(text) {
    // Simple FNV-1a hash
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
}
/**
 * Validate Google model name
 */
function isValidGoogleModel(model) {
    return model in google_1.GOOGLE_MODELS;
}
/**
 * Validate OpenAI model name
 */
function isValidOpenAIModel(model) {
    return model in types_1.OPENAI_MODELS;
}
/**
 * Validate Ollama model name
 */
function isValidOllamaModel(model) {
    return model in types_1.OLLAMA_MODELS;
}
/**
 * Get model dimensions
 */
function getModelDimensions(provider, model) {
    if (provider === 'google' && isValidGoogleModel(model)) {
        return google_1.GOOGLE_MODELS[model].dimensions;
    }
    if (provider === 'openai' && isValidOpenAIModel(model)) {
        return types_1.OPENAI_MODELS[model].dimensions;
    }
    if (provider === 'ollama' && isValidOllamaModel(model)) {
        return types_1.OLLAMA_MODELS[model].dimensions;
    }
    throw new Error(`Unknown model: ${provider}/${model}`);
}
/**
 * Dimension mapping for each provider/model combination.
 * Used at startup to validate that the configured embedding model's output
 * matches the vector column dimension in the Prisma schema.
 */
const SCHEMA_VECTOR_DIMENSION = 768; // Must match `vector(768)` in prisma/schema.prisma
const PROVIDER_MODEL_DIMENSIONS = {
    google: Object.fromEntries(Object.entries(google_1.GOOGLE_MODELS).map(([k, v]) => [k, v.dimensions])),
    openai: Object.fromEntries(Object.entries(types_1.OPENAI_MODELS).map(([k, v]) => [k, v.dimensions])),
    ollama: Object.fromEntries(Object.entries(types_1.OLLAMA_MODELS).map(([k, v]) => [k, v.dimensions])),
};
/**
 * Validate that the configured embedding model's output dimensions match
 * the pgvector column in the database schema.
 *
 * Call this at application startup (e.g. in instrumentation.ts or a layout effect).
 * Returns a warning string if there is a mismatch, or null if dimensions are compatible.
 */
function validateEmbeddingDimensions(provider, model) {
    const effectiveProvider = provider ?? process.env.EMBEDDING_PROVIDER ?? 'google';
    const effectiveModel = model ?? process.env.EMBEDDING_MODEL;
    const defaults = {
        google: 'gemini-embedding-2',
        openai: 'text-embedding-3-small',
        ollama: 'nomic-embed-text',
    };
    const resolvedModel = effectiveModel ?? defaults[effectiveProvider] ?? 'text-embedding-004';
    const providerDims = PROVIDER_MODEL_DIMENSIONS[effectiveProvider];
    if (!providerDims) {
        return {
            valid: false,
            message: `Unknown embedding provider: "${effectiveProvider}". Supported: google, openai, ollama.`,
        };
    }
    const modelDims = providerDims[resolvedModel];
    if (modelDims === undefined) {
        // Unknown model — warn but don't block (could be a custom Ollama model)
        return {
            valid: true,
            message: `Unknown model "${resolvedModel}" for provider "${effectiveProvider}". ` +
                `Cannot validate dimensions. Ensure its output matches the pgvector column (${SCHEMA_VECTOR_DIMENSION}D).`,
        };
    }
    if (modelDims !== SCHEMA_VECTOR_DIMENSION) {
        return {
            valid: false,
            message: `Embedding dimension mismatch: "${effectiveProvider}/${resolvedModel}" produces ` +
                `${modelDims}D vectors, but the database schema uses vector(${SCHEMA_VECTOR_DIMENSION}). ` +
                `To fix this:\n` +
                `  1. Change EMBEDDING_PROVIDER/MODEL to a ${SCHEMA_VECTOR_DIMENSION}D model (e.g. google/text-embedding-004 or ollama/nomic-embed-text), OR\n` +
                `  2. Run a migration: ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(${modelDims});\n` +
                `  3. Update SCHEMA_VECTOR_DIMENSION in src/lib/ai/embeddings/index.ts to ${modelDims}.`,
        };
    }
    return { valid: true, message: null };
}
