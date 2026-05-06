/**
 * Generates CSS styles for the chat widget, parameterized by primaryColor.
 * Returns a complete stylesheet string to be injected into Shadow DOM.
 */
export function generateStyles(primaryColor: string): string {
  // Derive color variants from the primary color
  const primaryHover = lightenColor(primaryColor, 15);
  const primaryLight = lightenColor(primaryColor, 85);
  const primaryMuted = lightenColor(primaryColor, 70);

  return `
    /* ======================================================================== */
    /* RAG Chat Widget Styles                                                    */
    /* ======================================================================== */

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :host {
      --ragwk-primary: ${primaryColor};
      --ragwk-primary-hover: ${primaryHover};
      --ragwk-primary-light: ${primaryLight};
      --ragwk-primary-muted: ${primaryMuted};
      --ragwk-bg: #ffffff;
      --ragwk-bg-secondary: #f9fafb;
      --ragwk-text: #111827;
      --ragwk-text-secondary: #6b7280;
      --ragwk-border: #e5e7eb;
      --ragwk-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1);
      --ragwk-radius: 16px;
      --ragwk-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-family: var(--ragwk-font);
    }

    /* Container */
    .ragwk-container {
      position: fixed;
      bottom: 24px;
      z-index: 99999;
      font-family: var(--ragwk-font);
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .ragwk-container.ragwk-bottom-right {
      right: 24px;
    }

    .ragwk-container.ragwk-bottom-left {
      left: 24px;
    }

    /* Floating toggle button */
    .ragwk-toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--ragwk-primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
      position: relative;
      z-index: 1;
      outline: none;
    }

    .ragwk-toggle:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .ragwk-toggle:active {
      transform: scale(0.95);
    }

    .ragwk-toggle:focus-visible {
      box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.4), 0 4px 14px rgba(0, 0, 0, 0.25);
    }

    .ragwk-toggle svg {
      width: 28px;
      height: 28px;
      color: #ffffff;
      transition: transform 0.3s ease;
    }

    .ragwk-toggle.ragwk-open svg {
      transform: rotate(90deg);
    }

    /* Notification badge on toggle */
    .ragwk-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ef4444;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
      opacity: 0;
      transform: scale(0);
      transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .ragwk-badge.ragwk-visible {
      opacity: 1;
      transform: scale(1);
    }

    /* Chat panel */
    .ragwk-panel {
      position: absolute;
      bottom: 72px;
      width: 400px;
      max-width: calc(100vw - 48px);
      height: 600px;
      max-height: calc(100vh - 120px);
      border-radius: var(--ragwk-radius);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: var(--ragwk-bg);
      box-shadow: var(--ragwk-shadow);
      border: 1px solid var(--ragwk-border);
      opacity: 0;
      visibility: hidden;
      transform: translateY(16px) scale(0.95);
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), visibility 0.25s ease;
      pointer-events: none;
    }

    .ragwk-bottom-right .ragwk-panel {
      right: 0;
    }

    .ragwk-bottom-left .ragwk-panel {
      left: 0;
    }

    .ragwk-panel.ragwk-open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    .ragwk-header {
      background: var(--ragwk-primary);
      color: #ffffff;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      position: relative;
    }

    .ragwk-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    }

    .ragwk-header-title {
      font-size: 16px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ragwk-header-title svg {
      width: 20px;
      height: 20px;
      opacity: 0.9;
    }

    .ragwk-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .ragwk-header-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      color: #ffffff;
      transition: background-color 0.15s ease;
      outline: none;
    }

    .ragwk-header-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    .ragwk-header-btn:focus-visible {
      box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
    }

    .ragwk-header-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Messages area */
    .ragwk-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      background: var(--ragwk-bg-secondary);
      scroll-behavior: smooth;
    }

    /* Custom scrollbar */
    .ragwk-messages::-webkit-scrollbar {
      width: 6px;
    }

    .ragwk-messages::-webkit-scrollbar-track {
      background: transparent;
    }

    .ragwk-messages::-webkit-scrollbar-thumb {
      background: var(--ragwk-border);
      border-radius: 3px;
    }

    .ragwk-messages::-webkit-scrollbar-thumb:hover {
      background: #d1d5db;
    }

    /* Message row */
    .ragwk-message {
      display: flex;
      margin-bottom: 16px;
      gap: 10px;
      animation: ragwk-fade-in 0.3s ease;
    }

    @keyframes ragwk-fade-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .ragwk-message-user {
      justify-content: flex-end;
    }

    .ragwk-message-assistant {
      justify-content: flex-start;
    }

    /* Avatar */
    .ragwk-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ragwk-avatar svg {
      width: 18px;
      height: 18px;
    }

    .ragwk-avatar-user {
      background: var(--ragwk-primary);
      color: #ffffff;
    }

    .ragwk-avatar-assistant {
      background: var(--ragwk-primary-light);
      color: var(--ragwk-primary);
    }

    /* Message bubble */
    .ragwk-bubble {
      max-width: 78%;
      padding: 10px 14px;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
      white-space: pre-wrap;
    }

    .ragwk-bubble-user {
      background: var(--ragwk-primary);
      color: #ffffff;
      border-radius: 18px 18px 4px 18px;
    }

    .ragwk-bubble-assistant {
      background: #ffffff;
      color: var(--ragwk-text);
      border-radius: 18px 18px 18px 4px;
      border: 1px solid var(--ragwk-border);
    }

    /* Typing indicator */
    .ragwk-typing {
      display: flex;
      gap: 5px;
      padding: 4px 0;
    }

    .ragwk-typing-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ragwk-text-secondary);
      animation: ragwk-typing-bounce 1.4s infinite ease-in-out both;
    }

    .ragwk-typing-dot:nth-child(1) { animation-delay: 0s; }
    .ragwk-typing-dot:nth-child(2) { animation-delay: 0.16s; }
    .ragwk-typing-dot:nth-child(3) { animation-delay: 0.32s; }

    @keyframes ragwk-typing-bounce {
      0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Source citations */
    .ragwk-sources {
      margin-top: 8px;
      border-top: 1px solid var(--ragwk-border);
      padding-top: 8px;
    }

    .ragwk-sources-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--ragwk-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }

    .ragwk-source {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 6px 8px;
      border-radius: 8px;
      background: var(--ragwk-bg-secondary);
      margin-bottom: 4px;
      font-size: 12px;
      color: var(--ragwk-text);
      cursor: default;
      transition: background-color 0.15s ease;
    }

    .ragwk-source:hover {
      background: var(--ragwk-primary-light);
    }

    .ragwk-source-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      color: var(--ragwk-primary);
      margin-top: 1px;
    }

    .ragwk-source-name {
      font-weight: 500;
    }

    .ragwk-source-page {
      color: var(--ragwk-text-secondary);
      font-size: 11px;
    }

    .ragwk-source-snippet {
      color: var(--ragwk-text-secondary);
      font-size: 11px;
      line-height: 1.4;
      margin-top: 2px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    /* Greeting */
    .ragwk-greeting {
      animation: ragwk-fade-in 0.4s ease 0.1s both;
    }

    /* Error message */
    .ragwk-error {
      background: #fef2f2;
      color: #991b1b;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px;
      border: 1px solid #fecaca;
      margin: 4px 0;
    }

    /* Input area */
    .ragwk-input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--ragwk-border);
      display: flex;
      gap: 8px;
      align-items: center;
      background: var(--ragwk-bg);
      flex-shrink: 0;
    }

    .ragwk-input {
      flex: 1;
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid var(--ragwk-border);
      background: var(--ragwk-bg-secondary);
      color: var(--ragwk-text);
      font-size: 14px;
      font-family: var(--ragwk-font);
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .ragwk-input::placeholder {
      color: var(--ragwk-text-secondary);
    }

    .ragwk-input:focus {
      border-color: var(--ragwk-primary);
      box-shadow: 0 0 0 3px var(--ragwk-primary-muted);
    }

    .ragwk-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .ragwk-send {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--ragwk-primary);
      color: #ffffff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background-color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
      outline: none;
    }

    .ragwk-send:hover:not(:disabled) {
      background: var(--ragwk-primary-hover);
    }

    .ragwk-send:active:not(:disabled) {
      transform: scale(0.95);
    }

    .ragwk-send:focus-visible {
      box-shadow: 0 0 0 3px var(--ragwk-primary-muted);
    }

    .ragwk-send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .ragwk-send svg {
      width: 18px;
      height: 18px;
    }

    /* Footer */
    .ragwk-footer {
      text-align: center;
      font-size: 11px;
      color: var(--ragwk-text-secondary);
      padding: 4px 16px 8px;
      background: var(--ragwk-bg);
      flex-shrink: 0;
    }

    /* Empty state */
    .ragwk-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 20px;
      text-align: center;
    }

    .ragwk-empty-icon {
      width: 48px;
      height: 48px;
      color: var(--ragwk-primary-muted);
      margin-bottom: 12px;
    }

    .ragwk-empty-text {
      font-size: 14px;
      color: var(--ragwk-text-secondary);
    }

    /* Responsive: full screen on small devices */
    @media (max-width: 480px) {
      .ragwk-container {
        bottom: 0;
        left: 0;
        right: 0;
      }

      .ragwk-container.ragwk-bottom-right,
      .ragwk-container.ragwk-bottom-left {
        left: 0;
        right: 0;
      }

      .ragwk-panel {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
        height: 100vh;
        max-height: 100vh;
        border-radius: 0;
        border: none;
      }

      .ragwk-toggle {
        position: fixed;
        bottom: 16px;
        right: 16px;
      }
    }
  `;
}

/**
 * Lighten a hex color by a given percentage (0-100).
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, ((num >> 16) & 0xff) + amt);
  const G = Math.min(255, ((num >> 8) & 0xff) + amt);
  const B = Math.min(255, (num & 0xff) + amt);
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}
