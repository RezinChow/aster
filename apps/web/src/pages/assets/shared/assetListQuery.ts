export type AssetListState = {
  q: string;
  sort: string;
  page: number;
  filters: Record<string, string>;
};

export type AssetListQueryOptions = {
  /** Sort written when the address bar omits `sort`. */
  sort: string;
  sorts: readonly string[];
  filterKeys: readonly string[];
};

/** Read `q`, `sort`, `page`, and the named filters. Unknown sorts and bad pages fall back. */
export function readAssetListQuery(
  params: URLSearchParams,
  options: AssetListQueryOptions,
): AssetListState {
  const rawSort = params.get('sort') ?? '';
  const rawPage = Number(params.get('page'));
  const filters: Record<string, string> = {};
  for (const key of options.filterKeys) filters[key] = params.get(key) ?? '';
  return {
    q: params.get('q') ?? '',
    sort: options.sorts.includes(rawSort) ? rawSort : options.sort,
    page: Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1,
    filters,
  };
}

/** Omit the default sort, the first page, and empty filters so a shared URL stays short. */
export function writeAssetListQuery(
  state: AssetListState,
  options: { sort: string },
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.sort && state.sort !== options.sort) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(Math.floor(state.page)));
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value);
  }
  return params;
}
