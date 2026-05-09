/**
 * Graceful Degradation
 *
 * Feature flag system that tracks degraded features.
 * Fallback chain: Redis (fast) → Database (correct) → healthy (safe default).
 *
 * Circuit breakers auto-mark features as degraded when they open,
 * allowing the application to serve reduced responses instead of errors.
 */

import { logger } from '@/lib/logger';
import { isRedisConfigured, redis } from '@/lib/redis';

export type DegradableFeature = 'llm_generation' | 'vector_search' | 'file_upload' | 'webhooks';

const KEY_PREFIX = 'degraded:';
const DEGRADATION_TTL_MS = 5 * 60 * 1000; // 5 min default TTL

/**
 * Check if a feature is currently marked as degraded.
 * Strategy: Redis first (fast, 1ms), then database (correct, 5ms), then assume healthy.
 */
export async function isFeatureDegraded(feature: DegradableFeature): Promise<boolean> {
  // Layer 1: Redis (fastest)
  if (isRedisConfigured()) {
    try {
      const result = await redis.get(`${KEY_PREFIX}${feature}`);
      if (result !== null) return true;
    } catch {
      // Redis failed, fall through to database
    }
  }

  // Layer 2: Database (slower but persistent across serverless invocations)
  try {
    const { prisma } = await import('@/lib/db/client');
    const record = await prisma.systemHealth.findUnique({
      where: { feature },
    });

    if (!record || record.status !== 'degraded') return false;

    // Auto-recovery: if expiresAt has passed, clear the degradation
    if (record.expiresAt && record.expiresAt < new Date()) {
      await prisma.systemHealth.update({
        where: { feature },
        data: { status: 'healthy', expiresAt: null },
      });
      logger.info('Feature auto-recovered from degradation', { feature });
      return false;
    }

    return true;
  } catch (error) {
    // Database also failed — assume healthy (safe default)
    logger.debug('Could not check feature degradation status', {
      feature,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return false;
  }
}

/**
 * Mark a feature as degraded for a specified duration.
 * Writes to both Redis (fast reads) and database (persistent fallback).
 */
export async function markFeatureDegraded(
  feature: DegradableFeature,
  durationMs: number = DEGRADATION_TTL_MS
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMs);

  // Write to Redis
  if (isRedisConfigured()) {
    try {
      await redis.set(`${KEY_PREFIX}${feature}`, String(Date.now()), { px: durationMs });
    } catch {
      // Redis write failed, continue to database
    }
  }

  // Write to database
  try {
    const { prisma } = await import('@/lib/db/client');
    await prisma.systemHealth.upsert({
      where: { feature },
      create: { feature, status: 'degraded', expiresAt },
      update: { status: 'degraded', expiresAt },
    });
  } catch (error) {
    logger.debug('Failed to persist degradation to database', {
      feature,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }

  logger.warn('Feature marked as degraded', { feature, durationMs });
}

/**
 * Clear a degraded feature flag from both Redis and database.
 */
export async function clearFeatureDegraded(feature: DegradableFeature): Promise<void> {
  // Clear Redis
  if (isRedisConfigured()) {
    try {
      await redis.del(`${KEY_PREFIX}${feature}`);
    } catch {
      // Non-critical
    }
  }

  // Clear database
  try {
    const { prisma } = await import('@/lib/db/client');
    await prisma.systemHealth.update({
      where: { feature },
      data: { status: 'healthy', expiresAt: null },
    });
  } catch {
    // Non-critical
  }
}
