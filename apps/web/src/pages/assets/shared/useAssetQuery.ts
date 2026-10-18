import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '@/lib/apiEnvelope';

/** Loads `load()` whenever `key` changes; stale responses are dropped. */
export function useAssetQuery<T>(key: string, load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setMissing(false);
    loadRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setError(null);
        setMissing(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setMissing(isAssetNotFound(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);
  return { data, setData, error, missing, loading, reload };
}

/** `value` after it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A missing asset is HTTP 404, or the envelope code 40400. Other failures stay retryable. */
export function isAssetNotFound(err: unknown): boolean {
  return err instanceof ApiRequestError && (err.code === 404 || err.code === 40400);
}

export async function settleIds(
  ids: string[],
  run: (id: string) => Promise<unknown>,
): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(ids.map((id) => run(id)));
  const failed = results.filter((result) => result.status === 'rejected').length;
  return { ok: results.length - failed, failed };
}
