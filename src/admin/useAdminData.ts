// Data hooks for the admin surface.
//
// What this guarantees, so no module has to re-implement it:
//  - one in-flight request per URL, and a four-second freshness window, so a screen that
//    renders a table plus a header count does not hammer the API;
//  - stale data is kept visible when a refresh fails, together with the error - an operator
//    reading a control room needs the last known state and an honest reason it is not newer;
//  - every request is abortable and cancelled on unmount, so switching rows fast cannot
//    deliver an older response on top of a newer one;
//  - a successful mutation invalidates the caches it can affect, which is how counts stay
//    truthful without polling.
import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch, buildQuery, type AdminQuery } from './api';
import { AdminApiError } from './api';

const FRESH_MS = 4000;

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

/** Drop cached reads. Prefixes keep this cheap: a place decision invalidates the lists that
 *  show that place, not the whole console. */
export function invalidateAdminCache(prefixes: string[] = []) {
  if (prefixes.length === 0) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) cache.delete(key);
  }
}

export function adminUrl(path: string, query?: AdminQuery) {
  return `${path}${buildQuery(query)}`;
}

interface ResourceState<T> {
  data: T | null;
  error: AdminApiError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  /** True when the screen is showing data that a later refresh failed to replace. */
  isStale: boolean;
  updatedAt: number | null;
  reload: () => void;
}

export function useAdminResource<T>(path: string | null, options: { force?: boolean } = {}): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(path));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const cached = cache.get(path);
    if (cached && Date.now() - cached.at < FRESH_MS) {
      setData(cached.value as T);
      setUpdatedAt(cached.at);
      setIsLoading(false);
      setIsStale(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let alive = true;
    if (cached) {
      setData(cached.value as T);
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const request = (async () => {
      const existing = inflight.get(path);
      if (existing) return await existing;
      const promise = adminFetch<T>(path, { signal: controller.signal }).finally(() => inflight.delete(path));
      inflight.set(path, promise);
      return await promise;
    })();

    request.then(
      (value) => {
        if (!alive || !mounted.current) return;
        const at = Date.now();
        cache.set(path, { at, value });
        setData(value);
        setUpdatedAt(at);
        setError(null);
        setIsStale(false);
        setIsLoading(false);
        setIsRefreshing(false);
      },
      (reason: unknown) => {
        if (!alive || !mounted.current) return;
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(reason instanceof AdminApiError ? reason : new AdminApiError(0, 'UNKNOWN', String(reason)));
        setIsStale(Boolean(cached));
        setIsLoading(false);
        setIsRefreshing(false);
      },
    );

    return () => {
      alive = false;
      controller.abort();
    };
    // `nonce` is the manual refresh; `options.force` is reserved for callers that must bypass
    // freshness on mount (the live-probe panel).
  }, [path, nonce, options.force]);

  const reload = useCallback(() => {
    if (path) cache.delete(path);
    setNonce((value) => value + 1);
  }, [path]);

  return { data, error, isLoading, isRefreshing, isStale, updatedAt, reload };
}

export type ActionStatus = 'idle' | 'pending' | 'done' | 'failed';

export interface AdminActionState<T> {
  status: ActionStatus;
  result: T | null;
  error: AdminApiError | null;
  isPending: boolean;
  run: (body: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
}

/**
 * A single privileged write. Validation errors from the server are surfaced inline (they are
 * the same rules the form enforces, so the operator sees the database's wording, not ours).
 */
export function useAdminAction<T = Record<string, any>>(
  path: string,
  options: { method?: 'POST' | 'PATCH'; invalidate?: string[] } = {},
): AdminActionState<T> {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<AdminApiError | null>(null);

  const invalidateKey = (options.invalidate ?? []).join('|');
  const run = useCallback(async (body: Record<string, unknown>) => {
    setStatus('pending');
    setError(null);
    try {
      const value = await adminFetch<T>(path, { method: options.method ?? 'POST', body });
      invalidateAdminCache(invalidateKey ? invalidateKey.split('|') : []);
      setResult(value);
      setStatus('done');
      return value;
    } catch (reason) {
      const apiError = reason instanceof AdminApiError
        ? reason
        : new AdminApiError(0, 'UNKNOWN', reason instanceof Error ? reason.message : 'request failed');
      setError(apiError);
      setStatus('failed');
      return null;
    }
  }, [path, options.method ?? 'POST', invalidateKey]);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, isPending: status === 'pending', run, reset };
}

/** Debounces a search box without losing the "typing" feel; the URL is the source of truth. */
export function useDebouncedValue<T>(value: T, delay = 260): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Wall-clock ticks used by "last checked" labels - one shared timer, not one per row. */
export function useTicker(intervalMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
}
