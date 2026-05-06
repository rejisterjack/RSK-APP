# Chrome Web Store Listing Draft

## Title

RAG Knowledge Assistant

## Short Description (132 characters max)

Save web pages to your knowledge base, ask questions about any content, and get AI-powered summaries -- all from your browser.

## Detailed Description

RAG Knowledge Assistant connects your browser to a Retrieval-Augmented Generation (RAG) knowledge base, letting you interact with your documents and the web in powerful new ways.

**Core Features:**

- **Save any web page** -- Right-click on any page to instantly ingest it into your knowledge base. The page content is indexed and made searchable for future queries.

- **Ask about selected text** -- Highlight any text on a page, right-click, and choose "Ask RAG about this" to get an AI-generated answer grounded in your knowledge base.

- **Summarize pages** -- Generate concise summaries of any web page using your RAG-powered assistant.

- **Side panel chat** -- Open a persistent chat panel docked to the right side of your browser. Ask questions, get answers, and continue the conversation without leaving your current tab.

- **Keyboard shortcuts** -- Access every feature quickly: open the popup (Ctrl+Shift+K), open the side panel (Ctrl+Shift+L), or quick-ask about selected text (Ctrl+Shift+A).

**How it works:**

1. Set up your RAG backend (or use the default hosted instance).
2. Browse the web normally. When you find a useful page, save it to your knowledge base with one click.
3. Ask questions about any page or selected text. The assistant retrieves relevant documents from your knowledge base and generates grounded answers.

**Privacy:**

- No browsing history is collected.
- The extension only communicates with the backend URL you configure.
- No data is sent to third-party analytics or advertising services.
- All page content and queries are processed solely by your RAG backend.

**Permissions explained:**

- activeTab -- reads the current page URL and title for saving/summarizing
- storage -- saves your preferences locally
- contextMenus -- adds right-click menu items
- sidePanel -- opens the docked chat panel
- scripting -- extracts page content and selected text for queries
- notifications -- shows save confirmations and error alerts

This extension requires a compatible RAG backend. It works with the open-source RAG Starter Kit or any compatible API endpoint.

## Category

Developer Tools

## Language

English

## Search Keywords (comma-separated, max 100 characters each)

RAG, knowledge base, AI assistant, web clipper, page summarizer, document search, retrieval augmented generation, chat, productivity

## Screenshots Needed

Prepare the following screenshots (1280x800 or 640x400, PNG or JPEG):

1. **Popup panel** -- Show the popup with connection status, action buttons, and settings toggles.
2. **Side panel chat** -- Show the side panel with a sample conversation.
3. **Context menu** -- Show the right-click menu with "Ask RAG about this", "Save page", and "Summarize" options.
4. **Save confirmation** -- Show the Chrome notification after saving a page.
5. **Settings toggles** -- Close-up of the Side Panel and Auto-save toggle switches.

## Small Promotional Tile (440x280)

Show the extension icon with the tagline "Your AI knowledge base, right in your browser."

## Marquee Promotional Tile (1400x560)

Show a wide screenshot of the side panel open alongside a web page, with the popup visible.

## Privacy Policy URL

Point to your hosted privacy policy (e.g., https://your-domain.com/privacy).

## Single Purpose Description (required for review)

This extension provides a browser interface to a user-configured RAG (Retrie-Augmented Generation) knowledge base. It allows users to save web pages to their knowledge base, ask questions about selected text, and generate page summaries through a side panel or popup interface.
