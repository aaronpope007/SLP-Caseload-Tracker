import { useState, useCallback, useRef, useEffect } from 'react';

interface AsyncOperationState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

interface AsyncOperationReturn<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  execute: (operation: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  setError: (error: string | null) => void;
}

/**
 * Hook for managing async operations with loading, error, and data states
 * 
 * @example
 * const { loading, error, data, execute } = useAsyncOperation<Student[]>();
 * 
 * const loadStudents = async () => {
 *   await execute(async () => {
 *     return await getStudents(school);
 *   });
 * };
 */
export const useAsyncOperation = <T = unknown>(): AsyncOperationReturn<T> => {
  const [state, setState] = useState<AsyncOperationState<T>>({
    loading: false,
    error: null,
    data: null,
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async (operation: () => Promise<T>): Promise<T | null> => {
    if (!isMountedRef.current) return null;
    setState({ loading: true, error: null, data: null });
    try {
      const result = await operation();
      if (!isMountedRef.current) return null;
      setState({ loading: false, error: null, data: result });
      return result;
    } catch (err) {
      if (!isMountedRef.current) return null;
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setState({ loading: false, error: errorMessage, data: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;
    setState({ loading: false, error: null, data: null });
  }, []);

  const setError = useCallback((error: string | null) => {
    if (!isMountedRef.current) return;
    setState((prev) => ({ ...prev, error }));
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    execute,
    reset,
    setError,
  };
};

