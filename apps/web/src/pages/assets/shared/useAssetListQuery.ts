import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  readAssetListQuery,
  writeAssetListQuery,
  type AssetListQueryOptions,
  type AssetListState,
} from './assetListQuery';
import { useDebounced } from './useAssetQuery';

/** Address-bar list state. Search is written with history replace after it settles. */
export function useAssetListQuery(options: AssetListQueryOptions) {
  const [params, setParams] = useSearchParams();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const state = readAssetListQuery(params, options);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [search, setSearch] = useState(state.q);
  useEffect(() => {
    setSearch(state.q);
  }, [state.q]);

  const debounced = useDebounced(search.trim());
  useEffect(() => {
    if (debounced !== search.trim()) return;
    const current = stateRef.current;
    if (debounced === current.q) return;
    setParams(
      writeAssetListQuery({ ...current, q: debounced, page: 1 }, { sort: optionsRef.current.sort }),
      { replace: true },
    );
  }, [debounced, search, setParams]);

  const write = useCallback(
    (next: AssetListState, replace = false) => {
      setParams(writeAssetListQuery(next, { sort: optionsRef.current.sort }), { replace });
    },
    [setParams],
  );

  const updateFilters = useCallback(
    (patch: Record<string, string>) => {
      const current = stateRef.current;
      write({ ...current, page: 1, filters: { ...current.filters, ...patch } });
    },
    [write],
  );

  const setSort = useCallback(
    (sort: string) => {
      write({ ...stateRef.current, sort, page: 1 });
    },
    [write],
  );

  const setPage = useCallback(
    (page: number) => {
      write({ ...stateRef.current, page });
    },
    [write],
  );

  const reset = useCallback(() => {
    setSearch('');
    const filters: Record<string, string> = {};
    for (const key of optionsRef.current.filterKeys) filters[key] = '';
    write({ q: '', sort: optionsRef.current.sort, page: 1, filters }, true);
  }, [write]);

  return {
    q: state.q,
    sort: state.sort,
    page: state.page,
    filters: state.filters,
    query: params.toString(),
    search,
    setSearch,
    updateFilters,
    setSort,
    setPage,
    reset,
  };
}
