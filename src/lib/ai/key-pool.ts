/**
 * API Key Pool with Automatic Rotation
 *
 * Manages multiple API keys per provider with:
 * - Automatic failover on errors (rate limits, invalid keys)
 * - Round-robin distribution across healthy keys
 * - Key health tracking with cooldown periods
 * - Zero-downtime rotation via env var updates
 *
 * Configure multiple keys via comma-separated env vars:
 *   OPENROUTER_API_KEY=key1,key2,key3
 *   GOOGLE_GENERATIVE_AI_API_KEY=gemini-key1,gemini-key2
 *
 * Or numbered vars:
 *   OPENROUTER_API_KEY_1=key1
 *   OPENROUTER_API_KEY_2=key2
 */

import { logger } from '@/lib/logger';

interface KeyHealth {
  key: string;
  lastError: Date | null;
  errorCount: number;
  lastUsed: Date | null;
  cooldownUntil: Date | null;
}

export class KeyPool {
  private keys: KeyHealth[] = [];
  private currentIndex = 0;
  private readonly maxErrors = 3;
  private readonly cooldownMs = 60_000; // 1 minute cooldown after max errors
  private providerName: string;

  constructor(providerName: string, keys: string[]) {
    this.providerName = providerName;
    this.keys = keys
      .filter((k) => k.trim().length > 0)
      .map((key) => ({
        key: key.trim(),
        lastError: null,
        errorCount: 0,
        lastUsed: null,
        cooldownUntil: null,
      }));

    if (this.keys.length === 0) {
      logger.warn('KeyPool initialized with no keys', { provider: providerName });
    }
  }

  /** Get the next healthy key using round-robin. */
  getKey(): string | null {
    if (this.keys.length === 0) return null;
    if (this.keys.length === 1) return this.keys[0].key;

    const now = new Date();
    const startIndex = this.currentIndex;

    // Try each key starting from current index
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (startIndex + i) % this.keys.length;
      const kh = this.keys[idx];

      // Skip keys in cooldown
      if (kh.cooldownUntil && kh.cooldownUntil > now) continue;

      // Reset error count if cooldown has passed
      if (kh.cooldownUntil && kh.cooldownUntil <= now) {
        kh.errorCount = 0;
        kh.cooldownUntil = null;
      }

      this.currentIndex = (idx + 1) % this.keys.length;
      kh.lastUsed = now;
      return kh.key;
    }

    // All keys in cooldown - return least recently errored
    logger.warn('All keys in cooldown, using least errored', {
      provider: this.providerName,
    });
    const leastErrored = this.keys.reduce((a, b) => (a.errorCount <= b.errorCount ? a : b));
    leastErrored.lastUsed = now;
    return leastErrored.key;
  }

  /** Report a key error (rate limit, invalid, etc.). Triggers failover. */
  reportError(key: string, errorType: string): void {
    const kh = this.keys.find((k) => k.key === key);
    if (!kh) return;

    kh.lastError = new Date();
    kh.errorCount++;

    logger.warn('API key error reported', {
      provider: this.providerName,
      errorType,
      errorCount: kh.errorCount,
      maxErrors: this.maxErrors,
    });

    if (kh.errorCount >= this.maxErrors) {
      kh.cooldownUntil = new Date(Date.now() + this.cooldownMs);
      logger.warn('Key moved to cooldown', {
        provider: this.providerName,
        cooldownMs: this.cooldownMs,
      });
    }
  }

  /** Report a successful use (resets error count on the key). */
  reportSuccess(key: string): void {
    const kh = this.keys.find((k) => k.key === key);
    if (!kh) return;
    kh.errorCount = 0;
    kh.cooldownUntil = null;
  }

  /** Get health status of all keys. */
  getHealth(): {
    provider: string;
    totalKeys: number;
    healthyKeys: number;
    keys: Array<{ maskedKey: string; errorCount: number; inCooldown: boolean }>;
  } {
    const now = new Date();
    return {
      provider: this.providerName,
      totalKeys: this.keys.length,
      healthyKeys: this.keys.filter((k) => !k.cooldownUntil || k.cooldownUntil <= now).length,
      keys: this.keys.map((k) => ({
        maskedKey: maskKey(k.key),
        errorCount: k.errorCount,
        inCooldown: !!(k.cooldownUntil && k.cooldownUntil > now),
      })),
    };
  }

  /** Add a new key at runtime (for zero-downtime rotation). */
  addKey(key: string): void {
    if (!key.trim()) return;
    if (this.keys.some((k) => k.key === key.trim())) return;
    this.keys.push({
      key: key.trim(),
      lastError: null,
      errorCount: 0,
      lastUsed: null,
      cooldownUntil: null,
    });
    logger.info('Key added to pool', {
      provider: this.providerName,
      totalKeys: this.keys.length,
    });
  }

  /** Remove a key at runtime. */
  removeKey(key: string): void {
    const idx = this.keys.findIndex((k) => k.key === key);
    if (idx === -1) return;
    this.keys.splice(idx, 1);
    if (this.currentIndex >= this.keys.length) this.currentIndex = 0;
    logger.info('Key removed from pool', {
      provider: this.providerName,
      totalKeys: this.keys.length,
    });
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Singleton pools for each provider
// ---------------------------------------------------------------------------

function parseKeysFromEnv(value: string | undefined): string[] {
  if (!value) return [];
  // Support comma-separated keys
  return value
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

let _openRouterPool: KeyPool | null = null;
let _googlePool: KeyPool | null = null;
let _openAIPool: KeyPool | null = null;

export function getOpenRouterKeyPool(): KeyPool {
  if (!_openRouterPool) {
    _openRouterPool = new KeyPool('openrouter', parseKeysFromEnv(process.env.OPENROUTER_API_KEY));
  }
  return _openRouterPool;
}

export function getGoogleKeyPool(): KeyPool {
  if (!_googlePool) {
    _googlePool = new KeyPool('google', parseKeysFromEnv(process.env.GOOGLE_GENERATIVE_AI_API_KEY));
  }
  return _googlePool;
}

export function getOpenAIKeyPool(): KeyPool {
  if (!_openAIPool) {
    _openAIPool = new KeyPool('openai', parseKeysFromEnv(process.env.OPENAI_API_KEY));
  }
  return _openAIPool;
}

/** Reset pools (useful for testing or after env var updates). */
export function resetKeyPools(): void {
  _openRouterPool = null;
  _googlePool = null;
  _openAIPool = null;
}
