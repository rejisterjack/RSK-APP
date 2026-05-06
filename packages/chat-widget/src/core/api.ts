import type { ChatApiResponse, Citation, WidgetConfig } from './types';

/**
 * API client for communicating with the RAG Starter Kit backend.
 * Handles message sending, response parsing, and error handling.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly workspaceId: string | undefined;

  constructor(config: WidgetConfig) {
    // Strip trailing slash from apiUrl
    this.baseUrl = config.apiUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.workspaceId = config.workspaceId;
  }

  /**
   * Send a chat message and return the full response (non-streaming).
   * Used as fallback when SSE is not available.
   */
  async sendMessage(
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<{ answer: string; sources: Citation[] }> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/api/public/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        question,
        workspaceId: this.workspaceId,
        history,
      }),
    });

    const data: ChatApiResponse = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return {
      answer: data.data.answer,
      sources: data.data.citations,
    };
  }

  /**
   * Send a chat message with SSE streaming.
   * Calls onToken for each streamed chunk, onSources when citations arrive,
   * onDone when complete, and onError on failure.
   */
  async sendMessageStream(
    question: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    callbacks: {
      onToken: (token: string) => void;
      onSources: (sources: Citation[]) => void;
      onDone: (fullText: string) => void;
      onError: (error: Error) => void;
    },
    signal: AbortSignal
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/public/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          question,
          workspaceId: this.workspaceId,
          history,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed (${response.status})`;
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          // Response body was not valid JSON, use default message
        }
        callbacks.onError(new Error(errorMessage));
        return;
      }

      // The public chat endpoint returns a single JSON response (not SSE streaming).
      // We handle both the JSON response format and potential future SSE streaming.
      if (response.body) {
        await this.processResponseBody(response.body, callbacks, signal);
      } else {
        // Fallback for environments without ReadableStream
        const text = await response.text();
        this.parseFullResponse(text, callbacks);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Process a ReadableStream response body, handling both SSE and JSON formats.
   */
  private async processResponseBody(
    body: ReadableStream<Uint8Array>,
    callbacks: {
      onToken: (token: string) => void;
      onSources: (sources: Citation[]) => void;
      onDone: (fullText: string) => void;
      onError: (error: Error) => void;
    },
    signal: AbortSignal
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        if (signal.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          fullText += this.processLine(trimmed, callbacks, fullText);
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        fullText += this.processLine(buffer.trim(), callbacks, fullText);
      }

      callbacks.onDone(fullText);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        callbacks.onDone(fullText);
        return;
      }
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Process a single line from the stream response.
   * Returns any text content that was extracted.
   */
  private processLine(
    trimmed: string,
    callbacks: {
      onToken: (token: string) => void;
      onSources: (sources: Citation[]) => void;
      onDone: (fullText: string) => void;
      onError: (error: Error) => void;
    },
    _currentFullText: string
  ): string {
    // Try JSON format first (public API returns JSON)
    try {
      const data = JSON.parse(trimmed);

      // Streaming token format
      if (data.type === 'token' && data.content) {
        callbacks.onToken(data.content);
        return data.content;
      }
      if (data.type === 'done') {
        return '';
      }
      if (data.type === 'error') {
        callbacks.onError(new Error(data.message || 'Streaming error'));
        return '';
      }

      // Full JSON response from public chat API
      if (data.success === true && data.data) {
        const answer = data.data.answer || '';
        if (data.data.citations) {
          callbacks.onSources(data.data.citations);
        }
        callbacks.onToken(answer);
        return answer;
      }

      if (data.success === false) {
        callbacks.onError(new Error(data.error || 'Request failed'));
        return '';
      }

      return '';
    } catch {
      // Not JSON, try SSE format
    }

    // Try SSE format
    if (trimmed.startsWith('data: ')) {
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') {
        return '';
      }
      try {
        const parsed = JSON.parse(payload);
        if (parsed.content) {
          callbacks.onToken(parsed.content);
          return parsed.content;
        }
        if (parsed.type === 'done') {
          return '';
        }
      } catch {
        // SSE payload was not valid JSON, skip
      }
    }

    return '';
  }

  /**
   * Parse a full non-streaming response body.
   */
  private parseFullResponse(
    text: string,
    callbacks: {
      onToken: (token: string) => void;
      onSources: (sources: Citation[]) => void;
      onDone: (fullText: string) => void;
      onError: (error: Error) => void;
    }
  ): void {
    try {
      const data: ChatApiResponse = JSON.parse(text);
      if (data.success && data.data) {
        callbacks.onToken(data.data.answer);
        if (data.data.citations) {
          callbacks.onSources(data.data.citations);
        }
        callbacks.onDone(data.data.answer);
      } else {
        callbacks.onError(new Error(data.error || 'Request failed'));
      }
    } catch {
      // Treat as plain text
      callbacks.onToken(text);
      callbacks.onDone(text);
    }
  }

  /**
   * Fetch with automatic retry on network errors.
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 2
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < retries) {
          // Exponential backoff: 500ms, 1000ms
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }
}
