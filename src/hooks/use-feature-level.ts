'use client';

import { useCallback, useEffect, useState } from 'react';

export type FeatureLevel = 0 | 1 | 2;

const MESSAGE_COUNT_KEY = 'rag-message-count';
const MANUAL_UNLOCK_KEY = 'rag-advanced-unlocked';

// Level 0: Full chat + model picker + agent mode
// Level 1: Unlocked by default (same as 0 now)
// Level 2: Advanced agent settings + all features (10+ messages or manual unlock)
const LEVEL_THRESHOLDS: [number, number][] = [
  [0, 1],
  [10, 2],
];

function getStoredMessageCount(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(MESSAGE_COUNT_KEY);
  return raw ? Number.parseInt(raw, 10) : 0;
}

function getManualUnlock(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MANUAL_UNLOCK_KEY) === 'true';
}

function calculateLevel(messageCount: number, manualUnlock: boolean): FeatureLevel {
  if (manualUnlock) return 2;

  let level: FeatureLevel = 0;
  for (const [threshold, lvl] of LEVEL_THRESHOLDS) {
    if (messageCount >= threshold) {
      level = lvl as FeatureLevel;
    }
  }
  return level;
}

export function useFeatureLevel(): {
  level: FeatureLevel;
  messageCount: number;
  recordMessage: () => void;
  unlockAdvanced: () => void;
  isFeatureVisible: (minLevel: FeatureLevel) => boolean;
} {
  const [level, setLevel] = useState<FeatureLevel>(0);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const count = getStoredMessageCount();
    const manual = getManualUnlock();
    setMessageCount(count);
    setLevel(calculateLevel(count, manual));
  }, []);

  const recordMessage = useCallback(() => {
    const newCount = getStoredMessageCount() + 1;
    localStorage.setItem(MESSAGE_COUNT_KEY, String(newCount));
    setMessageCount(newCount);
    setLevel(calculateLevel(newCount, getManualUnlock()));
  }, []);

  const unlockAdvanced = useCallback(() => {
    localStorage.setItem(MANUAL_UNLOCK_KEY, 'true');
    setLevel(2);
  }, []);

  const isFeatureVisible = useCallback((minLevel: FeatureLevel) => level >= minLevel, [level]);

  return { level, messageCount, recordMessage, unlockAdvanced, isFeatureVisible };
}
