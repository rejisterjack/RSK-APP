// Side Panel Controller — RAG Knowledge Assistant

(function () {
  'use strict';

  var chatArea = document.getElementById('chat-area');
  var emptyState = document.getElementById('empty-state');
  var queryInput = document.getElementById('query-input');
  var sendBtn = document.getElementById('send-btn');

  // --- Config ---
  var DEFAULT_API_URL = 'https://rag-starter-kit.vercel.app';
  var apiUrl = DEFAULT_API_URL;

  // --- Init ---
  async function init() {
    var data = await chrome.storage.local.get(['apiUrl']);
    apiUrl = data.apiUrl || DEFAULT_API_URL;

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(function (request) {
      if (request.action === 'setQuery') {
       setQuery(request.query);
      }
    });
  }

  // --- Helpers ---
  function setQuery(text) {
    queryInput.value = text;
    queryInput.focus();
  }

  function addMessage(text, role) {
    if (emptyState) {
      emptyState.remove();
      emptyState = null;
    }

    var div = document.createElement('div');
    div.className = 'message message--' + role;
    div.textContent = text;
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
    return div;
  }

  function setLoading(loading) {
    sendBtn.disabled = loading;
    sendBtn.textContent = loading ? 'Sending...' : 'Send';
  }

  // --- Send Query ---
  async function sendQuery() {
    var query = queryInput.value.trim();
    if (!query) return;

    queryInput.value = '';
    addMessage(query, 'user');
    setLoading(true);

    try {
      var token = await getAuthToken();
      var response = await fetch(apiUrl + '/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({ message: query }),
      });

      if (!response.ok) {
        throw new Error('Server returned ' + response.status);
      }

      var data = await response.json();
      var reply = data.reply || data.message || data.content || JSON.stringify(data);
      addMessage(reply, 'assistant');
    } catch (err) {
      addMessage('Error: ' + err.message, 'system');
    } finally {
      setLoading(false);
      queryInput.focus();
    }
  }

  async function getAuthToken() {
    var result = await chrome.storage.local.get(['authToken']);
    return result.authToken;
  }

  // --- Events ---
  sendBtn.addEventListener('click', sendQuery);

  queryInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  });

  init();
})();
