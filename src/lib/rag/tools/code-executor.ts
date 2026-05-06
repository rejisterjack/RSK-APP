/**
 * Code Executor Tool
 *
 * Safely executes JavaScript code in a sandboxed environment using
 * isolated-vm (V8 isolates) with timeout protection and memory limits.
 *
 * Falls back to a disabled state when isolated-vm is not available
 * (e.g. unsupported Node.js version, missing native binary).
 */

import { z } from 'zod';
import { createErrorResult, createSuccessResult, createTool } from './types';

// ============================================================================
// Code Executor Parameters Schema
// ============================================================================

const CodeExecutorParamsSchema = z.object({
  code: z.string().describe('The JavaScript code to execute'),
  timeout: z.number().optional().describe('Execution timeout in milliseconds (default: 5000)'),
  memoryLimit: z.number().optional().describe('Memory limit in MB (default: 50)'),
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Variables to inject into the execution context'),
});

type CodeExecutorParams = z.infer<typeof CodeExecutorParamsSchema>;

// ============================================================================
// Sandbox Implementation
// ============================================================================

interface ExecutionResult {
  result: unknown;
  logs: string[];
  executionTime: number;
  memoryUsed: number;
}

/**
 * Maximum allowed code length in characters.
 */
const MAX_CODE_LENGTH = 10_000;

let ivmLoaded = false;
let ivmModule: typeof import('isolated-vm') | null = null;

async function loadIvm(): Promise<typeof import('isolated-vm') | null> {
  if (ivmLoaded) return ivmModule;
  try {
    ivmModule = await import('isolated-vm');
    ivmLoaded = true;
    return ivmModule;
  } catch {
    ivmLoaded = true;
    ivmModule = null;
    return null;
  }
}

/**
 * Execute code inside a V8 isolate sandbox with real timeout and memory limits.
 */
async function executeInSandbox(
  code: string,
  timeout: number,
  memoryLimitMB: number,
  userContext: Record<string, unknown> = {}
): Promise<ExecutionResult> {
  const ivm = await loadIvm();
  if (!ivm) {
    throw new Error('Code execution is unavailable: isolated-vm native module could not be loaded. This usually means the Node.js version is not yet supported.');
  }

  const startTime = Date.now();
  const logs: string[] = [];

  const isolate = new ivm.Isolate({ memoryLimit: memoryLimitMB });
  const logCallback = new ivm.Reference(function (...args: unknown[]) {
    logs.push(
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    );
  });
  const errorCallback = new ivm.Reference(function (...args: unknown[]) {
    logs.push(
      `[ERROR] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
    );
  });
  const warnCallback = new ivm.Reference(function (...args: unknown[]) {
    logs.push(
      `[WARN] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
    );
  });
  const infoCallback = new ivm.Reference(function (...args: unknown[]) {
    logs.push(
      `[INFO] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}`
    );
  });

  try {
    const context = isolate.createContextSync();
    const jail = context.global;

    // Set up console object with callback-based logging
    jail.setSync('console', new ivm.ExternalCopy({}));
    context.evalSync(
      `console.log = (...args) => _logCb.applySync(undefined, args);` +
        `console.error = (...args) => _errorCb.applySync(undefined, args);` +
        `console.warn = (...args) => _warnCb.applySync(undefined, args);` +
        `console.info = (...args) => _infoCb.applySync(undefined, args);`
    );
    jail.setSync('_logCb', logCallback);
    jail.setSync('_errorCb', errorCallback);
    jail.setSync('_warnCb', warnCallback);
    jail.setSync('_infoCb', infoCallback);

    // Inject safe globals that are not already in the V8 context
    const safeGlobals: Record<string, unknown> = {
      Math,
      Date,
      JSON,
      parseInt,
      parseFloat,
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,
      encodeURI,
      decodeURI,
      encodeURIComponent,
      decodeURIComponent,
    };

    for (const [key, value] of Object.entries(safeGlobals)) {
      jail.setSync(key, new ivm.ExternalCopy(value));
    }

    // Inject user-provided context variables
    for (const [key, value] of Object.entries(userContext)) {
      try {
        jail.setSync(key, new ivm.ExternalCopy(value));
      } catch {
        // If ExternalCopy cannot handle the value (e.g. functions), skip it
      }
    }

    // Compile and execute the user code
    const script = isolate.compileScriptSync(code, {
      filename: 'sandbox://user-code.js',
    });

    const result = script.runSync(context, { timeout, copy: true });

    // Collect actual memory usage
    const heapStats = isolate.getHeapStatisticsSync();
    const memoryUsed = heapStats.used_heap_size;

    return {
      result,
      logs,
      executionTime: Date.now() - startTime,
      memoryUsed,
    };
  } finally {
    // Clean up all references and the isolate
    logCallback.release();
    errorCallback.release();
    warnCallback.release();
    infoCallback.release();
    isolate.dispose();
  }
}

// ============================================================================
// Code Executor Tool
// ============================================================================

export const codeExecutorTool = createTool<CodeExecutorParams>({
  name: 'code_executor',
  description: `Execute JavaScript code safely in a sandboxed environment.

Supports:
- Mathematical calculations and data processing
- Array and object manipulation
- String operations
- Date calculations
- JSON parsing and stringification

Limitations:
- No network access (fetch, XMLHttpRequest, etc.)
- No file system access
- No access to browser/Node.js globals
- 5 second timeout (configurable)
- 50MB memory limit (configurable)

Use console.log() to output intermediate results.

Examples:
- "const arr = [1, 2, 3, 4, 5]; console.log(arr.reduce((a, b) => a + b, 0));"
- "const data = [{name: 'A', value: 10}, {name: 'B', value: 20}]; data.sort((a, b) => b.value - a.value);"
- "const fib = (n) => n <= 1 ? n : fib(n-1) + fib(n-2); fib(10);"`,
  parameters: CodeExecutorParamsSchema,
  execute: async (params) => {
    try {
      const { code, timeout = 5000, memoryLimit = 50, context = {} } = params;

      // Validate code length
      if (code.length > MAX_CODE_LENGTH) {
        return createErrorResult(
          `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`
        );
      }

      // Execute code in isolated-vm sandbox
      const result = await executeInSandbox(code, timeout, memoryLimit, context);

      // Format result
      let formattedResult: Record<string, unknown>;
      if (result.result === undefined) {
        formattedResult = { output: 'undefined', logs: result.logs };
      } else if (result.result === null) {
        formattedResult = { output: 'null', logs: result.logs };
      } else if (typeof result.result === 'object') {
        formattedResult = {
          output: JSON.stringify(result.result, null, 2),
          type: 'object',
          logs: result.logs,
        };
      } else {
        formattedResult = {
          output: String(result.result),
          type: typeof result.result,
          logs: result.logs,
        };
      }

      return createSuccessResult({
        ...formattedResult,
        executionTime: `${result.executionTime}ms`,
        memoryUsed: `${(result.memoryUsed / (1024 * 1024)).toFixed(2)}MB`,
        memoryLimit: `${memoryLimit}MB`,
        timeout: `${timeout}ms`,
      });
    } catch (error) {
      // Handle isolated-vm specific errors
      if (error instanceof Error) {
        if (error.message.includes('Script execution timed out')) {
          return createErrorResult(`Execution timed out after the configured limit`);
        }
        if (
          error.message.includes('CompileError') ||
          error.message.includes('Unexpected') ||
          error.message.includes('SyntaxError')
        ) {
          return createErrorResult(`Compilation error: ${error.message}`);
        }
        if (error.message.includes('RuntimeError') || error.message.includes('RangeError')) {
          return createErrorResult(`Runtime error: ${error.message}`);
        }
        return createErrorResult(error.message);
      }
      return createErrorResult('Code execution failed');
    }
  },
});

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick code execution without creating tool instance
 */
export async function executeCode(
  code: string,
  options?: {
    timeout?: number;
    memoryLimit?: number;
    context?: Record<string, unknown>;
  }
): Promise<{ success: boolean; result?: unknown; error?: string; logs?: string[] }> {
  const result = await codeExecutorTool.execute({
    code,
    timeout: options?.timeout,
    memoryLimit: options?.memoryLimit,
    context: options?.context,
  });

  if (result.success && typeof result.data === 'object' && result.data !== null) {
    const data = result.data as { output: string; logs: string[] };
    return {
      success: true,
      result: data.output,
      logs: data.logs,
    };
  }

  return {
    success: result.success,
    result: result.data,
    error: result.error,
  };
}

/**
 * Execute multiple code snippets in sequence
 */
export async function executeCodeBatch(
  snippets: Array<{
    name: string;
    code: string;
    context?: Record<string, unknown>;
  }>
): Promise<
  Record<string, { success: boolean; result?: unknown; error?: string; logs?: string[] }>
> {
  const results: Record<
    string,
    { success: boolean; result?: unknown; error?: string; logs?: string[] }
  > = {};

  for (const { name, code, context } of snippets) {
    results[name] = await executeCode(code, { context });
  }

  return results;
}
