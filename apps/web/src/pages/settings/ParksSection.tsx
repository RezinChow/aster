import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, ListToolbar, PageLoading, PopConfirm, SearchSelect, useShowPageLoading } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@/components/UiIcons';
import type { ParkCatalog, ParkGrade, ParkLevel, ParkTreeRow } from '@/data/parks';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type ParksModule = typeof import('@/data/parks');

const LEVEL_KEY: Record<ParkLevel, MessageKey> = {
  province: 'settings.parks.level.province',
  city: 'settings.parks.level.city',
  county: 'settings.parks.level.county',
  park: 'settings.parks.level.park',
};

const GRADE_KEY: Record<ParkGrade, MessageKey> = {
  national: 'settings.parks.grade.national',
  provincial: 'settings.parks.grade.provincial',
  municipal: 'settings.parks.grade.municipal',
  county: 'settings.parks.grade.county',
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
  row: ParkTreeRow;
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

  if (row.level !== 'park') {
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
        aria-label={`${row.name} ${t('settings.parks.col.name')}`}
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

export function ParksSection() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<ParkCatalog | null>(null);
  const [parks, setParks] = useState<ParksModule | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<ParkLevel | 'all'>('all');
  const [grade, setGrade] = useState<ParkGrade | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const clearFocus = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/parks').then((mod) => {
      if (cancelled) return;
      setParks(mod);
      setCatalog(mod.loadParkCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtering = query.trim() !== '' || level !== 'all' || grade !== 'all';

  const autoOpen = useMemo(() => {
    if (!catalog || !parks || query.trim() === '') return new Set<string>();
    return parks.parkTreeAutoOpen(catalog, query, level, grade);
  }, [catalog, grade, parks, level, query]);

  const openIds = useMemo(() => {
    if (!filtering) return expanded;
    const open = new Set(autoOpen);
    for (const id of collapsed) open.delete(id);
    return open;
  }, [autoOpen, collapsed, expanded, filtering]);

  const rows = useMemo(() => {
    if (!catalog || !parks) return [];
    return parks.visibleParkTree(catalog, openIds, query, level, grade);
  }, [catalog, grade, parks, level, openIds, query]);

  const firstLoad = useShowPageLoading(!catalog || !parks);
  if (!catalog || !parks) return firstLoad ? <PageLoading variant="contain" /> : null;
  // 窄化不流入下方闭包——绑定守卫后的非空存储。
  const parksStore = parks;

  async function refreshList() {
    setLoading(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      setCatalog(parksStore.reloadParkCatalog());
      setQuery('');
      setLevel('all');
      setGrade('all');
      setExpanded(new Set());
      setCollapsed(new Set());
      setFocusId(null);
      setTableKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  function toggle(row: ParkTreeRow) {
    if (!row.branch) return;
    if (filtering) setCollapsed((current) => toggleId(current, row.id));
    else setExpanded((current) => toggleId(current, row.id));
  }

  function commitName(id: string, name: string) {
    if (!parksStore.renamePark(id, name)) return;
    setCatalog(parksStore.loadParkCatalog());
  }

  function addChild(row: ParkTreeRow) {
    if (row.level === 'park') return;
    const label = t('settings.parks.new.park');
    const created = parksStore.addPark(row.id, label);
    if (!created) return;
    setCatalog(parksStore.loadParkCatalog());
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
    if (level !== 'all' && level !== 'park') setLevel('all');
    setFocusId(created.id);
  }

  function setGradeOf(id: string, next: ParkGrade) {
    if (!parksStore.setParkGrade(id, next)) return;
    setCatalog(parksStore.loadParkCatalog());
  }

  function remove(id: string) {
    parksStore.removePark(id);
    setCatalog(parksStore.loadParkCatalog());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {t('settings.parks.summary')
          .replace('{provinces}', String(catalog.counts.province))
          .replace('{cities}', String(catalog.counts.city))
          .replace('{counties}', String(catalog.counts.county))
          .replace('{national}', String(catalog.gradeCounts.national))
          .replace('{provincial}', String(catalog.gradeCounts.provincial))
          .replace('{municipal}', String(catalog.gradeCounts.municipal))
          .replace('{county}', String(catalog.gradeCounts.county))}
      </p>
      <ListToolbar
        search={query}
        onSearchChange={(value) => {
          setQuery(value);
          setCollapsed(new Set());
        }}
        searchPlaceholder={t('settings.parks.search')}
        filters={
          <>
            <SearchSelect
              size="sm"
              className="w-36"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.parks.level')}
              value={level}
              onChange={(value) => {
                const next = (value as ParkLevel | 'all') || 'all';
                setLevel(next);
                if (next === 'province' || next === 'city' || next === 'county') setGrade('all');
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.parks.level.all') },
                { value: 'province', label: t('settings.parks.level.province') },
                { value: 'city', label: t('settings.parks.level.city') },
                { value: 'county', label: t('settings.parks.level.county') },
                { value: 'park', label: t('settings.parks.level.park') },
              ]}
            />
            <SearchSelect
              size="sm"
              className="w-32"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.parks.grade')}
              value={grade}
              onChange={(value) => {
                const next = (value as ParkGrade | 'all') || 'all';
                setGrade(next);
                if (next !== 'all' && level !== 'park') setLevel('all');
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.parks.grade.all') },
                { value: 'national', label: t('settings.parks.grade.national') },
                { value: 'provincial', label: t('settings.parks.grade.provincial') },
                { value: 'municipal', label: t('settings.parks.grade.municipal') },
                { value: 'county', label: t('settings.parks.grade.county') },
              ]}
            />
          </>
        }
      />
      <I18nDataTable
        rows={rows}
        key={`${tableKey}:${level}:${grade}`}
        rowKey={(row) => row.id}
        loading={loading}
        showPagination={level !== 'all' || grade !== 'all'}
        defaultPagination={{ page: 1, pageSize: 50 }}
        pageSizeOptions={[50, 100]}
        onRefresh={() => refreshList()}
        columns={[
          {
            id: 'name',
            header: t('settings.parks.col.name'),
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
                      aria-label={`${open ? t('settings.parks.collapse') : t('settings.parks.expand')} ${row.name}`}
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
            header: t('settings.parks.col.level'),
            width: '8rem',
            cell: (row) => {
              if (row.level !== 'park' || !row.grade) {
                return <span className="text-sm">{t(LEVEL_KEY[row.level])}</span>;
              }
              return (
                <div onClick={(event) => event.stopPropagation()}>
                  <SearchSelect
                    size="sm"
                    className="w-28"
                    searchable={false}
                    allowClear={false}
                    aria-label={`${row.name} ${t('settings.parks.grade')}`}
                    value={row.grade}
                    onChange={(value) => {
                      if (value === 'national' || value === 'provincial' || value === 'municipal' || value === 'county') {
                        setGradeOf(row.id, value);
                      }
                    }}
                    options={[
                      { value: 'national', label: t(GRADE_KEY.national) },
                      { value: 'provincial', label: t(GRADE_KEY.provincial) },
                      { value: 'municipal', label: t(GRADE_KEY.municipal) },
                      { value: 'county', label: t(GRADE_KEY.county) },
                    ]}
                  />
                </div>
              );
            },
          },
          {
            id: 'place',
            header: t('settings.parks.col.place'),
            width: '10rem',
            cell: (row) => (row.placeName ? <span className="text-sm">{row.placeName}</span> : <Dash />),
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            {row.level === 'park' ? null : (
              <ListRowAction
                iconOnly
                icon={<IconPlus />}
                aria-label={t('settings.parks.addChild')}
                onClick={() => addChild(row)}
              />
            )}
            {row.level === 'park' ? (
              <PopConfirm
                title={t('settings.parks.deleteConfirm').replace('{name}', row.name)}
                confirmLabel={t('settings.parks.delete')}
                cancelLabel={t('settings.parks.cancel')}
                tone="danger"
                onConfirm={() => remove(row.id)}
              >
                <ListRowAction
                  iconOnly
                  tone="danger"
                  icon={<IconTrash />}
                  aria-label={t('settings.parks.delete')}
                />
              </PopConfirm>
            ) : null}
          </ListRowActions>
        )}
      />
    </div>
  );
}
