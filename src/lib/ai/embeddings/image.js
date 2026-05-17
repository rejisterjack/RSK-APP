"use strict";
/**
 * Image Embedding Module
 *
 * Uses CLIP model from Transformers.js to generate image embeddings
 * for semantic image search and vision-language tasks.
 *
 * Features:
 * - 512-dimensional CLIP embeddings
 * - Image preprocessing (resize, normalize)
 * - Embedding caching
 * - Support for both Buffer and URL inputs
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImageEmbedding = generateImageEmbedding;
exports.generateImageEmbeddings = generateImageEmbeddings;
exports.generateTextEmbeddingForImageSearch = generateTextEmbeddingForImageSearch;
exports.cosineSimilarity = cosineSimilarity;
exports.getImageEmbeddingDimensions = getImageEmbeddingDimensions;
exports.clearImageEmbeddingCache = clearImageEmbeddingCache;
exports.healthCheck = healthCheck;
const node_crypto_1 = require("node:crypto");
const db_1 = require("@/lib/db");
const logger_1 = require("@/lib/logger");
// CLIP model configuration
const CLIP_MODEL = 'Xenova/clip-vit-base-patch32';
const EMBEDDING_DIMENSIONS = 512;
// Simple in-memory cache (could be replaced with Redis)
const embeddingCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
// Model singleton
let clipModel = null;
let clipProcessor = null;
/**
 * Load CLIP model and processor (lazy initialization)
 */
async function loadCLIPModel() {
    if (clipModel && clipProcessor) {
        return { model: clipModel, processor: clipProcessor };
    }
    try {
        // Dynamic import to avoid loading on server start
        const { AutoModel, AutoProcessor } = await Promise.resolve().then(() => __importStar(require('@xenova/transformers')));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clipModel = await AutoModel.from_pretrained(CLIP_MODEL);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clipProcessor = await AutoProcessor.from_pretrained(CLIP_MODEL);
        return { model: clipModel, processor: clipProcessor };
    }
    catch (error) {
        logger_1.logger.error('Failed to load CLIP model for image embeddings', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error('Failed to load CLIP model for image embeddings');
    }
}
/**
 * Generate cache key for image
 */
function generateCacheKey(imageData) {
    if (typeof imageData === 'string') {
        // For URLs, hash the URL
        return (0, node_crypto_1.createHash)('sha256').update(imageData).digest('hex');
    }
    // For buffers, hash the buffer content
    return (0, node_crypto_1.createHash)('sha256').update(imageData).digest('hex');
}
/**
 * Check if embedding is cached
 */
async function getCachedEmbedding(cacheKey) {
    // Check in-memory cache first
    const cached = embeddingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.embedding;
    }
    // Check database cache
    try {
        const result = await db_1.prisma.$queryRaw `
      SELECT embedding::float[] as embedding
      FROM image_embeddings
      WHERE content_hash = ${cacheKey}
      AND "createdAt" > NOW() - INTERVAL '7 days'
      LIMIT 1
    `;
        if (result.length > 0 && result[0]?.embedding) {
            const embedding = result[0].embedding;
            // Update in-memory cache
            embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
            return embedding;
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to get cached embedding from database', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
    return null;
}
/**
 * Cache embedding in memory and database
 */
async function cacheEmbedding(cacheKey, embedding, _imageUrl) {
    // Update in-memory cache
    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
    // Clean old cache entries periodically
    if (embeddingCache.size > 1000) {
        const now = Date.now();
        for (const [key, value] of embeddingCache.entries()) {
            if (now - value.timestamp > CACHE_TTL_MS) {
                embeddingCache.delete(key);
            }
        }
    }
}
/**
 * Preprocess image for CLIP model
 */
async function preprocessImage(imageData) {
    const { processor } = await loadCLIPModel();
    if (typeof imageData === 'string') {
        // Fetch image from URL
        const response = await fetch(imageData);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        imageData = Buffer.from(arrayBuffer);
    }
    // Process image with CLIP processor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processed = await processor(imageData);
    return processed;
}
/**
 * Generate image embedding using CLIP
 *
 * @param imageBuffer - Image as Buffer or URL string
 * @returns Promise resolving to 512-dimensional embedding vector
 */
async function generateImageEmbedding(imageBuffer) {
    const cacheKey = generateCacheKey(imageBuffer);
    // Check cache first
    const cached = await getCachedEmbedding(cacheKey);
    if (cached) {
        return cached;
    }
    try {
        const { model } = await loadCLIPModel();
        const processed = await preprocessImage(imageBuffer);
        // Generate embedding
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output = await model(processed);
        const embedding = output.image_embeds.data;
        // Convert to regular array and normalize
        const embeddingArray = Array.from(embedding);
        const normalizedEmbedding = normalizeVector(embeddingArray);
        // Cache the result
        await cacheEmbedding(cacheKey, normalizedEmbedding, typeof imageBuffer === 'string' ? imageBuffer : undefined);
        return normalizedEmbedding;
    }
    catch (error) {
        throw new Error(`Failed to generate image embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Generate embeddings for multiple images in batch
 *
 * @param imageBuffers - Array of image Buffers or URLs
 * @returns Promise resolving to array of embedding vectors
 */
async function generateImageEmbeddings(imageBuffers) {
    const embeddings = [];
    // Process in batches of 4 to avoid memory issues
    const batchSize = 4;
    for (let i = 0; i < imageBuffers.length; i += batchSize) {
        const batch = imageBuffers.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(batch.map(async (buffer) => {
            try {
                return await generateImageEmbedding(buffer);
            }
            catch (error) {
                logger_1.logger.error('Failed to generate image embedding in batch', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                return null;
            }
        }));
        embeddings.push(...batchEmbeddings.filter((e) => e !== null));
    }
    return embeddings;
}
/**
 * Generate text embedding using CLIP (for image-text similarity)
 *
 * @param text - Text query
 * @returns Promise resolving to 512-dimensional embedding vector
 */
async function generateTextEmbeddingForImageSearch(text) {
    const cacheKey = (0, node_crypto_1.createHash)('sha256').update(`text:${text}`).digest('hex');
    // Check cache
    const cached = await getCachedEmbedding(cacheKey);
    if (cached) {
        return cached;
    }
    try {
        const { model, processor } = await loadCLIPModel();
        // Process text
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const processed = await processor(text);
        // Generate embedding
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const output = await model(processed);
        const embedding = output.text_embeds.data;
        // Convert to regular array and normalize
        const embeddingArray = Array.from(embedding);
        const normalizedEmbedding = normalizeVector(embeddingArray);
        // Cache the result
        await cacheEmbedding(cacheKey, normalizedEmbedding);
        return normalizedEmbedding;
    }
    catch (error) {
        throw new Error(`Failed to generate text embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same dimension');
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
/**
 * Normalize a vector to unit length
 */
function normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0)
        return vector;
    return vector.map((val) => val / magnitude);
}
/**
 * Get embedding dimensions
 */
function getImageEmbeddingDimensions() {
    return EMBEDDING_DIMENSIONS;
}
/**
 * Clear embedding cache
 */
function clearImageEmbeddingCache() {
    embeddingCache.clear();
}
/**
 * Health check for image embedding service
 */
async function healthCheck() {
    try {
        await loadCLIPModel();
        return true;
    }
    catch (error) {
        logger_1.logger.error('Image embedding health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
    }
}
