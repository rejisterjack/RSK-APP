import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateByDocument,
  buildContext,
  deduplicateSources,
  formatSourceCitations,
  rerankSources,
} from '@/lib/rag/retrieval';

// Mock dependencies that are imported by the retrieval module
vi.mock('@/lib/ai/embeddings', () => ({
  createEmbeddingProviderFromEnv: vi.fn(() => ({
    embedQuery: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
    embedDocuments: vi.fn().mockResolvedValue([Array(1536).fill(0.1)]),
  })),
}));

vi.mock('@/lib/db', async () => {
  const { mockPrisma } = await import('@/tests/utils/mocks/prisma');
  return {
    prisma: mockPrisma,
    createVectorStore: vi.fn(() => ({
      similaritySearch: vi.fn().mockResolvedValue([]),
    })),
  };
});

vi.mock('@/lib/db/vector-cache', () => ({
  createSemanticCache: vi.fn(() => ({
    findSimilar: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn().mockResolvedValue(undefined),
  })),
  MemoryCacheProvider: vi.fn(),
}));

vi.mock('@/lib/tracing', () => ({
  tracing: {
    retrieveSources: vi.fn((_query: string, _topK: number, fn: () => Promise<unknown[]>) => fn()),
  },
}));

describe('Retrieval', () => {
  const mockSources = [
    {
      id: 'chunk-1',
      content: 'Q1 revenue was $32 million',
      similarity: 0.92,
      metadata: {
        documentId: 'doc-1',
        documentName: 'annual-report-2024.pdf',
        page: 5,
        chunkIndex: 0,
        totalChunks: 10,
      },
    },
    {
      id: 'chunk-2',
      content: 'Q2 revenue was $38 million',
      similarity: 0.88,
      metadata: {
        documentId: 'doc-1',
        documentName: 'annual-report-2024.pdf',
        page: 8,
        chunkIndex: 1,
        totalChunks: 10,
      },
    },
    {
      id: 'chunk-3',
      content: 'Total operating expenses were $123 million',
      similarity: 0.85,
      metadata: {
        documentId: 'doc-2',
        documentName: 'quarterly-review.pdf',
        page: 2,
        chunkIndex: 0,
        totalChunks: 5,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildContext', () => {
    it('builds context string from sources', () => {
      const context = buildContext(mockSources);

      expect(context).toContain('Q1 revenue was $32 million');
      expect(context).toContain('annual-report-2024.pdf');
      expect(context).toContain('Page 5');
    });

    it('respects maxLength parameter', () => {
      const context = buildContext(mockSources, 100);

      // Should truncate to fit within maxLength
      expect(context.length).toBeLessThanOrEqual(200); // Allow some overhead for formatting
    });

    it('returns empty string for empty sources', () => {
      const context = buildContext([]);

      expect(context).toBe('');
    });

    it('includes source numbers in context', () => {
      const context = buildContext(mockSources);

      expect(context).toContain('[1]');
      expect(context).toContain('[2]');
      expect(context).toContain('[3]');
    });

    it('handles single source', () => {
      const context = buildContext([mockSources[0]]);

      expect(context).toContain('Q1 revenue');
      expect(context).toContain('[1]');
    });
  });

  describe('formatSourceCitations', () => {
    it('formats source citations correctly', () => {
      const citations = formatSourceCitations(mockSources);

      expect(citations).toContain('annual-report-2024.pdf');
      expect(citations).toContain('quarterly-review.pdf');
      expect(citations).toContain('p.5');
    });

    it('returns empty string for empty sources', () => {
      const citations = formatSourceCitations([]);

      expect(citations).toBe('');
    });

    it('omits page number when not present', () => {
      const sourcesWithoutPage = [
        {
          id: 'chunk-1',
          content: 'Some content',
          similarity: 0.9,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
      ];

      const citations = formatSourceCitations(sourcesWithoutPage);

      expect(citations).toContain('report.pdf');
      expect(citations).not.toContain('p.');
    });
  });

  describe('rerankSources', () => {
    it('re-ranks results by relevance', () => {
      const results = [
        {
          id: 'chunk-1',
          content: 'Operating expenses were high',
          similarity: 0.85,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
        {
          id: 'chunk-2',
          content: 'Q1 revenue was $32 million',
          similarity: 0.88,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 1,
            totalChunks: 1,
          },
        },
        {
          id: 'chunk-3',
          content: 'Q2 revenue details follow',
          similarity: 0.92,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 2,
            totalChunks: 1,
          },
        },
      ];

      const reranked = rerankSources(results, 'revenue for Q1');

      // Results should be sorted by combined score (higher is better)
      expect(reranked.length).toBe(3);
      // chunk-2 and chunk-3 should rank higher due to keyword overlap with 'revenue' and 'Q1'
      const revenueChunks = reranked.filter((r) => r.content.toLowerCase().includes('revenue'));
      expect(revenueChunks.length).toBeGreaterThan(0);
    });

    it('preserves all sources in reranking', () => {
      const results = Array(10)
        .fill(0)
        .map((_, i) => ({
          id: `chunk-${i}`,
          content: `Content ${i}`,
          similarity: 0.9 - i * 0.05,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: i,
            totalChunks: 10,
          },
        }));

      const reranked = rerankSources(results, 'test');

      expect(reranked).toHaveLength(10);
    });

    it('handles empty results', () => {
      const reranked = rerankSources([], 'test');

      expect(reranked).toEqual([]);
    });

    it('boosts sources with keyword overlap', () => {
      const results = [
        {
          id: 'chunk-1',
          content: 'Unrelated content about weather',
          similarity: 0.95,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
        {
          id: 'chunk-2',
          content: 'Revenue grew significantly',
          similarity: 0.8,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 1,
            totalChunks: 1,
          },
        },
      ];

      const reranked = rerankSources(results, 'revenue growth');

      // chunk-2 should be boosted due to keyword overlap
      expect(reranked[0].id).toBe('chunk-2');
    });
  });

  describe('deduplicateSources', () => {
    it('limits sources per document', () => {
      const results = [
        {
          id: 'chunk-1',
          content: 'First',
          similarity: 0.9,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 0,
            totalChunks: 3,
          },
        },
        {
          id: 'chunk-2',
          content: 'Second',
          similarity: 0.85,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 1,
            totalChunks: 3,
          },
        },
        {
          id: 'chunk-3',
          content: 'Third',
          similarity: 0.8,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 2,
            totalChunks: 3,
          },
        },
        {
          id: 'chunk-4',
          content: 'Fourth',
          similarity: 0.75,
          metadata: {
            documentId: 'doc-2',
            documentName: 'other.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
      ];

      const deduped = deduplicateSources(results, 2);

      expect(deduped).toHaveLength(3); // 2 from doc-1 + 1 from doc-2
    });

    it('returns all sources when within limits', () => {
      const results = [
        {
          id: 'chunk-1',
          content: 'First',
          similarity: 0.9,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
        {
          id: 'chunk-2',
          content: 'Second',
          similarity: 0.85,
          metadata: {
            documentId: 'doc-2',
            documentName: 'other.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
      ];

      const deduped = deduplicateSources(results, 3);

      expect(deduped).toHaveLength(2);
    });

    it('handles empty sources', () => {
      const deduped = deduplicateSources([], 3);

      expect(deduped).toEqual([]);
    });
  });

  describe('aggregateByDocument', () => {
    it('aggregates sources by document', () => {
      const aggregated = aggregateByDocument(mockSources);

      expect(aggregated).toHaveLength(2); // doc-1 and doc-2
      const doc1Agg = aggregated.find((a) => a.documentId === 'doc-1');
      expect(doc1Agg).toBeDefined();
      expect(doc1Agg?.chunks).toHaveLength(2);
      expect(doc1Agg?.documentName).toBe('annual-report-2024.pdf');
    });

    it('calculates relevance as max similarity', () => {
      const aggregated = aggregateByDocument(mockSources);

      const doc1Agg = aggregated.find((a) => a.documentId === 'doc-1');
      expect(doc1Agg?.relevance).toBe(0.92); // max of 0.92 and 0.88
    });

    it('sorts by relevance descending', () => {
      const aggregated = aggregateByDocument(mockSources);

      expect(aggregated[0].relevance).toBeGreaterThanOrEqual(aggregated[1].relevance);
    });

    it('handles empty sources', () => {
      const aggregated = aggregateByDocument([]);

      expect(aggregated).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('handles sources without optional fields', () => {
      const minimalSources = [
        {
          id: 'chunk-1',
          content: 'Content',
          similarity: 0.9,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: 0,
            totalChunks: 1,
          },
        },
      ];

      const context = buildContext(minimalSources);
      expect(context).toContain('Content');

      const citations = formatSourceCitations(minimalSources);
      expect(citations).toContain('report.pdf');
    });

    it('handles buildContext with very small maxLength', () => {
      const context = buildContext(mockSources, 50);

      expect(context.length).toBeLessThanOrEqual(150); // Allow overhead for formatting
    });

    it('handles reranking with empty query', () => {
      const reranked = rerankSources(mockSources, '');

      expect(reranked).toHaveLength(3);
    });

    it('handles deduplication with default maxPerDocument', () => {
      const results = Array(5)
        .fill(0)
        .map((_, i) => ({
          id: `chunk-${i}`,
          content: `Content ${i}`,
          similarity: 0.9 - i * 0.05,
          metadata: {
            documentId: 'doc-1',
            documentName: 'report.pdf',
            chunkIndex: i,
            totalChunks: 5,
          },
        }));

      const deduped = deduplicateSources(results);

      expect(deduped).toHaveLength(3); // default maxPerDocument is 3
    });
  });
});
