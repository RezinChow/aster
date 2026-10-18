import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, ListToolbar, PageLoading, PopConfirm, SearchSelect, useShowPageLoading } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@/components/UiIcons';
import { loadTagCatalog } from '@/data/tags';
import type { UniversityCatalog, UniversityLevel, UniversityTier, UniversityTreeRow } from '@/data/universities';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type UniversitiesModule = typeof import('@/data/universities');

const LEVEL_KEY: Record<UniversityLevel, MessageKey> = {
  province: 'settings.universities.level.province',
  city: 'settings.universities.level.city',
  county: 'settings.universities.level.county',
  university: 'settings.universities.level.university',
};

const TIER_KEY: Record<UniversityTier, MessageKey> = {
  undergraduate: 'settings.universities.tier.undergraduate',
  vocational: 'settings.universities.tier.vocational',
  adult: 'settings.universities.tier.adult',
};

function Dash() {
  return <span className="text-ink-faint">—</span>;
}

function toggleId(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function NameCell({
  row,
  autoFocus,
  onFocused,
  onCommit,
}: {
  row: UniversityTreeRow;
  autoFocus: boolean;
  onFocused: () => void;
  onCommit: (id: string, name: string) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(row.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommit = useRef(false);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setValue(row.name);
  }, [row.name]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
    onFocused();
  }, [autoFocus, onFocused]);

  if (row.level !== 'university') {
    return <span className="flex h-8 min-w-0 flex-1 items-center truncate text-sm text-ink">{row.name}</span>;
  }

  function commit(next: string) {
    if (skipCommit.current) {
      skipCommit.current = false;
      setValue(row.name);
      return;
    }
    const trimmed = next.trim();
    if (!trimmed || trimmed === row.name) {
      setValue(row.name);
      return;
    }
    onCommit(row.id, trimmed);
  }

  return (
    <div className="flex min-w-0 flex-1 items-center" onClick={(event) => event.stopPropagation()}>
      <Input
        ref={inputRef}
        size="sm"
        allowClear={false}
        value={value}
        aria-label={`${row.name} ${t('settings.universities.col.name')}`}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            skipCommit.current = true;
            setValue(row.name);
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export function UniversitiesSection() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<UniversityCatalog | null>(null);
  const [universities, setUniversities] = useState<UniversitiesModule | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<UniversityLevel | 'all'>('all');
  const [tier, setTier] = useState<UniversityTier | 'all'>('all');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const clearFocus = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/universities').then((mod) => {
      if (cancelled) return;
      setUniversities(mod);
      setCatalog(mod.loadUniversityCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtering = query.trim() !== '' || level !== 'all' || tier !== 'all' || tagIds.length > 0;
  const titleTags = loadTagCatalog().childrenOf.get('university_title')?.filter((tag) => tag.level === 'tag') ?? [];

  const autoOpen = useMemo(() => {
    if (!catalog || !universities || query.trim() === '') return new Set<string>();
    return universities.universityTreeAutoOpen(catalog, query, level, tier, tagIds);
  }, [catalog, tagIds, tier, universities, level, query]);

  const openIds = useMemo(() => {
    if (!filtering) return expanded;
    const open = new Set(autoOpen);
    for (const id of collapsed) open.delete(id);
    return open;
  }, [autoOpen, collapsed, expanded, filtering]);

  const rows = useMemo(() => {
    if (!catalog || !universities) return [];
    return universities.visibleUniversityTree(catalog, openIds, query, level, tier, tagIds);
  }, [catalog, tagIds, tier, universities, level, openIds, query]);

  const firstLoad = useShowPageLoading(!catalog || !universities);
  if (!catalog || !universities) return firstLoad ? <PageLoading variant="contain" /> : null;
  // 窄化不流入下方闭包——绑定守卫后的非空存储。
  const universitiesStore = universities;

  async function refreshList() {
    setLoading(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      setCatalog(universitiesStore.reloadUniversityCatalog());
      setQuery('');
      setLevel('all');
      setTier('all');
      setTagIds([]);
      setExpanded(new Set());
      setCollapsed(new Set());
      setFocusId(null);
      setTableKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  function toggle(row: UniversityTreeRow) {
    if (!row.branch) return;
    if (filtering) setCollapsed((current) => toggleId(current, row.id));
    else setExpanded((current) => toggleId(current, row.id));
  }

  function commitName(id: string, name: string) {
    if (!universitiesStore.renameUniversity(id, name)) return;
    setCatalog(universitiesStore.loadUniversityCatalog());
  }

  function addChild(row: UniversityTreeRow) {
    if (row.level === 'university') return;
    const label = t('settings.universities.new.university');
    const created = universitiesStore.addUniversity(row.id, label);
    if (!created) return;
    setCatalog(universitiesStore.loadUniversityCatalog());
    setExpanded((current) => {
      const next = new Set(current);
      next.add(row.id);
      return next;
    });
    setCollapsed((current) => {
      if (!current.has(row.id)) return current;
      const next = new Set(current);
      next.delete(row.id);
      return next;
    });
    if (query.trim() && !label.includes(query.trim())) {
      setQuery('');
      setCollapsed(new Set());
    }
    if (level !== 'all' && level !== 'university') setLevel('all');
    setFocusId(created.id);
  }

  function setTierOf(id: string, next: UniversityTier) {
    if (!universitiesStore.setUniversityTier(id, next)) return;
    setCatalog(universitiesStore.loadUniversityCatalog());
  }

  function remove(id: string) {
    universitiesStore.removeUniversity(id);
    setCatalog(universitiesStore.loadUniversityCatalog());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {t('settings.universities.summary')
          .replace('{provinces}', String(catalog.counts.province))
          .replace('{cities}', String(catalog.counts.city))
          .replace('{counties}', String(catalog.counts.county))
          .replace('{undergraduate}', String(catalog.tierCounts.undergraduate))
          .replace('{vocational}', String(catalog.tierCounts.vocational))
          .replace('{adult}', String(catalog.tierCounts.adult))}
      </p>
      <ListToolbar
        search={query}
        onSearchChange={(value) => {
          setQuery(value);
          setCollapsed(new Set());
        }}
        searchPlaceholder={t('settings.universities.search')}
        filters={
          <>
            <SearchSelect
              size="sm"
              className="w-36"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.universities.level')}
              value={level}
              onChange={(value) => {
                const next = (value as UniversityLevel | 'all') || 'all';
                setLevel(next);
                if (next === 'province' || next === 'city' || next === 'county') {
                  setTier('all');
                  setTagIds([]);
                }
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.universities.level.all') },
                { value: 'province', label: t('settings.universities.level.province') },
                { value: 'city', label: t('settings.universities.level.city') },
                { value: 'county', label: t('settings.universities.level.county') },
                { value: 'university', label: t('settings.universities.level.university') },
              ]}
            />
            <SearchSelect
              size="sm"
              className="w-32"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.universities.tier')}
              value={tier}
              onChange={(value) => {
                const next = (value as UniversityTier | 'all') || 'all';
                setTier(next);
                if (next !== 'all' && level !== 'university') setLevel('all');
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.universities.tier.all') },
                { value: 'undergraduate', label: t(TIER_KEY.undergraduate) },
                { value: 'vocational', label: t(TIER_KEY.vocational) },
                { value: 'adult', label: t(TIER_KEY.adult) },
              ]}
            />
            <SearchSelect
              multiple
              size="sm"
              className="w-44"
              searchable
              allowClear
              aria-label={t('settings.universities.tag')}
              placeholder={t('settings.universities.tag.all')}
              searchPlaceholder={t('settings.universities.tag.search')}
              emptyText={t('settings.universities.tag.empty')}
              value={tagIds}
              onChange={(value) => {
                setTagIds(value);
                if (value.length > 0 && level !== 'university') setLevel('all');
                setCollapsed(new Set());
              }}
              options={titleTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            />
          </>
        }
      />
      <I18nDataTable
        rows={rows}
        key={`${tableKey}:${level}:${tier}:${tagIds.join(',')}`}
        rowKey={(row) => row.id}
        loading={loading}
        showPagination={level !== 'all' || tier !== 'all' || tagIds.length > 0}
        defaultPagination={{ page: 1, pageSize: 50 }}
        pageSizeOptions={[50, 100]}
        onRefresh={() => refreshList()}
        columns={[
          {
            id: 'name',
            header: t('settings.universities.col.name'),
            cell: (row) => {
              const open = openIds.has(row.id);
              return (
                <div
                  className="flex min-w-0 items-center gap-1"
                  style={{ paddingLeft: row.depth * 20 }}
                >
                  {row.branch ? (
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-control-fill hover:text-ink"
                      aria-expanded={open}
                      aria-label={`${open ? t('settings.universities.collapse') : t('settings.universities.expand')} ${row.name}`}
                      onClick={() => toggle(row)}
                    >
                      {open ? <IconChevronDown width={14} height={14} /> : <IconChevronRight width={14} height={14} />}
                    </button>
                  ) : (
                    <span className="size-5 shrink-0" />
                  )}
                  <NameCell
                    row={row}
                    autoFocus={focusId === row.id}
                    onFocused={clearFocus}
                    onCommit={commitName}
                  />
                </div>
              );
            },
          },
          {
            id: 'level',
            header: t('settings.universities.col.level'),
            width: '8rem',
            cell: (row) => {
              if (row.level !== 'university' || !row.tier) {
                return <span className="text-sm">{t(LEVEL_KEY[row.level])}</span>;
              }
              return (
                <div onClick={(event) => event.stopPropagation()}>
                  <SearchSelect
                    size="sm"
                    className="w-28"
                    searchable={false}
                    allowClear={false}
                    aria-label={`${row.name} ${t('settings.universities.tier')}`}
                    value={row.tier}
                    onChange={(value) => {
                      if (value === 'undergraduate' || value === 'vocational' || value === 'adult') setTierOf(row.id, value);
                    }}
                    options={[
                      { value: 'undergraduate', label: t(TIER_KEY.undergraduate) },
                      { value: 'vocational', label: t(TIER_KEY.vocational) },
                      { value: 'adult', label: t(TIER_KEY.adult) },
                    ]}
                  />
                </div>
              );
            },
          },
          {
            id: 'place',
            header: t('settings.universities.col.place'),
            width: '10rem',
            cell: (row) => (row.placeName ? <span className="text-sm">{row.placeName}</span> : <Dash />),
          },
          {
            id: 'tags',
            header: t('settings.universities.col.tags'),
            width: '16rem',
            cell: (row) => {
              if (row.tagIds.length === 0) return <Dash />;
              const names = row.tagIds.map((id) => loadTagCatalog().byId.get(id)?.name ?? id);
              return <span className="text-sm">{names.join('、')}</span>;
            },
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            {row.level === 'university' ? null : (
              <ListRowAction
                iconOnly
                icon={<IconPlus />}
                aria-label={t('settings.universities.addChild')}
                onClick={() => addChild(row)}
              />
            )}
            {row.level === 'university' ? (
              <PopConfirm
                title={t('settings.universities.deleteConfirm').replace('{name}', row.name)}
                confirmLabel={t('settings.universities.delete')}
                cancelLabel={t('settings.universities.cancel')}
                tone="danger"
                onConfirm={() => remove(row.id)}
              >
                <ListRowAction
                  iconOnly
                  tone="danger"
                  icon={<IconTrash />}
                  aria-label={t('settings.universities.delete')}
                />
              </PopConfirm>
            ) : null}
          </ListRowActions>
        )}
      />
    </div>
  );
}
