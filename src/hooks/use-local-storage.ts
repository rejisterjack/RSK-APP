/**
 * useLocalStorage Hook
 *
 * A simple React hook for persisting state in localStorage.
 * Provides a useState-like API with automatic serialization/deserialization.
 */

import { useCallback, useRef, useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Use a ref to track the current value for function updates
  const valueRef = useRef<T>(initialValue);

  // Initialize state from localStorage or use default
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      const parsed = JSON.parse(item) as T;
      valueRef.current = parsed;
      return parsed;
    } catch {
      return initialValue;
    }
  });

  // Update localStorage and state
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      const valueToStore = value instanceof Function ? value(valueRef.current) : value;

      // Persist to localStorage (with error handling)
      try {
        if (typeof window !== 'undefined') {
          if (valueToStore === undefined) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
        }
      } catch {
        // localStorage may be unavailable (e.g., private browsing)
      }

      // Update React state and ref
      valueRef.current = valueToStore;
      setStoredValue(valueToStore);
    },
    [key]
  );

  return [storedValue, setValue];
}
