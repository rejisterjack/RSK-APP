import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted for mock data available in hoisted factories
const { mockPrisma, samplePDFDocument, sampleFinancialReportContent } = vi.hoisted(() => {
  function createMockModel() {
    return {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    };
  }

  const prisma = {
    user: createMockModel(),
    workspace: createMockModel(),
    membership: createMockModel(),
    document: createMockModel(),
    chunk: createMockModel(),
    documentChunk: createMockModel(),
    ingestionJob: createMockModel(),
    $transaction: vi.fn((fn: unknown) =>
      typeof fn === 'function' ? fn(prisma) : Promise.resolve([])
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  const samplePDFDocument = {
    id: 'doc-001',
    name: 'test-document.pdf',
    type: 'application/pdf',
    size: 1_000_000,
    status: 'PENDING',
    workspaceId: 'workspace-001',
    userId: 'user-001',
    content: 'Test document content for processing',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
      pages: 45,
      author: 'Finance Department',
      title: 'Annual Financial Report 2024',
    },
  };

  const sampleFinancialReportContent = `
Annual Financial Report 2024
Executive Summary

This report presents the financial performance of our company for fiscal year 2024.
Total revenue reached $150 million, representing a 25% increase from the previous year.

Revenue Breakdown

Q1 2024: $32 million
Q2 2024: $38 million
Q3 2024: $35 million
Q4 2024: $45 million
`;

  return { mockPrisma: prisma, samplePDFDocument, sampleFinancialReportContent };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
  validateChunks: vi.fn((chunks: unknown[]) => ({ valid: chunks, invalid: [] })),
  batchInsertChunks: vi.fn().mockResolvedValue({ count: 2, errors: [] }),
}));

vi.mock('pdf-parse', () => ({
  __esModule: true,
  default: vi.fn().mockResolvedValue({
    text: sampleFinancialReportContent,
    numpages: 45,
    info: {
      Author: 'Finance Department',
      Title: 'Annual Financial Report 2024',
    },
  }),
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockResolvedValue({
    value: 'Extracted Word document content',
  }),
}));

vi.mock('@/lib/rag/ingestion/image-pipeline', () => ({
  extractImagesFromPDF: vi.fn().mockResolvedValue([]),
  processDocumentImages: vi.fn().mockResolvedValue({ images: [] }),
}));

vi.mock('@/lib/rag/ingestion/parsers/ocr', () => ({
  performOCR: vi.fn().mockResolvedValue({
    text: 'OCR extracted text',
    confidence: 0.95,
  }),
  isScannedPDF: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/rag/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
  generateEmbeddingsBatch: vi
    .fn()
    .mockResolvedValue([Array(1536).fill(0.1), Array(1536).fill(0.2), Array(1536).fill(0.3)]),
}));

vi.mock('@/lib/ai/embeddings', () => ({
  createEmbeddingProviderFromEnv: vi.fn().mockReturnValue({
    embed: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
    embedBatch: vi.fn().mockResolvedValue([Array(1536).fill(0.1)]),
    embedDocuments: vi.fn().mockResolvedValue([Array(1536).fill(0.1)]),
    healthCheck: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['job-123'] }),
  },
}));

vi.mock('@/lib/rag/chunking', () => ({
  createChunks: vi.fn().mockResolvedValue([
    { id: 'chunk-1', documentId: 'doc-001', content: 'Test chunk 1', index: 0, metadata: {} },
    { id: 'chunk-2', documentId: 'doc-001', content: 'Test chunk 2', index: 1, metadata: {} },
  ]),
  recursiveChunking: vi.fn().mockReturnValue([]),
}));

describe('Document Ingestion Pipeline', () => {
  beforeAll(() => {
    // Setup test database connection if needed
  });

  afterAll(() => {
    // Cleanup
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PDF Processing', () => {
    it('extracts text content from PDF', async () => {
      const { parsePDF } = await import('@/lib/rag/ingestion');

      const result = await parsePDF(Buffer.from('fake-pdf'));

      expect(result).toContain('Annual Financial Report');
    });

    it('processes PDF document by ID', async () => {
      // processDocument takes a documentId and looks it up in the DB
      mockPrisma.document.findUnique = vi.fn().mockResolvedValue(samplePDFDocument);
      mockPrisma.document.update = vi.fn().mockResolvedValue({
        ...samplePDFDocument,
        status: 'PROCESSING',
      });
      mockPrisma.ingestionJob.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.chunk.createMany = vi.fn().mockResolvedValue({ count: 5 });

      const { processDocument } = await import('@/lib/rag/ingestion');

      // processDocument takes documentId string
      await processDocument('doc-001');

      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
        where: { id: 'doc-001' },
      });
      expect(mockPrisma.document.update).toHaveBeenCalled();
    });

    it('throws when document not found', async () => {
      mockPrisma.document.findUnique = vi.fn().mockResolvedValue(null);

      const { processDocument } = await import('@/lib/rag/ingestion');

      await expect(processDocument('nonexistent-doc')).rejects.toThrow('Document not found');
    });

    it('throws when document has no content', async () => {
      mockPrisma.document.findUnique = vi.fn().mockResolvedValue({
        ...samplePDFDocument,
        content: null,
      });

      const { processDocument } = await import('@/lib/rag/ingestion');

      await expect(processDocument('doc-001')).rejects.toThrow('Document has no content');
    });
  });

  describe('Word Document Processing', () => {
    it('processes DOCX files', async () => {
      const { parseDOCX } = await import('@/lib/rag/ingestion');

      const result = await parseDOCX(Buffer.from('fake-docx'));

      expect(result).toContain('Word document');
    });
  });

  describe('Text File Processing', () => {
    it('processes plain text files', async () => {
      const textContent = 'Simple text file content\nWith multiple lines.';

      const { parseText } = await import('@/lib/rag/ingestion');

      const result = parseText(Buffer.from(textContent));

      expect(result).toBe(textContent);
    });

    it('detects encoding', async () => {
      const utf8Content = 'UTF-8 content: emojis and resume';

      const { parseText } = await import('@/lib/rag/ingestion');

      const result = parseText(Buffer.from(utf8Content));

      expect(result).toContain('emojis');
    });
  });

  describe('Error Handling', () => {
    it('handles corrupted PDFs gracefully', async () => {
      const pdfParse = await import('pdf-parse');
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Invalid PDF structure'));

      const { parsePDF } = await import('@/lib/rag/ingestion');

      await expect(parsePDF(Buffer.from('corrupted'))).rejects.toThrow('Failed to parse PDF');
    });

    it('handles database errors during document lookup', async () => {
      mockPrisma.document.findUnique = vi
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const { processDocument } = await import('@/lib/rag/ingestion');

      await expect(processDocument('doc-001')).rejects.toThrow('Database connection failed');
    });
  });

  describe('Background Processing', () => {
    it('tracks processing progress', async () => {
      mockPrisma.document.findUnique = vi.fn().mockResolvedValue(samplePDFDocument);
      const mockUpdate = vi.fn().mockResolvedValue({ ...samplePDFDocument, status: 'PROCESSING' });
      mockPrisma.document.update = mockUpdate;
      mockPrisma.ingestionJob.findUnique = vi.fn().mockResolvedValue({
        id: 'job-1',
        documentId: 'doc-001',
        status: 'PENDING',
      });
      mockPrisma.ingestionJob.update = vi.fn().mockResolvedValue({});
      mockPrisma.chunk.createMany = vi.fn().mockResolvedValue({ count: 5 });

      const { processDocument } = await import('@/lib/rag/ingestion');

      await processDocument('doc-001');

      // Should update status at different stages
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: expect.any(String),
          }),
        })
      );
    });
  });
});
