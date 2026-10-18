import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, ListToolbar, PageLoading, PopConfirm, SearchSelect, useShowPageLoading } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@/components/UiIcons';
import type { IndustryCatalog, IndustryLevel, IndustryTreeRow } from '@/data/industries';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type IndustriesModule = typeof import('@/data/industries');

const LEVEL_KEY: Record<IndustryLevel, MessageKey> = {
  section: 'settings.industries.level.section',
  division: 'settings.industries.level.division',
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
  row: IndustryTreeRow;
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
        aria-label={`${row.name} ${t('settings.industries.col.name')}`}
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

export function IndustriesSection() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<IndustryCatalog | null>(null);
  const [industries, setIndustries] = useState<IndustriesModule | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<IndustryLevel | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const clearFocus = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/industries').then((mod) => {
      if (cancelled) return;
      setIndustries(mod);
      setCatalog(mod.loadIndustryCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtering = query.trim() !== '' || level !== 'all';

  const autoOpen = useMemo(() => {
    if (!catalog || !industries || !filtering) return new Set<string>();
    return industries.industryTreeAutoOpen(catalog, query, level);
  }, [catalog, filtering, industries, level, query]);

  const openIds = useMemo(() => {
    if (!filtering) return expanded;
    const open = new Set(autoOpen);
    for (const id of collapsed) open.delete(id);
    return open;
  }, [autoOpen, collapsed, expanded, filtering]);

  const rows = useMemo(() => {
    if (!catalog || !industries) return [];
    return industries.visibleIndustryTree(catalog, openIds, query, level);
  }, [catalog, industries, level, openIds, query]);

  const firstLoad = useShowPageLoading(!catalog || !industries);
  if (!catalog || !industries) return firstLoad ? <PageLoading variant="contain" /> : null;
  // 窄化不流入下方闭包——绑定守卫后的非空存储。
  const industriesStore = industries;

  async function refreshList() {
    setLoading(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      setCatalog(industriesStore.reloadIndustryCatalog());
      setQuery('');
      setLevel('all');
      setExpanded(new Set());
      setCollapsed(new Set());
      setFocusId(null);
      setTableKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  function toggle(row: IndustryTreeRow) {
    if (!row.branch) return;
    if (filtering) setCollapsed((current) => toggleId(current, row.id));
    else setExpanded((current) => toggleId(current, row.id));
  }

  function commitName(id: string, name: string) {
    if (!industriesStore.renameIndustry(id, name)) return;
    setCatalog(industriesStore.loadIndustryCatalog());
  }

  function addChild(row: IndustryTreeRow) {
    if (row.level !== 'section') return;
    const label = t('settings.industries.new.division');
    const created = industriesStore.addIndustryChild(row.id, label);
    if (!created) return;
    setCatalog(industriesStore.loadIndustryCatalog());
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
    if (level !== 'all' && level !== created.level) setLevel('all');
    setFocusId(created.id);
  }

  function remove(id: string) {
    industriesStore.removeIndustry(id);
    setCatalog(industriesStore.loadIndustryCatalog());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {t('settings.industries.summary')
          .replace('{sections}', String(catalog.counts.section))
          .replace('{divisions}', String(catalog.counts.division))}
      </p>
      <ListToolbar
        search={query}
        onSearchChange={(value) => {
          setQuery(value);
          setCollapsed(new Set());
        }}
        searchPlaceholder={t('settings.industries.search')}
        filters={
          <SearchSelect
            size="sm"
            className="w-36"
            searchable={false}
            allowClear={false}
            aria-label={t('settings.industries.level')}
            value={level}
            onChange={(value) => {
              setLevel((value as IndustryLevel | 'all') || 'all');
              setCollapsed(new Set());
            }}
            options={[
              { value: 'all', label: t('settings.industries.level.all') },
              { value: 'section', label: t('settings.industries.level.section') },
              { value: 'division', label: t('settings.industries.level.division') },
            ]}
          />
        }
      />
      <I18nDataTable
        rows={rows}
        key={`${tableKey}:${level}`}
        rowKey={(row) => row.id}
        loading={loading}
        showPagination={level !== 'all'}
        defaultPagination={{ page: 1, pageSize: 50 }}
        pageSizeOptions={[50, 100]}
        onRefresh={() => refreshList()}
        columns={[
          {
            id: 'name',
            header: t('settings.industries.col.name'),
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
                      aria-label={`${open ? t('settings.industries.collapse') : t('settings.industries.expand')} ${row.name}`}
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
            header: t('settings.industries.col.level'),
            width: '6rem',
            cell: (row) => <span className="text-sm">{t(LEVEL_KEY[row.level])}</span>,
          },
          {
            id: 'code',
            header: t('settings.industries.col.code'),
            width: '8rem',
            cell: (row) =>
              row.code ? (
                <span className="font-mono text-xs tabular-nums">{row.code}</span>
              ) : (
                <Dash />
              ),
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            {row.level === 'division' ? null : (
              <ListRowAction
                iconOnly
                icon={<IconPlus />}
                aria-label={t('settings.industries.addChild')}
                onClick={() => addChild(row)}
              />
            )}
            <PopConfirm
              title={t('settings.industries.deleteConfirm').replace('{name}', row.name)}
              description={
                row.childCount > 0 ? t('settings.industries.deleteConfirmBody') : undefined
              }
              confirmLabel={t('settings.industries.delete')}
              cancelLabel={t('settings.industries.cancel')}
              tone="danger"
              onConfirm={() => remove(row.id)}
            >
              <ListRowAction
                iconOnly
                tone="danger"
                icon={<IconTrash />}
                aria-label={t('settings.industries.delete')}
              />
            </PopConfirm>
          </ListRowActions>
        )}
      />
    </div>
  );
}
