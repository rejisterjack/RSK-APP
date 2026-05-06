import { ApiClient } from './api';
import { generateStyles } from './styles';
import type {
  ChatMessage,
  Citation,
  ResolvedConfig,
  WidgetConfig,
  WidgetEventCallback,
  WidgetEventType,
} from './types';

/**
 * RAGChatWidget - A floating chat widget that can be embedded on any website.
 *
 * Creates a floating chat bubble that expands into a full chat interface
 * with streaming responses, source citations, and Shadow DOM isolation.
 *
 * @example
 * ```ts
 * const widget = new RAGChatWidget({
 *   apiUrl: 'https://your-app.vercel.app',
 *   apiKey: 'your-api-key',
 * });
 * ```
 */
export class RAGChatWidget {
  private config: ResolvedConfig;
  private apiClient: ApiClient;
  private container: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private messages: ChatMessage[] = [];
  private isOpen = false;
  private isLoading = false;
  private abortController: AbortController | null = null;
  private listeners = new Map<WidgetEventType, Set<WidgetEventCallback>>();
  private messageIdCounter = 0;

  constructor(config: WidgetConfig) {
    this.config = this.resolveConfig(config);
    this.apiClient = new ApiClient(config);
    this.mount();
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /** Open the chat panel. */
  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.updateToggleState();
    this.showPanel();
    this.emit('open');
    this.focusInput();
  }

  /** Close the chat panel. */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.updateToggleState();
    this.hidePanel();
    this.emit('close');
  }

  /** Toggle the chat panel open/closed. */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Destroy the widget and remove it from the DOM. */
  destroy(): void {
    this.abortController?.abort();
    this.container?.remove();
    this.container = null;
    this.shadow = null;
    this.listeners.clear();
    this.emit('destroy');
  }

  /** Subscribe to widget events. Returns an unsubscribe function. */
  on(event: WidgetEventType, callback: WidgetEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  // ===========================================================================
  // Static convenience method
  // ===========================================================================

  /**
   * Initialize a widget and attach it to the page.
   * Convenience static method for script-tag usage.
   *
   * @example
   * ```html
   * <script>
   *   RAGChatWidget.init({ apiUrl: 'https://your-app.vercel.app', apiKey: '...' });
   * </script>
   * ```
   */
  static init(config: WidgetConfig): RAGChatWidget {
    return new RAGChatWidget(config);
  }

  // ===========================================================================
  // Mounting & DOM Construction
  // ===========================================================================

  private resolveConfig(config: WidgetConfig): ResolvedConfig {
    return {
      apiUrl: config.apiUrl.replace(/\/+$/, ''),
      apiKey: config.apiKey ?? '',
      workspaceId: config.workspaceId ?? '',
      title: config.title ?? 'Chat',
      placeholder: config.placeholder ?? 'Ask a question...',
      primaryColor: config.primaryColor ?? '#7c3aed',
      position: config.position ?? 'bottom-right',
      greeting: config.greeting ?? 'Hi! How can I help you today?',
      showSources: config.showSources ?? true,
    };
  }

  private mount(): void {
    this.container = document.createElement('div');
    this.container.className = 'ragwk-host';

    this.shadow = this.container.attachShadow({ mode: 'open' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = generateStyles(this.config.primaryColor);
    this.shadow.appendChild(styleEl);

    // Build widget DOM using safe DOM APIs
    const wrapper = this.buildDOM();
    this.shadow.appendChild(wrapper);

    document.body.appendChild(this.container);

    // Bind events after DOM is attached
    this.bindEvents(wrapper);
  }

  /**
   * Build the entire widget DOM tree using safe createElement/appendChild calls.
   * No innerHTML is used for user-provided content.
   */
  private buildDOM(): HTMLDivElement {
    const wrapper = document.createElement('div');
    wrapper.className = `ragwk-container ragwk-${this.config.position}`;

    // --- Chat panel ---
    const panel = document.createElement('div');
    panel.className = 'ragwk-panel';
    panel.setAttribute('part', 'panel');

    // Header
    const header = document.createElement('div');
    header.className = 'ragwk-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'ragwk-header-title';
    titleDiv.appendChild(this.createSvgIcon('bot'));
    const titleText = document.createElement('span');
    titleText.className = 'ragwk-header-text';
    titleText.textContent = this.config.title;
    titleDiv.appendChild(titleText);

    const headerActions = document.createElement('div');
    headerActions.className = 'ragwk-header-actions';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ragwk-header-btn ragwk-close-btn';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.type = 'button';
    closeBtn.appendChild(this.createSvgIcon('close'));
    headerActions.appendChild(closeBtn);

    header.appendChild(titleDiv);
    header.appendChild(headerActions);

    // Messages area
    const messagesDiv = document.createElement('div');
    messagesDiv.className = 'ragwk-messages';
    const messagesInner = document.createElement('div');
    messagesInner.className = 'ragwk-messages-inner';
    messagesDiv.appendChild(messagesInner);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'ragwk-input-area';

    const input = document.createElement('input');
    input.className = 'ragwk-input';
    input.type = 'text';
    input.placeholder = this.config.placeholder;
    input.setAttribute('aria-label', 'Type your message');
    input.autocomplete = 'off';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'ragwk-send';
    sendBtn.type = 'button';
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.disabled = true;
    sendBtn.appendChild(this.createSvgIcon('send'));

    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'ragwk-footer';
    footer.textContent = 'Powered by RAG Starter Kit';

    panel.appendChild(header);
    panel.appendChild(messagesDiv);
    panel.appendChild(inputArea);
    panel.appendChild(footer);

    // --- Toggle bubble ---
    const toggle = document.createElement('button');
    toggle.className = 'ragwk-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Open chat');

    const badge = document.createElement('span');
    badge.className = 'ragwk-badge';

    const chatIcon = this.createSvgIcon('chat');
    chatIcon.classList.add('ragwk-icon-chat');

    const closeIcon = this.createSvgIcon('close');
    closeIcon.classList.add('ragwk-icon-close');
    closeIcon.style.display = 'none';
    closeIcon.style.position = 'absolute';

    toggle.appendChild(badge);
    toggle.appendChild(chatIcon);
    toggle.appendChild(closeIcon);

    wrapper.appendChild(panel);
    wrapper.appendChild(toggle);

    return wrapper;
  }

  private bindEvents(wrapper: HTMLDivElement): void {
    const toggle = wrapper.querySelector('.ragwk-toggle') as HTMLButtonElement;
    const closeBtn = wrapper.querySelector('.ragwk-close-btn') as HTMLButtonElement;
    const input = wrapper.querySelector('.ragwk-input') as HTMLInputElement;
    const sendBtn = wrapper.querySelector('.ragwk-send') as HTMLButtonElement;

    toggle.addEventListener('click', () => this.toggle());
    closeBtn.addEventListener('click', () => this.close());

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    input.addEventListener('input', () => {
      sendBtn.disabled = !input.value.trim() || this.isLoading;
    });

    sendBtn.addEventListener('click', () => this.handleSend());
  }

  // ===========================================================================
  // SVG Icon Factory
  // ===========================================================================

  private createSvgIcon(name: 'chat' | 'close' | 'send' | 'bot' | 'user' | 'doc'): SVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const paths: Record<string, string[]> = {
      chat: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
      close: ['M18 6 6 18', 'm6 6 12 12'],
      send: ['M5 12h14', 'm12 5 7 7-7 7'],
      bot: [
        'M12 8V4H8',
        '<rect width="16" height="12" x="4" y="8" rx="2"/>',
        'M2 14h2',
        'M20 14h2',
        'M15 13v2',
        'M9 13v2',
      ],
      user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', '<circle cx="12" cy="7" r="4"/>'],
      doc: [
        'M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z',
        '<polyline points="14 2 14 8 20 8"/>',
      ],
    };

    for (const d of paths[name] ?? []) {
      if (d.startsWith('<')) {
        // Handle <rect>, <circle>, <polyline> elements
        const temp = document.createElement('div');
        temp.textContent = null; // just for parsing
        const wrapper = document.createElement('div');
        wrapper.innerHTML = d;
        const el = wrapper.firstElementChild;
        if (el) {
          const imported = document.createElementNS(ns, el.tagName.toLowerCase());
          for (const attr of Array.from(el.attributes)) {
            imported.setAttribute(attr.name, attr.value);
          }
          svg.appendChild(imported);
        }
      } else {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      }
    }

    return svg;
  }

  // ===========================================================================
  // Panel State
  // ===========================================================================

  private showPanel(): void {
    const panel = this.$panel();
    if (!panel) return;
    panel.classList.add('ragwk-open');

    if (this.messages.length === 0) {
      this.showGreeting();
    }

    requestAnimationFrame(() => this.scrollToBottom());
  }

  private hidePanel(): void {
    const panel = this.$panel();
    if (panel) panel.classList.remove('ragwk-open');
  }

  private updateToggleState(): void {
    if (!this.shadow) return;
    const toggle = this.shadow.querySelector('.ragwk-toggle') as HTMLButtonElement;
    const chatIcon = toggle?.querySelector('.ragwk-icon-chat') as SVGElement;
    const closeIcon = toggle?.querySelector('.ragwk-icon-close') as SVGElement;

    if (!toggle || !chatIcon || !closeIcon) return;

    if (this.isOpen) {
      toggle.classList.add('ragwk-open');
      toggle.setAttribute('aria-label', 'Close chat');
      chatIcon.style.display = 'none';
      closeIcon.style.display = 'block';
    } else {
      toggle.classList.remove('ragwk-open');
      toggle.setAttribute('aria-label', 'Open chat');
      chatIcon.style.display = 'block';
      closeIcon.style.display = 'none';
    }
  }

  private showGreeting(): void {
    const inner = this.$messagesInner();
    if (!inner) return;

    const el = document.createElement('div');
    el.className = 'ragwk-message ragwk-message-assistant ragwk-greeting';

    const avatar = document.createElement('div');
    avatar.className = 'ragwk-avatar ragwk-avatar-assistant';
    avatar.appendChild(this.createSvgIcon('bot'));

    const bubble = document.createElement('div');
    bubble.className = 'ragwk-bubble ragwk-bubble-assistant';
    bubble.textContent = this.config.greeting;

    el.appendChild(avatar);
    el.appendChild(bubble);
    inner.appendChild(el);
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private async handleSend(): Promise<void> {
    const input = this.$input();
    const sendBtn = this.$sendBtn();
    if (!input) return;

    const question = input.value.trim();
    if (!question || this.isLoading) return;

    input.value = '';
    if (sendBtn) sendBtn.disabled = true;

    // Clear greeting if present
    const greeting = this.shadow?.querySelector('.ragwk-greeting');
    if (greeting) greeting.remove();

    // Add user message
    const userMsg: ChatMessage = {
      id: this.nextId(),
      role: 'user',
      content: question,
    };
    this.messages.push(userMsg);
    this.renderMessage(userMsg);
    this.emit('message:sent', { content: question });

    // Add streaming assistant message
    const assistantMsg: ChatMessage = {
      id: this.nextId(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    this.messages.push(assistantMsg);
    this.renderMessage(assistantMsg);

    this.isLoading = true;
    this.updateInputState();

    this.abortController = new AbortController();
    const streamingContent = { value: '' };
    const msgId = assistantMsg.id;

    await this.apiClient.sendMessageStream(
      question,
      this.buildHistory(),
      {
        onToken: (token: string) => {
          streamingContent.value += token;
          this.updateStreamingMessage(msgId, streamingContent.value);
        },
        onSources: (sources: Citation[]) => {
          this.updateMessageSources(msgId, sources);
        },
        onDone: (fullText: string) => {
          this.finalizeMessage(msgId, fullText);
          this.isLoading = false;
          this.abortController = null;
          this.updateInputState();
          this.emit('message:received', { content: fullText });
        },
        onError: (error: Error) => {
          this.handleStreamError(msgId, error);
          this.isLoading = false;
          this.abortController = null;
          this.updateInputState();
          this.emit('error', { error: error.message });
        },
      },
      this.abortController.signal
    );
  }

  private buildHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.messages
      .filter((m) => !m.isStreaming && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  private handleStreamError(msgId: string, error: Error): void {
    const msgIdx = this.messages.findIndex((m) => m.id === msgId);
    if (msgIdx === -1) return;

    const msg = this.messages[msgIdx];
    if (!msg.content) {
      this.messages.splice(msgIdx, 1);
      const el = this.shadow?.querySelector(`[data-msg-id="${msgId}"]`);
      el?.remove();
    } else {
      msg.isStreaming = false;
      this.updateStreamingMessage(msgId, msg.content);
    }

    this.showError(error.message);
  }

  // ===========================================================================
  // DOM Rendering (safe DOM APIs only)
  // ===========================================================================

  private renderMessage(msg: ChatMessage): void {
    const inner = this.$messagesInner();
    if (!inner) return;

    const el = document.createElement('div');
    el.className = `ragwk-message ragwk-message-${msg.role}`;
    el.setAttribute('data-msg-id', msg.id);

    if (msg.role === 'user') {
      const bubble = document.createElement('div');
      bubble.className = 'ragwk-bubble ragwk-bubble-user';
      bubble.textContent = msg.content;

      const avatar = document.createElement('div');
      avatar.className = 'ragwk-avatar ragwk-avatar-user';
      avatar.appendChild(this.createSvgIcon('user'));

      el.appendChild(bubble);
      el.appendChild(avatar);
    } else {
      const avatar = document.createElement('div');
      avatar.className = 'ragwk-avatar ragwk-avatar-assistant';
      avatar.appendChild(this.createSvgIcon('bot'));

      const bubble = document.createElement('div');
      bubble.className = 'ragwk-bubble ragwk-bubble-assistant';

      const bubbleContent = document.createElement('div');
      bubbleContent.className = 'ragwk-bubble-content';

      if (msg.content) {
        bubbleContent.textContent = msg.content;
      } else {
        // Show typing indicator
        const typing = document.createElement('div');
        typing.className = 'ragwk-typing';
        for (let i = 0; i < 3; i++) {
          const dot = document.createElement('div');
          dot.className = 'ragwk-typing-dot';
          typing.appendChild(dot);
        }
        bubbleContent.appendChild(typing);
      }

      const sourcesContainer = document.createElement('div');
      sourcesContainer.className = 'ragwk-sources-container';

      bubble.appendChild(bubbleContent);
      bubble.appendChild(sourcesContainer);

      el.appendChild(avatar);
      el.appendChild(bubble);
    }

    inner.appendChild(el);
    this.scrollToBottom();
  }

  private updateStreamingMessage(msgId: string, content: string): void {
    const el = this.shadow?.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;

    const bubbleContent = el.querySelector('.ragwk-bubble-content');
    if (bubbleContent) {
      bubbleContent.textContent = content;
    }

    const msg = this.messages.find((m) => m.id === msgId);
    if (msg) msg.content = content;

    this.scrollToBottom();
  }

  private updateMessageSources(msgId: string, sources: Citation[]): void {
    if (!this.config.showSources || sources.length === 0) return;

    const el = this.shadow?.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;

    const container = el.querySelector('.ragwk-sources-container');
    if (!container) return;

    const msg = this.messages.find((m) => m.id === msgId);
    if (msg) msg.sources = sources;

    // Clear existing sources
    container.textContent = '';

    const sourcesEl = document.createElement('div');
    sourcesEl.className = 'ragwk-sources';

    const label = document.createElement('div');
    label.className = 'ragwk-sources-label';
    label.textContent = 'Sources';
    sourcesEl.appendChild(label);

    for (const s of sources) {
      const sourceDiv = document.createElement('div');
      sourceDiv.className = 'ragwk-source';

      const icon = this.createSvgIcon('doc');
      icon.classList.add('ragwk-source-icon');

      const infoDiv = document.createElement('div');

      const nameSpan = document.createElement('div');
      nameSpan.className = 'ragwk-source-name';
      nameSpan.textContent = s.documentName;
      infoDiv.appendChild(nameSpan);

      if (s.page) {
        const pageSpan = document.createElement('span');
        pageSpan.className = 'ragwk-source-page';
        pageSpan.textContent = `Page ${s.page}`;
        infoDiv.appendChild(pageSpan);
      }

      const snippet = document.createElement('div');
      snippet.className = 'ragwk-source-snippet';
      snippet.textContent = s.content;
      infoDiv.appendChild(snippet);

      sourceDiv.appendChild(icon);
      sourceDiv.appendChild(infoDiv);
      sourcesEl.appendChild(sourceDiv);
    }

    container.appendChild(sourcesEl);
    this.scrollToBottom();
  }

  private finalizeMessage(msgId: string, fullText: string): void {
    const msg = this.messages.find((m) => m.id === msgId);
    if (msg) {
      msg.content = fullText;
      msg.isStreaming = false;
    }
    this.updateStreamingMessage(msgId, fullText);
  }

  private showError(message: string): void {
    const inner = this.$messagesInner();
    if (!inner) return;

    const errorEl = document.createElement('div');
    errorEl.className = 'ragwk-error';
    errorEl.textContent = message;
    setTimeout(() => errorEl.remove(), 5000);
    inner.appendChild(errorEl);
    this.scrollToBottom();
  }

  private updateInputState(): void {
    const input = this.$input();
    const sendBtn = this.$sendBtn();
    if (!input || !sendBtn) return;
    input.disabled = this.isLoading;
    sendBtn.disabled = this.isLoading || !input.value.trim();
  }

  private focusInput(): void {
    requestAnimationFrame(() => {
      const input = this.$input();
      if (input) input.focus();
    });
  }

  private scrollToBottom(): void {
    const messagesArea = this.shadow?.querySelector('.ragwk-messages');
    if (messagesArea) {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }

  // ===========================================================================
  // Event Emitter
  // ===========================================================================

  private emit(event: WidgetEventType, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    for (const cb of callbacks) {
      try {
        cb(data);
      } catch {
        // Swallow errors in user callbacks to prevent breaking the widget
      }
    }
  }

  // ===========================================================================
  // DOM Helpers
  // ===========================================================================

  private $panel(): Element | null {
    return this.shadow?.querySelector('.ragwk-panel') ?? null;
  }

  private $messagesInner(): Element | null {
    return this.shadow?.querySelector('.ragwk-messages-inner') ?? null;
  }

  private $input(): HTMLInputElement | null {
    return (this.shadow?.querySelector('.ragwk-input') as HTMLInputElement) ?? null;
  }

  private $sendBtn(): HTMLButtonElement | null {
    return (this.shadow?.querySelector('.ragwk-send') as HTMLButtonElement) ?? null;
  }

  private nextId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
  }
}
