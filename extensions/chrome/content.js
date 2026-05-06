// Content Script — RAG Knowledge Assistant
// Injected into all pages to support selection-based queries and page content extraction.

(function () {
  'use strict';

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'getPageContent':
        sendResponse(extractPageContent());
        return false; // synchronous

      case 'getSelectedText':
        sendResponse({ text: window.getSelection().toString().trim() });
        return false;

      case 'showOverlay':
        showNotificationOverlay(request.message, request.type || 'info');
        return false;
    }
  });

  // --- Page Content Extraction ---
  function extractPageContent() {
    const article = document.querySelector('article');
    const main = document.querySelector('main');
    const content = (article || main || document.body).innerText;

    return {
      title: document.title,
      url: window.location.href,
      description: getMetaContent('description'),
      content: content.slice(0, 100000),
      wordCount: content.split(/\s+/).length,
    };
  }

  function getMetaContent(name) {
    const el =
      document.querySelector('meta[name="' + name + '"]') ||
      document.querySelector('meta[property="og:' + name + '"]');
    return el ? el.getAttribute('content') : '';
  }

  // --- Notification Overlay ---
  function showNotificationOverlay(message, type) {
    const existing = document.getElementById('rag-notification-overlay');
    if (existing) existing.remove();

    var icons = { success: '✅', error: '❌', info: 'ℹ️' };
    var iconText = icons[type] || icons.info;

    var overlay = document.createElement('div');
    overlay.id = 'rag-notification-overlay';
    overlay.className = 'rag-notification rag-notification--' + type;

    var contentDiv = document.createElement('div');
    contentDiv.className = 'rag-notification__content';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'rag-notification__icon';
    iconSpan.textContent = iconText;

    var msgSpan = document.createElement('span');
    msgSpan.className = 'rag-notification__message';
    msgSpan.textContent = message;

    contentDiv.appendChild(iconSpan);
    contentDiv.appendChild(msgSpan);
    overlay.appendChild(contentDiv);

    document.body.appendChild(overlay);

    requestAnimationFrame(function () {
      overlay.classList.add('rag-notification--visible');
    });

    setTimeout(function () {
      overlay.classList.remove('rag-notification--visible');
      setTimeout(function () {
        overlay.remove();
      }, 300);
    }, 3000);
  }

  // Listen for selection changes
  document.addEventListener('mouseup', function () {
    var selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
      chrome.runtime
        .sendMessage({
          action: 'selectionChanged',
          text: selection,
          length: selection.length,
        })
        .catch(function () {
          // Extension context may be invalidated; ignore
        });
    }
  });
})();
