'use client';

import { useCallback, useEffect } from 'react';

interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const { onEscape, onArrowUp, onArrowDown, onEnter, enabled = true } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore events from input/textarea unless it's Escape
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        case 'ArrowUp':
          if (!isInput) {
            e.preventDefault();
            onArrowUp?.();
          }
          break;
        case 'ArrowDown':
          if (!isInput) {
            e.preventDefault();
            onArrowDown?.();
          }
          break;
        case 'Enter':
          if (!isInput) {
            e.preventDefault();
            onEnter?.();
          }
          break;
      }
    },
    [enabled, onEscape, onArrowUp, onArrowDown, onEnter]
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
