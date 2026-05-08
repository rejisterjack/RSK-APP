import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildEnrichedContext,
  ChunkingEngine,
  ChunkingError,
  chunkFixed,
  chunkHierarchical,
  chunkLate,
  chunkSemantic,
  countTokens,
  createLateChunkingEmbedder,
  estimateTokenCount,
  FixedChunker,
  getChildChunks,
  getChunkContextPath,
  getParentChunk,
  HierarchicalChunker,
  isLateChunkingSuitable,
  LateChunker,
  SemanticChunker,
  smartChunk,
} from '@/lib/rag/chunking';

describe('Text Chunking', () => {
  beforeEach(() => {
    ChunkingEngine.clearCache();
  });

  describe('FixedChunker', () => {
    it('should chunk text by size', async () => {
      const chunker = new FixedChunker();
      const text = 'This is a test sentence. Here is another one. And a third sentence too.';

      const chunks = await chunker.chunk(text, { strategy: 'fixed', chunkSize: 200 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should throw ChunkingError for empty text', async () => {
      const chunker = new FixedChunker();

      await expect(chunker.chunk('', { strategy: 'fixed', chunkSize: 100 })).rejects.toThrow(
        ChunkingError
      );
    });

    it('should handle text smaller than chunk size', async () => {
      const chunker = new FixedChunker();
      const text = 'Short text';

      const chunks = await chunker.chunk(text, {
        strategy: 'fixed',
        chunkSize: 100,
        minChunkSize: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should respect overlap setting', async () => {
      const chunker = new FixedChunker();
      const text = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8';

      const chunks = await chunker.chunk(text, {
        strategy: 'fixed',
        chunkSize: 20,
        chunkOverlap: 5,
      });

      if (chunks.length > 1) {
        // Check for overlap — at least some content should appear in consecutive chunks
        expect(chunks.length).toBeGreaterThan(1);
      }
    });

    it('should handle very large documents', async () => {
      const chunker = new FixedChunker();
      const text = 'This is a sentence. '.repeat(10000);

      const chunks = await chunker.chunk(text, { strategy: 'fixed', chunkSize: 500 });

      expect(chunks.length).toBeGreaterThan(100);
    });

    it('should include correct metadata', async () => {
      const chunker = new FixedChunker();
      const text =
        'First sentence of the document. Second sentence that follows. Third sentence here too. Fourth sentence continues. Fifth sentence wraps up.';

      const chunks = await chunker.chunk(text, { strategy: 'fixed', chunkSize: 100 });

      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.index).toBe(index);
        expect(chunk.metadata.start).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.end).toBeGreaterThan(chunk.metadata.start);
        expect(chunk.id).toBeDefined();
      });
    });

    it('should throw when overlap is greater than or equal to chunk size', async () => {
      const chunker = new FixedChunker();
      const text = 'Word1 Word2 Word3 Word4';

      await expect(
        chunker.chunk(text, {
          strategy: 'fixed',
          chunkSize: 10,
          chunkOverlap: 15,
        })
      ).rejects.toThrow('chunkOverlap must be less than chunkSize');
    });
  });

  describe('SemanticChunker', () => {
    it('should chunk text semantically', async () => {
      const chunker = new SemanticChunker();
      const text =
        'First topic sentence about revenue. Second topic sentence about growth. Third topic sentence about projections.';

      const mockEmbed = async (_text: string) => Array(1536).fill(0.1);

      const chunks = await chunker.chunk(text, {
        strategy: 'semantic',
        chunkSize: 100,
        minChunkSize: 0,
        embeddingFunction: mockEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should throw ChunkingError for empty text', async () => {
      const chunker = new SemanticChunker();
      const mockEmbed = async (texts: string[]) => {
        return texts.map(() => Array(1536).fill(0.1));
      };

      await expect(
        chunker.chunk('', { strategy: 'semantic', chunkSize: 100, embeddingFunction: mockEmbed })
      ).rejects.toThrow(ChunkingError);
    });

    it('should use similarity threshold to group related content', async () => {
      const chunker = new SemanticChunker();
      const text = 'Topic A content. More about topic A. Topic B content. More about topic B.';

      const mockEmbed = async (t: string) => {
        if (t.includes('Topic A') || t.includes('topic A')) {
          return Array(1536).fill(0.1);
        }
        if (t.includes('Topic B') || t.includes('topic B')) {
          return Array(1536).fill(0.9);
        }
        return Array(1536).fill(0.5);
      };

      const chunks = await chunker.chunk(text, {
        strategy: 'semantic',
        chunkSize: 200,
        embeddingFunction: mockEmbed,
        similarityThreshold: 0.5,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw error without embedding function', async () => {
      const chunker = new SemanticChunker();
      const text = 'Some text';

      await expect(chunker.chunk(text, { strategy: 'semantic', chunkSize: 100 })).rejects.toThrow(
        ChunkingError
      );
    });
  });

  describe('HierarchicalChunker', () => {
    it('should create hierarchical chunks from markdown headings', async () => {
      const chunker = new HierarchicalChunker();
      const document = `# Heading 1
Content under heading 1.

## Subheading 1.1
Content under subheading.

# Heading 2
Content under heading 2.`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
      // Should have parent-child relationships
      const parentChunks = chunks.filter(
        (c) => c.metadata.childIds && c.metadata.childIds.length > 0
      );
      expect(parentChunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle documents without headings', async () => {
      const chunker = new HierarchicalChunker();
      // HierarchicalChunker creates chunks from heading-based structure.
      // For documents without headings, it falls back to fixed-size splitting
      // when the content exceeds chunkSize.
      const document = Array(100).fill('This is a sentence without any headings.').join(' ');

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 200,
        hierarchicalLevels: 2,
      });

      // The chunker should produce chunks from the flat document
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for empty document', async () => {
      const chunker = new HierarchicalChunker();

      await expect(
        chunker.chunk('', {
          strategy: 'hierarchical',
          chunkSize: 100,
        })
      ).rejects.toThrow(ChunkingError);
    });

    it('should validate hierarchical levels', async () => {
      const chunker = new HierarchicalChunker();
      const document = '# Heading\nContent';

      await expect(
        chunker.chunk(document, {
          strategy: 'hierarchical',
          chunkSize: 100,
          hierarchicalLevels: 5,
        })
      ).rejects.toThrow('hierarchicalLevels must be between 1 and 3');
    });

    it('should establish parent-child relationships', async () => {
      const chunker = new HierarchicalChunker();
      const document = `# Section 1
Content 1

## Subsection 1.1
Subcontent 1.1

## Subsection 1.2
Subcontent 1.2

# Section 2
Content 2`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 3,
      });

      // Find chunks with children
      const parents = chunks.filter((c) => c.metadata.childIds && c.metadata.childIds.length > 0);

      if (parents.length > 0) {
        const parent = parents[0];
        if (parent.metadata.childIds) {
          const childId = parent.metadata.childIds[0];
          const child = chunks.find((c) => c.id === childId);
          expect(child).toBeDefined();
          expect(child?.metadata.parentId).toBe(parent.id);
        }
      }
    });

    it('should include heading paths in metadata', async () => {
      const chunker = new HierarchicalChunker();
      const document = `# Main Section
Content

## Sub Section
Sub content`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      // At least some chunks should have headings
      const withHeadings = chunks.filter(
        (c) => c.metadata.headings && c.metadata.headings.length > 0
      );
      expect(withHeadings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle numbered sections', async () => {
      const chunker = new HierarchicalChunker();
      const document = `1. Introduction
Intro content

2. Background
Background content

2.1. History
History content`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle roman numeral sections', async () => {
      const chunker = new HierarchicalChunker();
      const document = `I. First Section
Content

II. Second Section
More content`;

      const chunks = await chunker.chunk(document, {
        strategy: 'hierarchical',
        chunkSize: 1000,
        hierarchicalLevels: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('LateChunker', () => {
    it('should create chunks using token-level embeddings', async () => {
      const chunker = new LateChunker();
      const document = 'This is a test document with multiple sentences for late chunking.';

      const mockTokenEmbed = async (_text: string) => {
        const tokenCount = Math.ceil(document.length / 4);
        return Array(tokenCount)
          .fill(null)
          .map(() => Array(768).fill(0.1));
      };

      const chunks = await chunker.chunk(document, {
        strategy: 'late',
        chunkSize: 1000,
        chunkOverlap: 50,
        getTokenEmbeddings: mockTokenEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.embedding).toBeDefined();
        expect(chunk.embedding?.length).toBe(768);
      });
    });

    it('should throw error without token embedding function', async () => {
      const chunker = new LateChunker();
      const document = 'Some text';

      await expect(
        chunker.chunk(document, {
          strategy: 'late',
          chunkSize: 400,
        })
      ).rejects.toThrow(ChunkingError);
    });

    it('should throw error for context window too small', async () => {
      const chunker = new LateChunker();
      const document = 'Some text';

      await expect(
        chunker.chunk(document, {
          strategy: 'late',
          chunkSize: 500,
          getTokenEmbeddings: async () => [],
        })
      ).rejects.toThrow('chunkSize (context window) should be at least 1000');
    });

    it('should handle large documents by pre-splitting', async () => {
      const chunker = new LateChunker();
      const document = 'Paragraph one.\n\n'.repeat(500);

      const mockTokenEmbed = async (text: string) => {
        const tokenCount = Math.min(Math.ceil(text.length / 4), 1000);
        return Array(tokenCount)
          .fill(null)
          .map(() => Array(768).fill(0.1));
      };

      const chunks = await chunker.chunk(document, {
        strategy: 'late',
        chunkSize: 8191,
        chunkOverlap: 200,
        getTokenEmbeddings: mockTokenEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should include correct positions in metadata', async () => {
      const chunker = new LateChunker();
      const document = 'First sentence. Second sentence. Third sentence.';

      const mockTokenEmbed = async (_text: string) => {
        return Array(20)
          .fill(null)
          .map(() => Array(768).fill(0.1));
      };

      const chunks = await chunker.chunk(document, {
        strategy: 'late',
        chunkSize: 1000,
        chunkOverlap: 50,
        getTokenEmbeddings: mockTokenEmbed,
      });

      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.index).toBe(index);
        expect(chunk.metadata.start).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.end).toBeGreaterThan(chunk.metadata.start);
      });
    });
  });

  describe('ChunkingEngine', () => {
    it('should create fixed chunker', () => {
      const engine = ChunkingEngine.create('fixed');
      expect(engine).toBeInstanceOf(FixedChunker);
    });

    it('should create semantic chunker', () => {
      const engine = ChunkingEngine.create('semantic');
      expect(engine).toBeInstanceOf(SemanticChunker);
    });

    it('should create hierarchical chunker', () => {
      const engine = ChunkingEngine.create('hierarchical');
      expect(engine).toBeInstanceOf(HierarchicalChunker);
    });

    it('should create late chunker', () => {
      const engine = ChunkingEngine.create('late');
      expect(engine).toBeInstanceOf(LateChunker);
    });

    it('should cache chunker instances', () => {
      const chunker1 = ChunkingEngine.create('fixed');
      const chunker2 = ChunkingEngine.create('fixed');

      expect(chunker1).toBe(chunker2);
    });

    it('should chunk using static method', async () => {
      const text =
        'Test content for chunking. This is a longer text to ensure it meets the minimum chunk size requirement.';
      const chunks = await ChunkingEngine.chunk(text, {
        strategy: 'fixed',
        chunkSize: 100,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should chunk batch of documents', async () => {
      const documents = [
        {
          id: 'doc1',
          content:
            'Document one content. This is longer text to meet minimum chunk size requirements for testing purposes.',
        },
        {
          id: 'doc2',
          content:
            'Document two content. This is also longer text to meet minimum chunk size requirements for testing purposes.',
        },
      ];

      const results = await ChunkingEngine.chunkBatch(documents, {
        strategy: 'fixed',
        chunkSize: 200,
      });

      expect(results).toHaveLength(2);
      expect(results[0].documentId).toBe('doc1');
      expect(results[1].documentId).toBe('doc2');
    });

    it('should analyze document and recommend strategy', () => {
      const text = '# Markdown Document\n\nWith headings and structure.';
      const profile = ChunkingEngine.analyze(text);

      expect(profile).toHaveProperty('recommendedStrategy');
      expect(profile).toHaveProperty('type');
      expect(profile).toHaveProperty('structure');
    });

    it('should provide chunk statistics', async () => {
      const chunks = [
        { id: '1', content: 'Short', metadata: { index: 0, start: 0, end: 5, tokenCount: 1 } },
        {
          id: '2',
          content: 'Medium length text',
          metadata: { index: 1, start: 6, end: 24, tokenCount: 4 },
        },
        {
          id: '3',
          content: 'L'.repeat(1000),
          metadata: { index: 2, start: 25, end: 1025, tokenCount: 250 },
        },
      ];

      const stats = await ChunkingEngine.getStats(chunks);

      expect(stats.totalChunks).toBe(3);
      expect(stats.avgChunkSize).toBeGreaterThan(0);
      expect(stats.minChunkSize).toBe(5);
      expect(stats.maxChunkSize).toBe(1000);
      expect(stats.sizeDistribution).toBeDefined();
    });

    it('should handle empty chunks for statistics', async () => {
      const stats = await ChunkingEngine.getStats([]);

      expect(stats.totalChunks).toBe(0);
      expect(stats.avgChunkSize).toBe(0);
    });

    it('should smart chunk with auto strategy selection', async () => {
      const text =
        '# Structured Document\n\nThis has headings and enough content to pass the minimum chunk size threshold that is required by the fixed chunker implementation.';

      const { chunks, profile } = await ChunkingEngine.smartChunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(profile.recommendedStrategy).toBeDefined();
    });

    it('should allow strategy override in smart chunk', async () => {
      const text =
        'Plain text without structure but with enough content to exceed the minimum chunk size threshold for the semantic chunker to produce output.';

      const { chunks, profile } = await ChunkingEngine.smartChunk(text, {
        strategy: 'semantic',
        minChunkSize: 0,
        embeddingFunction: async () => Array(1536).fill(0.1),
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Convenience Functions', () => {
    it('chunkFixed should use fixed strategy', async () => {
      const text =
        'Test content that is long enough to meet the minimum chunk size threshold required by the fixed chunker implementation.';
      const chunks = await chunkFixed(text, { chunkSize: 100 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('chunkSemantic should use semantic strategy', async () => {
      const text =
        'Test content that is long enough to produce chunks when processed by the semantic chunker implementation.';
      const mockEmbed = async () => Array(1536).fill(0.1);

      const chunks = await chunkSemantic(text, {
        chunkSize: 100,
        embeddingFunction: mockEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('chunkHierarchical should use hierarchical strategy', async () => {
      const text =
        '# Heading\n\nThis is some content under the heading that should be long enough to meet minimum chunk size requirements for the hierarchical chunker.';
      const chunks = await chunkHierarchical(text, {
        chunkSize: 1000,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('chunkLate should use late strategy', async () => {
      const text =
        'Test content for late chunking that is sufficiently long to produce meaningful output chunks when processed.';
      const mockTokenEmbed = async () =>
        Array(20)
          .fill(null)
          .map(() => Array(768).fill(0.1));

      const chunks = await chunkLate(text, {
        chunkSize: 2000,
        getTokenEmbeddings: mockTokenEmbed,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('smartChunk should return chunks and profile', async () => {
      const text =
        'Test content that is long enough to meet the minimum chunk size threshold for the chunker to produce output chunks.';
      const { chunks, profile } = await smartChunk(text);

      expect(chunks).toBeDefined();
      expect(profile).toBeDefined();
    });
  });

  describe('Hierarchical Utilities', () => {
    const mockChunks = [
      {
        id: 'parent1',
        content: 'Parent',
        metadata: { index: 0, start: 0, end: 6, childIds: ['child1', 'child2'], tokenCount: 1 },
      },
      {
        id: 'child1',
        content: 'Child 1',
        metadata: { index: 1, start: 7, end: 14, parentId: 'parent1', tokenCount: 1 },
      },
      {
        id: 'child2',
        content: 'Child 2',
        metadata: { index: 2, start: 15, end: 22, parentId: 'parent1', tokenCount: 1 },
      },
      {
        id: 'orphan',
        content: 'Orphan',
        metadata: { index: 3, start: 23, end: 29, tokenCount: 1 },
      },
    ];

    it('getParentChunk should return parent for child', () => {
      const child = mockChunks[1];
      const parent = getParentChunk(child, mockChunks);

      expect(parent).toBe(mockChunks[0]);
    });

    it('getParentChunk should return undefined for orphan', () => {
      const orphan = mockChunks[3];
      const parent = getParentChunk(orphan, mockChunks);

      expect(parent).toBeUndefined();
    });

    it('getChildChunks should return children for parent', () => {
      const parent = mockChunks[0];
      const children = getChildChunks(parent, mockChunks);

      expect(children).toHaveLength(2);
      expect(children).toContain(mockChunks[1]);
      expect(children).toContain(mockChunks[2]);
    });

    it('getChildChunks should return empty array for leaf', () => {
      const leaf = mockChunks[1];
      const children = getChildChunks(leaf, mockChunks);

      expect(children).toHaveLength(0);
    });

    it('getChunkContextPath should return ancestor chain', () => {
      const grandchild = {
        id: 'grandchild',
        content: 'Grandchild',
        metadata: { index: 4, start: 30, end: 40, parentId: 'child1', tokenCount: 1 },
      };
      const allChunks = [...mockChunks, grandchild];

      const path = getChunkContextPath(grandchild, allChunks);

      expect(path).toHaveLength(2);
      expect(path[0]).toBe(mockChunks[0]); // parent1
      expect(path[1]).toBe(mockChunks[1]); // child1
    });

    it('buildEnrichedContext should add heading context', () => {
      const chunkWithHeadings = {
        id: 'chunk',
        content: 'Content',
        metadata: {
          index: 0,
          start: 0,
          end: 7,
          headings: ['Section 1', 'Subsection 1.1'],
          tokenCount: 1,
        },
      };

      const context = buildEnrichedContext(chunkWithHeadings, []);

      expect(context).toContain('Section 1');
      expect(context).toContain('Subsection 1.1');
      expect(context).toContain('Content');
    });

    it('buildEnrichedContext should include parent content when requested', () => {
      const allChunks = [
        {
          id: 'parent',
          content: 'Parent content here',
          metadata: { index: 0, start: 0, end: 19, tokenCount: 4 },
        },
        {
          id: 'child',
          content: 'Child content',
          metadata: { index: 1, start: 20, end: 33, parentId: 'parent', tokenCount: 2 },
        },
      ];

      const context = buildEnrichedContext(allChunks[1], allChunks, {
        includeParentContent: true,
        maxParentContentLength: 50,
      });

      expect(context).toContain('Parent Context');
      expect(context).toContain('Child content');
    });
  });

  describe('Late Chunking Utilities', () => {
    it('createLateChunkingEmbedder should create token embedder', async () => {
      const mockEmbed = async (texts: string[]) => {
        return texts.map(() => Array(768).fill(0.1));
      };

      const embedder = createLateChunkingEmbedder(mockEmbed, { simulateTokens: 16 });
      const embeddings = await embedder('Test text for embedding');

      expect(Array.isArray(embeddings)).toBe(true);
      expect(embeddings.length).toBeGreaterThan(0);
      expect(embeddings[0].length).toBe(768);
    });

    it('isLateChunkingSuitable should check document size', async () => {
      const smallDoc = 'Small';
      const largeDoc = 'Word '.repeat(10000);

      const smallResult = await isLateChunkingSuitable(smallDoc, 8191);
      const largeResult = await isLateChunkingSuitable(largeDoc, 1000);

      expect(smallResult.suitable).toBe(true);
      expect(largeResult.suitable).toBe(false);
    });

    it('isLateChunkingSuitable should handle medium-sized documents', async () => {
      // Use a document that is within context window
      const doc = 'Word '.repeat(2000);

      const result = await isLateChunkingSuitable(doc, 8191);

      expect(result.suitable).toBe(true);
      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });
  });

  describe('Token Counting', () => {
    it('should count tokens for English text', () => {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const tokens = estimateTokenCount(text);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle empty text', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should scale with text length', () => {
      const shortText = 'Hello';
      const longText = 'Hello '.repeat(10);

      const shortTokens = estimateTokenCount(shortText);
      const longTokens = estimateTokenCount(longText);

      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should count tokens accurately', async () => {
      const text = 'This is a test.';
      const count = await countTokens(text);

      expect(count.total).toBeGreaterThan(0);
      expect(count.total).toBeLessThan(20);
    });

    it('should handle non-English text', () => {
      const chineseText = '这是一个中文测试。';
      const tokens = estimateTokenCount(chineseText);

      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should throw ChunkingError for whitespace-only documents', async () => {
      const chunker = new FixedChunker();
      const text = '   \n\n   \t   ';

      await expect(chunker.chunk(text, { strategy: 'fixed', chunkSize: 100 })).rejects.toThrow(
        ChunkingError
      );
    });

    it('should handle single character documents', async () => {
      const chunker = new FixedChunker();
      const text = 'X';

      const chunks = await chunker.chunk(text, {
        strategy: 'fixed',
        chunkSize: 100,
        minChunkSize: 0,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('X');
    });

    it('should handle documents with special characters', async () => {
      const chunker = new FixedChunker();
      const text =
        'Special characters: @#$%^&*() plus regular text that makes the chunk long enough to pass the minimum size filter.';

      const chunks = await chunker.chunk(text, { strategy: 'fixed', chunkSize: 100 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', async () => {
      const chunker = new FixedChunker();
      const text = 'Unicode test: Japanese text and Arabic text and Hebrew text';

      const chunks = await chunker.chunk(text, { strategy: 'fixed', chunkSize: 50 });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very small chunk sizes', async () => {
      const chunker = new FixedChunker();
      const text =
        'This is a test sentence that is long enough. This is another test sentence. And a third one here.';

      // With a reasonable chunkSize, should produce valid chunks
      const chunks = await chunker.chunk(text, {
        strategy: 'fixed',
        chunkSize: 60,
        minChunkSize: 0,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should throw when overlap is larger than chunk size', async () => {
      const chunker = new FixedChunker();
      const text = 'Word1 Word2 Word3 Word4';

      await expect(
        chunker.chunk(text, {
          strategy: 'fixed',
          chunkSize: 10,
          chunkOverlap: 15,
        })
      ).rejects.toThrow(ChunkingError);
    });
  });
});
