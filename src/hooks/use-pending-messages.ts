'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnectivity } from '@/hooks/use-connectivity';

export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'queued';

export interface PendingMessage {
  id: string;
  content: string;
  status: MessageStatus;
  createdAt: Date;
  error?: string;
}

/**
 * Hook for managing optimistic/pending messages in chat
 * Tracks messages that are queued, sending, or failed
 */
export function usePendingMessages(conversationId?: string) {
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const { isOffline } = useConnectivity();

  // Load from localStorage on mount
  useEffect(() => {
    const key = `pending-messages:${conversationId ?? 'global'}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PendingMessage[];
        setPending(
          parsed.map((m) => ({
            ...m,
            createdAt: new Date(m.createdAt),
            status: isOffline ? 'queued' : m.status,
          }))
        );
      } catch {
        // ignore corrupted storage
      }
    }
  }, [conversationId, isOffline]);

  // Persist to localStorage
  useEffect(() => {
    const key = `pending-messages:${conversationId ?? 'global'}`;
    if (pending.length > 0) {
      localStorage.setItem(key, JSON.stringify(pending));
    } else {
      localStorage.removeItem(key);
    }
  }, [pending, conversationId]);

  const addPending = useCallback(
    (content: string): PendingMessage => {
      const message: PendingMessage = {
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        content,
        status: isOffline ? 'queued' : 'sending',
        createdAt: new Date(),
      };
      setPending((prev) => [...prev, message]);
      return message;
    },
    [isOffline]
  );

  const markSent = useCallback((id: string) => {
    setPending((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const markFailed = useCallback((id: string, error?: string) => {
    setPending((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'failed' as const, error } : m))
    );
  }, []);

  const markSending = useCallback((id: string) => {
    setPending((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'sending' as const } : m)));
  }, []);

  const retry = useCallback((id: string) => {
    setPending((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'sending' as const, error: undefined } : m))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setPending((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clear = useCallback(() => {
    setPending([]);
  }, []);

  return {
    pending,
    addPending,
    markSent,
    markFailed,
    markSending,
    retry,
    remove,
    clear,
  };
}
