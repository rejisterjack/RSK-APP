"use strict";
/**
 * Embedding Provider Types
 *
 * Common interfaces for all embedding providers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_MODELS = exports.OLLAMA_MODELS = exports.OPENAI_MODELS = void 0;
/**
 * Supported OpenAI embedding models
 */
exports.OPENAI_MODELS = {
    'text-embedding-3-small': {
        dimensions: 1536,
        description: 'Fast, cost-effective embeddings',
        maxTokens: 8191,
    },
    'text-embedding-3-large': {
        dimensions: 3072,
        description: 'Best quality embeddings',
        maxTokens: 8191,
    },
    'text-embedding-ada-002': {
        dimensions: 1536,
        description: 'Legacy model, use v3 models instead',
        maxTokens: 8191,
    },
};
/**
 * Supported Ollama embedding models
 */
exports.OLLAMA_MODELS = {
    'nomic-embed-text': {
        dimensions: 768,
        description: 'High-quality open embeddings',
        maxTokens: 2048,
    },
    'mxbai-embed-large': {
        dimensions: 1024,
        description: 'Large open embeddings with excellent performance',
        maxTokens: 512,
    },
    'all-minilm': {
        dimensions: 384,
        description: 'Fast, lightweight embeddings',
        maxTokens: 512,
    },
};
/**
 * Supported local embedding models (Xenova/Transformers)
 */
exports.LOCAL_MODELS = {
    'Xenova/all-MiniLM-L6-v2': {
        dimensions: 384,
        description: 'Fast, lightweight embeddings (default)',
        maxTokens: 512,
    },
    'Xenova/all-MiniLM-L12-v2': {
        dimensions: 384,
        description: 'Better quality, same dimensions',
        maxTokens: 512,
    },
    'Xenova/all-distilroberta-v1': {
        dimensions: 768,
        description: 'Higher quality, larger vectors',
        maxTokens: 512,
    },
    'Xenova/gte-base': {
        dimensions: 768,
        description: 'Optimized for semantic search',
        maxTokens: 512,
    },
};
