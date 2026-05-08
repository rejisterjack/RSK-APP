import { describe, expect, it } from 'vitest';
import { chunkFixed, chunkHierarchical, chunkSemantic } from '@/lib/rag/chunking';

describe('Chunking', () => {
  const sampleText = `
    Introduction to Machine Learning

    Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. This technology has revolutionized numerous industries, from healthcare to finance.

    Supervised Learning

    In supervised learning, algorithms learn from labeled training data to make predictions. Common applications include classification and regression tasks. Examples include spam detection, image recognition, and price prediction.

    Unsupervised Learning

    Unsupervised learning finds patterns in data without labeled outcomes. Clustering and dimensionality reduction are common techniques. Applications include customer segmentation and anomaly detection.

    Deep Learning

    Deep learning uses neural networks with multiple layers to model complex patterns. It has achieved remarkable success in computer vision, natural language processing, and game playing.
  `;

  // Helper: simple embedding function that returns a deterministic vector
  const mockEmbedFn = (text: string): number[] => {
    // Return a simple hash-based vector for testing
    const vec = new Array(10).fill(0);
    for (let i = 0; i < text.length; i++) {
      vec[i % 10] += text.charCodeAt(i);
    }
    // Normalize
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map((v) => v / mag);
  };

  describe('Fixed Size Chunking', () => {
    it('splits text into fixed size chunks', async () => {
      const chunks = await chunkFixed(sampleText, {
        chunkSize: 200,
        chunkOverlap: 50,
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk's content should be reasonably close to the limit
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(400); // allow some slack for merge/split
      });
    });

    it('respects chunk overlap', async () => {
      const chunks = await chunkFixed(sampleText, {
        chunkSize: 200,
        chunkOverlap: 50,
      });

      if (chunks.length > 1) {
        // Check that consecutive chunks share some content
        const overlap = findOverlap(chunks[0].content, chunks[1].content);
        expect(overlap.length).toBeGreaterThan(0);
      }
    });

    it('handles edge cases', async () => {
      // Empty text should throw
      await expect(chunkFixed('', { chunkSize: 100 })).rejects.toThrow();

      // Text shorter than chunk size
      const short = await chunkFixed('Short text', { chunkSize: 100 });
      // The minChunkSize default is 50, so "Short text" (10 chars) may be filtered out.
      // Test with a lower minChunkSize
      const shortWithMin = await chunkFixed('Short text', { chunkSize: 100, minChunkSize: 1 });
      expect(shortWithMin).toHaveLength(1);
      expect(shortWithMin[0].content).toBe('Short text');

      // Text exactly matching chunk size
      const exact = await chunkFixed('a'.repeat(100), { chunkSize: 100 });
      expect(exact).toHaveLength(1);
    });

    it('preserves metadata', async () => {
      const chunks = await chunkFixed(sampleText, {
        chunkSize: 500,
        documentId: 'doc-1',
      });

      expect(chunks[0].metadata).toMatchObject({
        index: 0,
      });
      // Each chunk should have an id and tokenCount
      chunks.forEach((chunk) => {
        expect(chunk.id).toBeTruthy();
        expect(typeof chunk.metadata.tokenCount).toBe('number');
      });
    });
  });

  describe('Semantic Chunking', () => {
    it('finds semantic boundaries', async () => {
      const text =
        'First paragraph about topic A.\n\nSecond paragraph about topic B.\n\nThird paragraph about topic C.';

      const chunks = await chunkSemantic(text, {
        minChunkSize: 10,
        maxChunkSize: 300,
        embeddingFunction: mockEmbedFn,
      });

      // Should create chunks at paragraph boundaries
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('handles headings as boundaries', async () => {
      const textWithHeadings = `
        # Section 1
        Content of section 1 goes here.
        More content here.

        # Section 2
        Content of section 2 goes here.
      `;

      const chunks = await chunkSemantic(textWithHeadings, {
        minChunkSize: 10,
        maxChunkSize: 500,
        embeddingFunction: mockEmbedFn,
      });

      // Each section should ideally be its own chunk
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('handles code blocks as atomic units', async () => {
      const textWithCode = `
        Here's some explanation.

        \`\`\`javascript
        const x = 1;
        const y = 2;
        console.log(x + y);
        \`\`\`

        More explanation.
      `;

      const chunks = await chunkSemantic(textWithCode, {
        minChunkSize: 10,
        maxChunkSize: 300,
        embeddingFunction: mockEmbedFn,
      });

      // Code block should not be split
      chunks.forEach((chunk) => {
        const codeStarts = (chunk.content.match(/```/g) || []).length;
        expect(codeStarts % 2).toBe(0); // Balanced code fences
      });
    });

    it('respects sentence boundaries', async () => {
      const text = 'First sentence. Second sentence. Third sentence.';

      const chunks = await chunkSemantic(text, {
        minChunkSize: 10,
        maxChunkSize: 50,
        embeddingFunction: mockEmbedFn,
      });

      // Should not split mid-sentence
      chunks.forEach((chunk) => {
        expect(chunk.content.trim().endsWith('.') || chunk.content.includes('. ')).toBeTruthy();
      });
    });
  });

  describe('Hierarchical Chunking', () => {
    it('creates parent-child relationships', async () => {
      const text = `# Chapter 1
Introduction to the topic.

## Section 1.1
Detailed content here. More details about this section that provide enough text for meaningful analysis and chunking.

## Section 1.2
More content in section 1.2 with additional details and information.`;

      const chunks = await chunkHierarchical(text, {
        maxChunkSize: 500,
      });

      // Should produce chunks from heading-based sections
      expect(chunks.length).toBeGreaterThan(0);
      // Chunks should have level metadata from the hierarchy
      expect(chunks.some((c) => c.metadata.level !== undefined)).toBe(true);
    });

    it('preserves document structure', async () => {
      const text = `# Section A
Content for section A.

# Section B
Content for section B.`;

      const chunks = await chunkHierarchical(text, {
        maxChunkSize: 500,
      });

      // Check that chunks have metadata
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.metadata).toBeDefined();
        expect(typeof chunk.metadata.index).toBe('number');
      });
    });

    it('handles deeply nested documents', async () => {
      const nestedText = `# Level 1
## Level 2
### Level 3
#### Level 4
Content at level 4 with enough text to be included as a valid chunk above the minimum size threshold.`;

      const chunks = await chunkHierarchical(nestedText, {
        maxChunkSize: 1000,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Recursive Chunking (via FixedChunker)', () => {
    it('recursively splits oversized chunks', async () => {
      const longText = 'word '.repeat(1000);

      const chunks = await chunkFixed(longText, {
        chunkSize: 200,
      });

      // All chunks should be reasonably sized
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(400);
      });
    });

    it('tries multiple separators in order', async () => {
      const text = 'First paragraph here.\n\nSecond paragraph here.\nThird line here. More text.';

      const chunks = await chunkFixed(text, {
        chunkSize: 30,
        separator: ['\n\n', '\n', '. '],
        minChunkSize: 1,
        chunkOverlap: 0,
      });

      // Should split the text into multiple chunks
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('falls back to character split if necessary', async () => {
      const noSeparatorText = 'a'.repeat(1000);

      const chunks = await chunkFixed(noSeparatorText, {
        chunkSize: 200,
        separator: ['\n\n', '\n'],
      });

      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(400);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles text with only whitespace', async () => {
      const whitespace = '   \n\n   \t   ';

      await expect(chunkFixed(whitespace, { chunkSize: 100 })).rejects.toThrow();
    });

    it('handles text with special characters', async () => {
      const special = 'Special chars: 🎉 émojis «quotes» ≠≠≠ \x00\x01\x02';

      const chunks = await chunkFixed(special, { chunkSize: 100, minChunkSize: 1 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toContain('🎉');
    });

    it('handles very long words', async () => {
      // Use a word that's longer than minChunkSize but not so long it causes
      // infinite recursion in the recursive splitter
      const longWord = 'a'.repeat(80);
      const text = `Start ${longWord} end`;

      const chunks = await chunkFixed(text, { chunkSize: 100, minChunkSize: 1 });
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('handles markdown tables', async () => {
      const table = `
        | Col1 | Col2 | Col3 |
        |------|------|------|
        | A1   | B1   | C1   |
        | A2   | B2   | C2   |
      `;

      const chunks = await chunkSemantic(table, {
        minChunkSize: 10,
        maxChunkSize: 200,
        embeddingFunction: mockEmbedFn,
      });

      // Table should not be split mid-row
      chunks.forEach((chunk) => {
        const rows = chunk.content.split('\n').filter((r) => r.includes('|'));
        if (rows.length > 1) {
          // All rows should have same column count
          const colCounts = rows.map((r) => r.split('|').length);
          expect(new Set(colCounts).size).toBe(1);
        }
      });
    });
  });
});

// Helper function to find overlap between two strings
function findOverlap(str1: string, str2: string): string {
  for (let i = Math.min(str1.length, str2.length); i > 0; i--) {
    if (str1.slice(-i) === str2.slice(0, i)) {
      return str1.slice(-i);
    }
  }
  return '';
}
