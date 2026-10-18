import {
  Activity,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react';
import { clearPageLoadingSession } from '@a3s-lab/ui';
import {
  UNSAFE_LocationContext,
  useLocation,
  useNavigationType,
  useOutlet,
  type Location,
  type NavigationType,
} from 'react-router-dom';

/**
 * Route Keep-Alive for the Console shell.
 *
 * First principles (PRINCIPLES §2 不变量 #4 — UI cache is non-authoritative):
 * - Preserve ephemeral UI state (filters, drafts, scroll) across sidebar hops.
 * - Pause Effects while hidden so subscriptions do not leak (`Activity`).
 * - Bound memory with LRU eviction; never treat cached UI as control-plane truth.
 * - Freeze `LocationContext` for inactive panes so hooks keep the cached route.
 *
 * Industry practice on React 19+: use `Activity` (visible|hidden) instead of
 * third-party keep-alive wrappers that relocate fibers / break router context.
 */

const DEFAULT_MAX_ENTRIES = 10;

type KeepAliveApi = {
  clear: () => void;
};

type CacheEntry = {
  node: ReactElement;
  location: Location;
  navigationType: NavigationType;
};

const KeepAliveApiContext = createContext<KeepAliveApi>({
  clear: () => undefined,
});

export function useKeepAliveApi(): KeepAliveApi {
  return useContext(KeepAliveApiContext);
}

/** Normalize pathname for stable cache keys. */
export function keepAliveCacheKey(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

type KeepAliveOutletProps = {
  /** Scroll container that owns list/detail scroll (AppShell content). */
  scrollParentRef?: RefObject<HTMLElement | null>;
  /** Soft cap on cached route instances (LRU). */
  maxEntries?: number;
};

let externalClear: (() => void) | null = null;

/** Keys currently held by the shell KeepAlive (synced for sync cache-hit checks). */
const aliveKeys = new Set<string>();

export function clearKeepAliveCaches() {
  externalClear?.();
  clearPageLoadingSession();
}

/** True when the route pane is already in the shell keep-alive cache. */
export function isKeepAliveRouteCached(pathname: string): boolean {
  return aliveKeys.has(keepAliveCacheKey(pathname));
}

function syncAliveKeys(cache: Map<string, CacheEntry>) {
  aliveKeys.clear();
  for (const key of cache.keys()) aliveKeys.add(key);
}

export function KeepAliveOutlet({
  scrollParentRef,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: KeepAliveOutletProps) {
  const outlet = useOutlet();
  const location = useLocation();
  const navigationType = useNavigationType();
  const cacheKey = keepAliveCacheKey(location.pathname);

  const cacheRef = useRef(new Map<string, CacheEntry>());
  const orderRef = useRef<string[]>([]);
  const scrollOffsetsRef = useRef(new Map<string, number>());
  const previousKeyRef = useRef<string | null>(null);
  const [version, setVersion] = useState(0);

  const clear = useCallback(() => {
    cacheRef.current.clear();
    orderRef.current = [];
    scrollOffsetsRef.current.clear();
    previousKeyRef.current = null;
    aliveKeys.clear();
    setVersion((value) => value + 1);
  }, []);

  const api = useMemo<KeepAliveApi>(() => ({ clear }), [clear]);

  useLayoutEffect(() => {
    externalClear = clear;
    return () => {
      if (externalClear === clear) externalClear = null;
    };
  }, [clear]);

  useLayoutEffect(() => {
    if (!outlet) return;

    let changed = false;
    const cache = cacheRef.current;
    const existing = cache.get(cacheKey);
    if (!existing) {
      cache.set(cacheKey, {
        node: outlet,
        location,
        navigationType,
      });
      changed = true;
    } else {
      // Keep fiber via stable `node`; refresh live location for the active key.
      existing.location = location;
      existing.navigationType = navigationType;
    }

    const previousOrder = orderRef.current.join('\0');
    const order = orderRef.current.filter((key) => key !== cacheKey);
    order.push(cacheKey);
    while (order.length > maxEntries) {
      const evicted = order.shift();
      if (evicted) {
        cache.delete(evicted);
        scrollOffsetsRef.current.delete(evicted);
        changed = true;
      }
    }
    orderRef.current = order;
    if (order.join('\0') !== previousOrder) changed = true;

    syncAliveKeys(cache);

    if (changed) setVersion((value) => value + 1);
  }, [cacheKey, outlet, location, navigationType, maxEntries]);

  useLayoutEffect(() => {
    const parent = scrollParentRef?.current;
    const previousKey = previousKeyRef.current;

    if (parent && previousKey && previousKey !== cacheKey) {
      scrollOffsetsRef.current.set(previousKey, parent.scrollTop);
    }

    if (parent) {
      const restore = scrollOffsetsRef.current.get(cacheKey);
      parent.scrollTop = typeof restore === 'number' ? restore : 0;
    }

    previousKeyRef.current = cacheKey;
  }, [cacheKey, scrollParentRef]);

  const entries = useMemo(() => {
    void version;
    return orderRef.current
      .map((key) => {
        const entry = cacheRef.current.get(key);
        return entry ? { key, ...entry } : null;
      })
      .filter(
        (entry): entry is { key: string } & CacheEntry => entry != null,
      );
  }, [version]);

  if (!outlet && entries.length === 0) return null;

  return (
    <KeepAliveApiContext.Provider value={api}>
      <div className="os-keepalive" data-keepalive-active={cacheKey}>
        {entries.map((entry) => {
          const active = entry.key === cacheKey;
          const pane = (
            <div
              className="os-keepalive__pane"
              data-keepalive-key={entry.key}
              data-keepalive-active={active ? 'true' : undefined}
              hidden={!active}
            >
              {entry.node}
            </div>
          );

          return (
            <Activity key={entry.key} mode={active ? 'visible' : 'hidden'}>
              {active ? (
                pane
              ) : (
                <UNSAFE_LocationContext.Provider
                  value={{
                    location: entry.location,
                    navigationType: entry.navigationType,
                  }}
                >
                  {pane}
                </UNSAFE_LocationContext.Provider>
              )}
            </Activity>
          );
        })}
      </div>
    </KeepAliveApiContext.Provider>
  );
}
