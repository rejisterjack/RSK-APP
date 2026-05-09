/**
 * Persistent draft storage using IndexedDB
 * Auto-saves message drafts per conversation so users never lose
 * partially-typed messages, especially when going offline.
 */

import { preferences } from '@/lib/offline/indexed-db';

export interface DraftEntry {
  conversationId: string | 'global';
  content: string;
  files: string[]; // serialized file metadata
  updatedAt: number;
}

/**
 * Save a draft for a given conversation
 */
export async function saveDraft(
  conversationId: string | 'global',
  content: string,
  files: string[] = []
): Promise<void> {
  const entry: DraftEntry = {
    conversationId,
    content,
    files,
    updatedAt: Date.now(),
  };

  await preferences.set(`draft:${conversationId}`, entry);
}

/**
 * Load a draft for a given conversation
 */
export async function loadDraft(conversationId: string | 'global'): Promise<DraftEntry | null> {
  try {
    const result = await preferences.get<DraftEntry>(`draft:${conversationId}`);
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a draft after successful send
 */
export async function deleteDraft(conversationId: string | 'global'): Promise<void> {
  try {
    await preferences.delete(`draft:${conversationId}`);
  } catch {
    // silently fail
  }
}

/**
 * Auto-save helper with debounce
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function autoSaveDraft(
  conversationId: string | 'global',
  content: string,
  files: string[] = [],
  delay = 500
): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    void saveDraft(conversationId, content, files);
  }, delay);
}
