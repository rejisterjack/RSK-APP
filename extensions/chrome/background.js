// Background Service Worker — RAG Knowledge Assistant (Manifest V3)

const API_BASE_URL = 'https://rag-starter-kit.vercel.app'; // Configurable

// ─── Context Menus ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rag-ask',
    title: 'Ask RAG about this',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'rag-save-page',
    title: 'Save page to knowledge base',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'rag-summarize',
    title: 'Summarize with RAG',
    contexts: ['page'],
  });
});

// ─── Context Menu Handler ────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'rag-ask':
      openSidePanelWithQuery(info.selectionText);
      break;
    case 'rag-save-page':
      savePageToRAG(tab.url, tab.title);
      break;
    case 'rag-summarize':
      summarizePage(tab.url, tab.title);
      break;
  }
});

// ─── Keyboard Commands ───────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open_side_panel') {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  } else if (command === 'quick_ask') {
    getSelectedText().then((text) => {
      if (text) {
        openSidePanelWithQuery(text);
      }
    });
  }
});

// ─── Message Handler (from popup and content scripts) ────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openSidePanel':
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      sendResponse({ ok: true });
      break;

    case 'savePage':
      savePageToRAG(request.url, request.title)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true; // async

    case 'askSelection':
      openSidePanelWithQuery(request.text);
      sendResponse({ ok: true });
      break;

    case 'summarize':
      summarizePage(request.url, request.title);
      sendResponse({ ok: true });
      break;

    case 'getPageContent':
      if (sender.tab) {
        getPageContent(sender.tab.id).then(sendResponse);
        return true; // async
      }
      break;
  }
});

// ─── Side Panel ──────────────────────────────────────────────────────────────

async function openSidePanelWithQuery(query) {
  await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });

  // Small delay to let the side panel load before sending the query
  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: 'setQuery',
      query: query,
    });
  }, 200);
}

// ─── Selected Text ───────────────────────────────────────────────────────────

async function getSelectedText() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return null;

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => window.getSelection().toString(),
  });

  return results[0]?.result;
}

// ─── Save Page ───────────────────────────────────────────────────────────────

async function savePageToRAG(url, title) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify({
        type: 'url',
        url: url,
        metadata: {
          title: title,
          source: 'chrome-extension',
        },
      }),
    });

    if (response.ok) {
      showNotification('Page saved', `Saved "${title}" to your knowledge base.`);
    } else {
      const body = await response.text().catch(() => '');
      console.error('Save failed:', response.status, body);
      showNotification('Save failed', `Could not save "${title}" (${response.status}).`);
    }
  } catch (error) {
    console.error('Failed to save page:', error);
    showNotification('Save failed', 'Could not reach the RAG server.');
  }
}

// ─── Summarize ───────────────────────────────────────────────────────────────

function summarizePage(url, title) {
  openSidePanelWithQuery(`Summarize this page: ${url}\n\nTitle: ${title}`);
}

// ─── Auth Token ──────────────────────────────────────────────────────────────

async function getAuthToken() {
  const result = await chrome.storage.local.get(['authToken']);
  return result.authToken;
}

// ─── Notifications ───────────────────────────────────────────────────────────

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
  });
}

// ─── Page Content Extraction ─────────────────────────────────────────────────

async function getPageContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title,
      url: window.location.href,
      content: document.body.innerText.slice(0, 50000),
    }),
  });

  return results[0]?.result;
}

console.log('RAG Knowledge Assistant — background service worker loaded');
