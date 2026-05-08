import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger before importing the hook
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useLocalStorage } from '@/hooks/use-local-storage';

describe('useLocalStorage', () => {
  let localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    localStorageStore = {};
    // Provide a full localStorage implementation
    const storage = {
      getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),
      clear: vi.fn(() => {
        localStorageStore = {};
      }),
      get length() {
        return Object.keys(localStorageStore).length;
      },
      key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
    };
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return default value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('should read existing value from localStorage', () => {
    localStorageStore['test-key'] = JSON.stringify('stored-value');

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    act(() => {
      result.current[1]('new-value');
    });

    expect(result.current[0]).toBe('new-value');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
  });

  it('should handle function updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 0));

    act(() => {
      result.current[1]((prev) => prev + 1);
    });

    expect(result.current[0]).toBe(1);
  });

  it('should handle complex objects', () => {
    const defaultValue = { name: 'John', age: 30 };
    const { result } = renderHook(() => useLocalStorage('user', defaultValue));

    expect(result.current[0]).toEqual(defaultValue);

    act(() => {
      result.current[1]({ name: 'Jane', age: 25 });
    });

    expect(result.current[0]).toEqual({ name: 'Jane', age: 25 });
  });

  it('should handle localStorage errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Override setItem to throw
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new Error('Storage full');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    act(() => {
      result.current[1]('new-value');
    });

    // Should still update state even if localStorage fails
    expect(result.current[0]).toBe('new-value');

    consoleSpy.mockRestore();
    localStorage.setItem = originalSetItem;
  });

  it('should handle invalid JSON in localStorage', () => {
    localStorageStore['test-key'] = 'invalid-json';

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    // Should fall back to default value
    expect(result.current[0]).toBe('default');

    consoleSpy.mockRestore();
  });

  it('should remove item when set to undefined', () => {
    localStorageStore['test-key'] = JSON.stringify('value');

    const { result } = renderHook(() => useLocalStorage<string | undefined>('test-key', 'default'));

    act(() => {
      result.current[1](undefined);
    });

    expect(localStorage.getItem('test-key')).toBeNull();
  });
});
