import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to define mock data so it's available in hoisted vi.mock factories
const { mockPrisma } = vi.hoisted(() => {
  function createMockModel() {
    return {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    };
  }

  const prisma = {
    user: createMockModel(),
    account: createMockModel(),
    session: createMockModel(),
    workspace: createMockModel(),
    membership: createMockModel(),
    document: createMockModel(),
    chunk: createMockModel(),
    $transaction: vi.fn((fn: unknown) =>
      typeof fn === 'function' ? fn(prisma) : Promise.resolve([])
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };

  return { mockPrisma: prisma };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => {
    const session = (globalThis as unknown as { __testSession: unknown }).__testSession;
    return Promise.resolve(session);
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  withApiAuth: vi.fn((handler: (req: unknown, session: unknown) => Promise<unknown>) => {
    return async (req: unknown) => {
      const session = (globalThis as unknown as { __testSession: unknown }).__testSession;
      if (!session) {
        const { NextResponse } = await import('next/server');
        return NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 }
        );
      }
      return handler(req, session);
    };
  }),
}));

vi.mock('@/lib/rag/ingestion', () => ({
  processDocument: vi.fn().mockResolvedValue({
    success: true,
    document: { id: 'doc-1' },
  }),
}));

vi.mock('@/lib/rag/ingestion/parsers/ocr', () => ({
  performOCR: vi.fn().mockResolvedValue({
    text: 'OCR extracted text',
    confidence: 0.95,
  }),
}));

vi.mock('@/lib/rag/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
  generateEmbeddingsBatch: vi.fn().mockResolvedValue([Array(1536).fill(0.1)]),
}));

function setSession(session: unknown) {
  (globalThis as unknown as { __testSession: unknown }).__testSession = session;
}

describe('POST /api/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { __testSession: unknown }).__testSession = null;
  });

  const createMockFormData = (files: File[], metadata?: Record<string, unknown>): FormData => {
    const formData = new FormData();
    files.forEach((file, i) => {
      formData.append(`file-${i}`, file);
    });
    formData.append('workspaceId', 'ws-1');
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return formData;
  };

  const createMockRequest = (formData: FormData): Request => {
    return new Request('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });
  };

  describe('Authentication', () => {
    it('requires authentication', async () => {
      setSession(null);

      const { POST } = await import('@/app/api/ingest/route');
      const formData = createMockFormData([
        new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Workspace Access', () => {
    it('validates workspace access', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue(null);

      const { POST } = await import('@/app/api/ingest/route');
      const formData = createMockFormData([
        new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      ]);
      formData.set('workspaceId', 'unauthorized-ws');

      const request = createMockRequest(formData);
      const response = await POST(request);

      // API may return 400 or 403 depending on implementation
      expect([400, 403]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed form data', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const { POST } = await import('@/app/api/ingest/route');
      const request = new Request('http://localhost:3000/api/ingest', {
        method: 'POST',
        body: 'invalid-form-data',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
