'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseAsyncActionOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseAsyncActionReturn<TArgs extends unknown[]> {
  execute: (...args: TArgs) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

export function useAsyncAction<TArgs extends unknown[] = []>(
  action: (...args: TArgs) => Promise<void>,
  options: UseAsyncActionOptions = {}
): UseAsyncActionReturn<TArgs> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: TArgs) => {
      setIsLoading(true);
      setError(null);

      try {
        await action(...args);
        if (!isMounted.current) return;

        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        options.onSuccess?.();
      } catch (err) {
        if (!isMounted.current) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        if (options.errorMessage) {
          toast.error(options.errorMessage);
        }
        options.onError?.(error);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return { execute, isLoading, error, reset };
}
