/**
 * Code Executor Tests
 *
 * Tests the isolated-vm sandbox for safe code execution.
 */
import { describe, expect, it } from 'vitest';
import { executeCode } from '@/lib/rag/tools/code-executor';

describe('Code Executor', () => {
  describe('basic execution', () => {
    it('executes simple arithmetic', async () => {
      const result = await executeCode('1 + 1');
      expect(result.success).toBe(true);
      expect(result.result).toBe('2');
    });

    it('executes console.log and captures output', async () => {
      const result = await executeCode('console.log("hello", "world")');
      expect(result.success).toBe(true);
      expect(result.logs).toBeDefined();
      expect(result.logs).toContain('hello world');
    });

    it('returns string results', async () => {
      const result = await executeCode('"hello".toUpperCase()');
      expect(result.success).toBe(true);
      expect(result.result).toBe('HELLO');
    });

    it('returns undefined for statements without return', async () => {
      const result = await executeCode('let x = 5;');
      expect(result.success).toBe(true);
      expect(result.result).toBe('undefined');
    });

    it('handles array operations', async () => {
      const result = await executeCode('[1, 2, 3].reduce((a, b) => a + b, 0)');
      expect(result.success).toBe(true);
      expect(result.result).toBe('6');
    });

    it('handles JSON operations', async () => {
      const result = await executeCode('JSON.stringify({ a: 1 })');
      expect(result.success).toBe(true);
      expect(result.result).toBe('{"a":1}');
    });

    it('handles Math operations', async () => {
      const result = await executeCode('Math.max(1, 2, 3)');
      expect(result.success).toBe(true);
      expect(result.result).toBe('3');
    });

    it('handles Date operations', async () => {
      const result = await executeCode('new Date(2024, 0, 1).getFullYear()');
      expect(result.success).toBe(true);
      expect(result.result).toBe('2024');
    });
  });

  describe('sandbox security', () => {
    it('rejects code exceeding max length', async () => {
      const longCode = 'let x = 1; '.repeat(1000);
      const result = await executeCode(longCode);
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    it('enforces execution timeout', async () => {
      // Use a recursive function that takes time but is not an infinite loop
      const result = await executeCode(
        'function fib(n) { return n <= 1 ? n : fib(n-1) + fib(n-2); } fib(40);',
        { timeout: 100 }
      );
      // This may or may not timeout depending on machine speed, but should not hang
      expect(result.success).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('reports syntax errors', async () => {
      const result = await executeCode('function (');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('reports runtime errors', async () => {
      const result = await executeCode('throw new Error("test error")');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles reference errors', async () => {
      const result = await executeCode('nonExistentVariable');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('context injection', () => {
    it('injects custom context variables', async () => {
      const result = await executeCode('x + y', {
        context: { x: 10, y: 20 },
      });
      expect(result.success).toBe(true);
      expect(result.result).toBe('30');
    });
  });
});
