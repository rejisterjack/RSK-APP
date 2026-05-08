import { describe, expect, it, vi } from 'vitest';

// Mock the AI module FIRST to prevent top-level key validation
vi.mock('@/lib/ai', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the retrieval sub-modules to avoid DB/Redis dependencies
vi.mock('@/lib/rag/retrieval/vector', () => ({
  VectorRetriever: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue([]),
    updateConfig: vi.fn(),
  })),
  defaultVectorSearchConfig: {},
}));

vi.mock('@/lib/rag/retrieval/keyword', () => ({
  KeywordRetriever: vi.fn().mockImplementation(() => ({
    retrieve: vi.fn().mockResolvedValue([]),
    updateConfig: vi.fn(),
  })),
  defaultKeywordSearchConfig: {},
}));

vi.mock('@/lib/rag/retrieval/reranker', () => ({
  createReranker: vi.fn(),
  isRerankerEnabled: vi.fn().mockReturnValue(false),
  applyRerankResults: vi.fn(),
  chunksToRerankDocs: vi.fn(),
}));

import {
  deduplicateChunks,
  reciprocalRankFusion,
  weightedScoreFusion,
} from '@/lib/rag/retrieval/hybrid';
import type { RetrievedChunk } from '@/lib/rag/retrieval/types';

function createChunk(id: string, content: string, score: number): RetrievedChunk {
  return {
    id,
    content,
    score,
    metadata: {
      documentId: 'doc-1',
      documentName: 'Test Doc',
      documentType: 'text',
      position: 0,
    },
    retrievalMethod: 'test',
  };
}

describe('Hybrid Retrieval - Deduplication', () => {
  describe('deduplicateChunks', () => {
    it('should remove exact duplicates', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'This is exactly the same content', 0.9),
        createChunk('2', 'This is exactly the same content', 0.85),
        createChunk('3', 'Different content here', 0.8),
      ];

      const result = deduplicateChunks(chunks, 0.9);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1'); // First occurrence kept
      expect(result[1].id).toBe('3');
    });

    it('should remove near-duplicates based on Jaccard similarity', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'The quick brown fox jumps over the lazy dog', 0.9),
        createChunk('2', 'The quick brown fox jumps over the lazy dog today', 0.85),
        createChunk('3', 'Completely different text about cats', 0.8),
      ];

      // Jaccard similarity between chunk 1 and 2 is high (~0.9) since only "today" differs
      const result = deduplicateChunks(chunks, 0.7);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('3');
    });

    it('should preserve first occurrence when deduplicating', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'Content A', 0.7),
        createChunk('2', 'Content A', 0.9),
      ];

      const result = deduplicateChunks(chunks, 0.9);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1'); // First occurrence kept
    });

    it('should handle empty input', () => {
      const result = deduplicateChunks([], 0.9);
      expect(result).toHaveLength(0);
    });

    it('should handle single chunk', () => {
      const chunks: RetrievedChunk[] = [createChunk('1', 'Only chunk', 0.9)];
      const result = deduplicateChunks(chunks, 0.9);
      expect(result).toHaveLength(1);
    });

    it('should respect similarity threshold', () => {
      const chunks: RetrievedChunk[] = [
        createChunk('1', 'alpha beta gamma delta epsilon', 0.9),
        createChunk('2', 'alpha beta gamma delta zeta', 0.85),
        createChunk('3', 'Totally different stuff here', 0.8),
      ];

      // With high threshold, should keep all
      const resultHigh = deduplicateChunks(chunks, 0.95);
      expect(resultHigh).toHaveLength(3);

      // With very low threshold, should deduplicate the similar ones
      // Jaccard between chunks 1 and 2: intersection = 4, union = 6, similarity = 0.667
      const resultLow = deduplicateChunks(chunks, 0.5);
      expect(resultLow).toHaveLength(2);
    });
  });

  describe('reciprocalRankFusion', () => {
    it('should combine results from multiple lists', () => {
      const list1: RetrievedChunk[] = [
        createChunk('a', 'doc a', 0.9),
        createChunk('b', 'doc b', 0.8),
      ];
      const list2: RetrievedChunk[] = [
        createChunk('b', 'doc b', 0.95),
        createChunk('c', 'doc c', 0.7),
      ];

      const result = reciprocalRankFusion([list1, list2]);

      // 'b' appears in both lists, should have highest RRF score
      expect(result[0].id).toBe('b');
      expect(result).toHaveLength(3);
    });

    it('should handle empty lists', () => {
      const result = reciprocalRankFusion([[], []]);
      expect(result).toHaveLength(0);
    });

    it('should handle single list', () => {
      const list: RetrievedChunk[] = [
        createChunk('a', 'doc a', 0.9),
        createChunk('b', 'doc b', 0.8),
      ];

      const result = reciprocalRankFusion([list]);
      expect(result).toHaveLength(2);
    });
  });

  describe('weightedScoreFusion', () => {
    it('should combine vector and keyword results', () => {
      const vectorResults: RetrievedChunk[] = [
        createChunk('a', 'doc a', 0.5),
        createChunk('b', 'doc b', 0.3),
        createChunk('c', 'doc c', 0.1),
      ];
      const keywordResults: RetrievedChunk[] = [
        createChunk('b', 'doc b', 1.0),
        createChunk('d', 'doc d', 0.5),
      ];

      const result = weightedScoreFusion(vectorResults, keywordResults, 0.7, 0.3);

      // 'b' appears in both lists and should get a combined score
      // After normalization and weighting, 'b' should rank highly
      expect(result).toHaveLength(4);
      // Just verify that 'b' is in the results (it appears in both)
      expect(result.some((r) => r.id === 'b')).toBe(true);
    });

    it('should handle empty results', () => {
      const result = weightedScoreFusion([], [], 0.7, 0.3);
      expect(result).toHaveLength(0);
    });
  });
});
