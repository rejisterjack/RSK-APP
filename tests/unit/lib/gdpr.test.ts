/**
 * GDPR Compliance Tests
 *
 * Tests for data erasure token verification and consent management.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis before importing GDPR module
const mockRedisStore = new Map<string, string>();
const mockRedis = {
  get: vi.fn(async (key: string) => mockRedisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string, _opts?: { ex?: number }) => {
    mockRedisStore.set(key, value);
    return 'OK';
  }),
  del: vi.fn(async (key: string) => {
    mockRedisStore.delete(key);
    return 1;
  }),
};

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  isRedisConfigured: () => true,
}));

// Mock Prisma
const mockPrismaConsent = {
  create: vi.fn(),
  findFirst: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  prisma: {
    consent: mockPrismaConsent,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('GDPR Compliance', () => {
  beforeEach(() => {
    mockRedisStore.clear();
    vi.clearAllMocks();
  });

  describe('erasure token generation and verification', () => {
    it('generates a unique token stored in Redis', async () => {
      const { generateErasureToken } = await import('@/lib/compliance/gdpr');

      const token = await generateErasureToken('user-123');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Should have stored it in Redis
      expect(mockRedis.set).toHaveBeenCalledWith(
        'gdpr:erasure:user-123',
        token,
        { ex: 86400 }
      );
    });

    it('generates different tokens for each call', async () => {
      const { generateErasureToken } = await import('@/lib/compliance/gdpr');

      const token1 = await generateErasureToken('user-123');
      const token2 = await generateErasureToken('user-123');
      expect(token1).not.toBe(token2);
    });

    it('rejects invalid tokens', async () => {
      // This test verifies the verifyErasureToken function indirectly
      // Since processDataErasure calls verifyErasureToken internally
      const { processDataErasure } = await import('@/lib/compliance/gdpr');

      // No token stored in Redis, so verification should fail
      const report = await processDataErasure({
        userId: 'user-123',
        requestType: 'documents',
        verificationToken: 'invalid-token',
      });

      expect(report.status).toBe('failed');
      expect(report.errors).toContain('Invalid verification token');
    });
  });

  describe('consent management', () => {
    it('records consent to the database', async () => {
      const { recordConsent } = await import('@/lib/compliance/gdpr');

      mockPrismaConsent.create.mockResolvedValueOnce({ id: 'consent-1' });

      await recordConsent({
        userId: 'user-123',
        consentType: 'analytics',
        granted: true,
        grantedAt: new Date(),
        version: '1.0',
      });

      expect(mockPrismaConsent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          consentType: 'analytics',
          granted: true,
          version: '1.0',
        }),
      });
    });

    it('returns true when user has granted consent', async () => {
      const { hasConsent } = await import('@/lib/compliance/gdpr');

      mockPrismaConsent.findFirst.mockResolvedValueOnce({
        granted: true,
        grantedAt: new Date(),
      });

      const result = await hasConsent('user-123', 'analytics');
      expect(result).toBe(true);
    });

    it('returns false when user has no consent record', async () => {
      const { hasConsent } = await import('@/lib/compliance/gdpr');

      mockPrismaConsent.findFirst.mockResolvedValueOnce(null);

      const result = await hasConsent('user-123', 'analytics');
      expect(result).toBe(false);
    });

    it('returns false when consent was revoked', async () => {
      const { hasConsent } = await import('@/lib/compliance/gdpr');

      mockPrismaConsent.findFirst.mockResolvedValueOnce(null);

      const result = await hasConsent('user-123', 'marketing');
      expect(result).toBe(false);
    });

    it('queries for non-revoked consent of the correct type', async () => {
      const { hasConsent } = await import('@/lib/compliance/gdpr');

      mockPrismaConsent.findFirst.mockResolvedValueOnce(null);

      await hasConsent('user-456', 'data_processing');

      expect(mockPrismaConsent.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-456',
          consentType: 'data_processing',
          revokedAt: null,
        },
        orderBy: { grantedAt: 'desc' },
      });
    });
  });
});
