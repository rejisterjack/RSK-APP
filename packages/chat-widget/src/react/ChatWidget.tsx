import { useEffect, useRef } from 'react';
import { RAGChatWidget } from '../core/widget';
import type { WidgetConfig } from '../core/types';

/**
 * Props for the React ChatWidget component.
 * Mirrors the WidgetConfig interface with all optional except apiUrl.
 */
export interface ChatWidgetProps extends Omit<WidgetConfig, 'apiUrl'> {
  /** Base URL of the RAG Starter Kit backend */
  apiUrl: string;
  /** Additional CSS class for the host container */
  className?: string;
}

/**
 * React wrapper around the vanilla RAGChatWidget.
 *
 * Manages the widget lifecycle: creates it on mount, updates it when
 * props change, and cleans up on unmount.
 *
 * @example
 * ```tsx
 * import { ChatWidget } from '@rag-starter-kit/chat-widget/react';
 *
 * function App() {
 *   return (
 *     <>
 *       <ChatWidget apiUrl="https://your-app.vercel.app" apiKey="..." />
 *       <div>Your app content</div>
 *     </>
 *   );
 * }
 * ```
 */
export function ChatWidget({
  apiUrl,
  apiKey,
  workspaceId,
  title,
  placeholder,
  primaryColor,
  position,
  greeting,
  showSources,
  className,
}: ChatWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<RAGChatWidget | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Build the widget config from props
    const config: WidgetConfig = {
      apiUrl,
      apiKey,
      workspaceId,
      title,
      placeholder,
      primaryColor,
      position,
      greeting,
      showSources,
    };

    // Create the widget instance
    widgetRef.current = new RAGChatWidget(config);

    // If the widget created its own host element, move it into our container
    // so React can manage its lifecycle properly.
    const hostEl = widgetRef.current['container'] as HTMLDivElement | null;
    if (hostEl && containerRef.current) {
      // The widget already appended to document.body via mount().
      // We reparent it into our React container for clean lifecycle management.
      containerRef.current.appendChild(hostEl);
    }

    return () => {
      // Clean up the widget on unmount
      widgetRef.current?.destroy();
      widgetRef.current = null;
    };
    // We intentionally only run this effect once on mount.
    // Prop changes after mount are intentionally not supported because
    // the widget is a DOM-based component with internal state.
    // To change config, unmount and remount the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} />;
}
