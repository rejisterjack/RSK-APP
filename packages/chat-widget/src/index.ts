/**
 * RAG Chat Widget - Vanilla JS entry point.
 *
 * Exports the core widget class and all TypeScript types for
 * consumers who want direct DOM-based usage.
 *
 * @example
 * ```ts
 * import { RAGChatWidget } from '@rag-starter-kit/chat-widget';
 *
 * const widget = new RAGChatWidget({
 *   apiUrl: 'https://your-app.vercel.app',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Or use the static init method
 * RAGChatWidget.init({ apiUrl: 'https://your-app.vercel.app' });
 * ```
 */
export { RAGChatWidget } from './core/widget';
export type { ApiClient } from './core/api';
export type {
  ChatApiResponse,
  ChatMessage,
  Citation,
  ResolvedConfig,
  WidgetConfig,
  WidgetEventCallback,
  WidgetEventMap,
  WidgetEventType,
} from './core/types';
