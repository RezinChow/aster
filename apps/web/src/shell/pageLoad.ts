import { useRef } from 'react';

/**
 * Remember the last successful load key.
 * React Activity reruns effects when a hidden page is shown again; callers
 * skip wiping state when `keep` is true so the page does not fall back to PageLoading.
 */
export function usePageLoadKey() {
  const loaded = useRef<string | null>(null);
  const api = useRef({
    keep(key: string) {
      return loaded.current === key;
    },
    done(key: string) {
      loaded.current = key;
    },
  });
  return api.current;
}
