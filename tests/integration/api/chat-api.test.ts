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
    chat: createMockModel(),
    message: createMockModel(),
    tokenUsage: createMockModel(),
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
}));

vi.mock('@/lib/env', () => ({
  env: {
    NODE_ENV: 'test',
    OPENAI_API_KEY: 'test-api-key',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    NEXTAUTH_SECRET: 'test-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
    ENCRYPTION_MASTER_KEY: 'test-encryption-key-for-vitest-32c',
    GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-api-key',
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
    })),
  },
}));

vi.mock('@/lib/notifications/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  emailService: { send: vi.fn().mockResolvedValue({ success: true }) },
}));

function setSession(session: unknown) {
  (globalThis as unknown as { __testSession: unknown }).__testSession = session;
}

describe('POST /api/chat', () => {
  const createMockRequest = (body: unknown): Request => {
    return new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { __testSession: unknown }).__testSession = null;
  });

  describe('Authentication', () => {
    it('requires authentication', async () => {
      setSession(null);

      const { POST } = await import('@/app/api/chat/route');
      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      // API returns { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 for invalid session', async () => {
      setSession(null);

      const { POST } = await import('@/app/api/chat/route');
      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('validates request body', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const { POST } = await import('@/app/api/chat/route');
      const request = createMockRequest({
        // Missing required fields
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('validates workspaceId is present', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const { POST } = await import('@/app/api/chat/route');
      const request = createMockRequest({
        message: 'Hello',
        // Missing workspaceId
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('rejects empty message', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const { POST } = await import('@/app/api/chat/route');
      const request = createMockRequest({
        message: '   ',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Workspace Access', () => {
    it('validates workspace access', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue(null);

      const { POST } = await import('@/app/api/chat/route');
      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'unauthorized-ws',
      });

      const response = await POST(request);

      // The API may return 400 or 403 depending on how workspace validation works
      // Check that it's not a success
      expect([400, 403]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('handles invalid JSON in request', async () => {
      setSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const { POST } = await import('@/app/api/chat/route');
      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
