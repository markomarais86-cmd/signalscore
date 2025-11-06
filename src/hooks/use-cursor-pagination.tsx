import { useState, useCallback } from 'react';

export interface CursorPaginationState<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  totalCount: number | null;
}

export interface UseCursorPaginationOptions {
  pageSize?: number;
  initialCursor?: string | null;
}

/**
 * Hook for managing cursor-based pagination state
 * More efficient than offset-based pagination for large datasets
 */
export function useCursorPagination<T>(
  options: UseCursorPaginationOptions = {}
) {
  const { pageSize = 25, initialCursor = null } = options;

  const [state, setState] = useState<CursorPaginationState<T>>({
    items: [],
    cursor: initialCursor,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    error: null,
    totalCount: null,
  });

  const setItems = useCallback((items: T[]) => {
    setState((prev) => ({ ...prev, items }));
  }, []);

  const appendItems = useCallback((newItems: T[]) => {
    setState((prev) => ({
      ...prev,
      items: [...prev.items, ...newItems],
    }));
  }, []);

  const setCursor = useCallback((cursor: string | null) => {
    setState((prev) => ({ ...prev, cursor }));
  }, []);

  const setHasMore = useCallback((hasMore: boolean) => {
    setState((prev) => ({ ...prev, hasMore }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }));
  }, []);

  const setLoadingMore = useCallback((isLoadingMore: boolean) => {
    setState((prev) => ({ ...prev, isLoadingMore }));
  }, []);

  const setError = useCallback((error: Error | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setTotalCount = useCallback((totalCount: number | null) => {
    setState((prev) => ({ ...prev, totalCount }));
  }, []);

  const reset = useCallback(() => {
    setState({
      items: [],
      cursor: initialCursor,
      hasMore: true,
      isLoading: false,
      isLoadingMore: false,
      error: null,
      totalCount: null,
    });
  }, [initialCursor]);

  return {
    state,
    setItems,
    appendItems,
    setCursor,
    setHasMore,
    setLoading,
    setLoadingMore,
    setError,
    setTotalCount,
    reset,
    pageSize,
  };
}
