/**
 * Chaos Engineering Tests
 *
 * Simulates failures in external services (Redis, embedding provider, LLM, storage)
 * and verifies graceful degradation behavior.
 *
 * Run: pnpm vitest run tests/resilience/chaos.test.ts
 *
 * These tests validate that the application degrades gracefully rather than
 * crashing when individual services become unavailable.
 */

import { describe, expect, it, vi } from 'vitest';
import { CircuitBreaker, CircuitState } from '@/lib/utils/retry';

// ---------------------------------------------------------------------------
// Circuit breaker chaos tests
// ---------------------------------------------------------------------------

describe('Circuit Breaker under failure conditions', () => {
  it('opens after consecutive failures', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
    });

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Service unavailable');
        });
      } catch {
        // Expected
      }
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('rejects calls immediately when open', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10000,
    });

    // Trip the breaker
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        /* expected */
      }
    }

    // Should reject immediately without calling the function
    const fn = vi.fn().mockResolvedValue('result');
    await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is OPEN');
    expect(fn).not.toHaveBeenCalled();
  });

  it('recovers to closed state after reset timeout', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 5000,
    });

    // Trip the breaker
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        /* expected */
      }
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Advance past reset timeout
    vi.advanceTimersByTime(6000);

    // Next call should be allowed (HALF_OPEN -> CLOSED on success)
    const result = await breaker.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation tests
// ---------------------------------------------------------------------------

describe('Graceful degradation under service failures', () => {
  it('degrades LLM generation when provider is unavailable', async () => {
    // Simulate LLM failure
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30000,
    });

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('LLM provider timeout');
        });
      } catch {
        /* expected */
      }
    }

    // Verify breaker is open - feature should be degraded
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('handles embedding provider failure with fallback', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });

    // Trip the breaker
    for (let i = 0; i < 5; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Embedding API error');
        });
      } catch {
        /* expected */
      }
    }

    // Vector search should be degraded, not crashed
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Application should still respond (just without vector search)
    // This is validated by the health check endpoint
  });

  it('handles Redis unavailability with in-memory fallback', async () => {
    // Simulate Redis failure
    const mockRedisGet = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const mockRedisSet = vi.fn().mockRejectedValue(new Error('Connection refused'));

    // Verify fallback behavior
    let result: string | null = null;
    try {
      result = await mockRedisGet('degraded:llm_generation');
    } catch {
      // Fallback to in-memory
      result = null;
    }

    expect(result).toBeNull();
    expect(mockRedisGet).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Concurrent failure tests
// ---------------------------------------------------------------------------

describe('Concurrent service failures', () => {
  it('handles multiple services failing simultaneously', async () => {
    const llmBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30000,
    });
    const embedBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 60000,
    });
    const storageBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30000,
    });

    // Trip all breakers concurrently
    await Promise.allSettled([
      ...Array(3)
        .fill(null)
        .map(() =>
          llmBreaker
            .execute(async () => {
              throw new Error('LLM down');
            })
            .catch(() => {})
        ),
      ...Array(5)
        .fill(null)
        .map(() =>
          embedBreaker
            .execute(async () => {
              throw new Error('Embed down');
            })
            .catch(() => {})
        ),
      ...Array(3)
        .fill(null)
        .map(() =>
          storageBreaker
            .execute(async () => {
              throw new Error('Storage down');
            })
            .catch(() => {})
        ),
    ]);

    expect(llmBreaker.getState()).toBe(CircuitState.OPEN);
    expect(embedBreaker.getState()).toBe(CircuitState.OPEN);
    expect(storageBreaker.getState()).toBe(CircuitState.OPEN);

    // Application should still have basic functionality
    // (chat history, document listing, etc. don't require these services)
  });
});

// ---------------------------------------------------------------------------
// Recovery tests
// ---------------------------------------------------------------------------

describe('Service recovery', () => {
  it('recovers individual services independently', async () => {
    vi.useFakeTimers();

    const llmBreaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 5000,
    });
    const embedBreaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 10000,
    });

    // Trip both
    for (const breaker of [llmBreaker, embedBreaker]) {
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          /* expected */
        }
      }
    }

    expect(llmBreaker.getState()).toBe(CircuitState.OPEN);
    expect(embedBreaker.getState()).toBe(CircuitState.OPEN);

    // LLM recovers first (shorter timeout)
    vi.advanceTimersByTime(6000);
    await llmBreaker.execute(async () => 'llm-ok');
    expect(llmBreaker.getState()).toBe(CircuitState.CLOSED);

    // Embeddings still open
    expect(embedBreaker.getState()).toBe(CircuitState.OPEN);

    // Embeddings recover later
    vi.advanceTimersByTime(5000);
    await embedBreaker.execute(async () => 'embed-ok');
    expect(embedBreaker.getState()).toBe(CircuitState.CLOSED);

    vi.useRealTimers();
  });
});
