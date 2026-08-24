import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Reusable cursor-based infinite scroll pagination hook
 * @param {Function} fetcher - Async function (params, signal) => Promise<{ items: Array, nextCursor: String|null, hasMore: Boolean, total: Number }>
 * @param {Object} params - Query parameters (folderId, category, filter, search, etc.)
 * @param {Object} options - Hook options { limit: 24, enabled: true }
 */
export function usePaginatedList(fetcher, params = {}, options = {}) {
  const { limit = 24, enabled = true } = options;

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Serialized params key to detect meaningful parameter changes
  const paramsKey = JSON.stringify(params);

  // Fetch a page with stale response protection
  const fetchPage = useCallback(
    async (cursor = null, isAppend = false) => {
      if (!enabled) return;

      const currentRequestId = ++requestIdRef.current;

      // Abort any prior in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const queryArgs = {
          ...paramsRef.current,
          limit,
          cursor: cursor || undefined,
        };

        const res = await fetcher(queryArgs, abortController.signal);

        // Discard if another request was triggered since
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        const rawItems = res?.items || res?.videos || (Array.isArray(res) ? res : []);
        const newHasMore = typeof res?.hasMore === 'boolean' ? res.hasMore : rawItems.length >= limit;
        const newCursor = res?.nextCursor || (rawItems.length > 0 ? rawItems[rawItems.length - 1]._id : null);
        const newTotal = typeof res?.total === 'number' ? res.total : undefined;

        setNextCursor(newCursor);
        setHasMore(newHasMore);
        if (newTotal !== undefined) setTotal(newTotal);

        if (isAppend) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((it) => it._id || it.id));
            const freshItems = rawItems.filter((it) => !existingIds.has(it._id || it.id));
            return [...prev, ...freshItems];
          });
        } else {
          setItems(rawItems);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return; // Ignore aborted requests
        }
        if (currentRequestId === requestIdRef.current) {
          console.warn('[usePaginatedList error]:', err.message);
          setError(err);
          if (!isAppend) setItems([]);
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [enabled, fetcher, limit]
  );

  // Auto-reset and fetch page 1 whenever params change
  useEffect(() => {
    setNextCursor(null);
    setHasMore(true);
    fetchPage(null, false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [paramsKey, fetchPage]);

  // Load next page
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore && nextCursor) {
      fetchPage(nextCursor, true);
    }
  }, [loading, loadingMore, hasMore, nextCursor, fetchPage]);

  // Hard reload from page 1
  const refresh = useCallback(() => {
    setNextCursor(null);
    setHasMore(true);
    return fetchPage(null, false);
  }, [fetchPage]);

  // Local optimistic mutator
  const mutateItems = useCallback((updater) => {
    setItems((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  return {
    items,
    nextCursor,
    hasMore,
    loading,
    loadingMore,
    error,
    total,
    loadMore,
    refresh,
    mutateItems,
  };
}
