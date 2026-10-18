import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, ListToolbar, PageLoading, PopConfirm, SearchSelect, useShowPageLoading } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@/components/UiIcons';
import type { ChainCatalog, ChainLevel, ChainTreeRow } from '@/data/provincialChains';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type ChainsModule = typeof import('@/data/provincialChains');

const LEVEL_KEY: Record<ChainLevel, MessageKey> = {
  province: 'settings.chains.level.province',
  chain: 'settings.chains.level.chain',
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
  row: ChainTreeRow;
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

  if (row.level === 'province') {
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
        aria-label={`${row.name} ${t('settings.chains.col.name')}`}
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

export function ProvincialChainsSection() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<ChainCatalog | null>(null);
  const [chains, setChains] = useState<ChainsModule | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<ChainLevel | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const clearFocus = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/provincialChains').then((mod) => {
      if (cancelled) return;
      setChains(mod);
      setCatalog(mod.loadChainCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtering = query.trim() !== '' || level !== 'all';

  const autoOpen = useMemo(() => {
    if (!catalog || !chains || !filtering) return new Set<string>();
    return chains.chainTreeAutoOpen(catalog, query, level);
  }, [catalog, chains, filtering, level, query]);

  const openIds = useMemo(() => {
    if (!filtering) return expanded;
    const open = new Set(autoOpen);
    for (const id of collapsed) open.delete(id);
    return open;
  }, [autoOpen, collapsed, expanded, filtering]);

  const rows = useMemo(() => {
    if (!catalog || !chains) return [];
    return chains.visibleChainTree(catalog, openIds, query, level);
  }, [catalog, chains, level, openIds, query]);

  const firstLoad = useShowPageLoading(!catalog || !chains);
  if (!catalog || !chains) return firstLoad ? <PageLoading variant="contain" /> : null;
  // 窄化不流入下方闭包——绑定守卫后的非空存储。
  const chainsStore = chains;

  async function refreshList() {
    setLoading(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      setCatalog(chainsStore.reloadChainCatalog());
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

  function toggle(row: ChainTreeRow) {
    if (!row.branch) return;
    if (filtering) setCollapsed((current) => toggleId(current, row.id));
    else setExpanded((current) => toggleId(current, row.id));
  }

  function commitName(id: string, name: string) {
    if (!chainsStore.renameChain(id, name)) return;
    setCatalog(chainsStore.loadChainCatalog());
  }

  function addChild(row: ChainTreeRow) {
    if (row.level !== 'province') return;
    const label = t('settings.chains.new.chain');
    const created = chainsStore.addChain(row.id, label);
    if (!created) return;
    setCatalog(chainsStore.loadChainCatalog());
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
    if (level !== 'all') setLevel('all');
    setFocusId(created.id);
  }

  function remove(id: string) {
    chainsStore.removeChain(id);
    setCatalog(chainsStore.loadChainCatalog());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {t('settings.chains.summary')
          .replace('{provinces}', String(catalog.counts.province))
          .replace('{chains}', String(catalog.counts.chain))}
      </p>
      <ListToolbar
        search={query}
        onSearchChange={(value) => {
          setQuery(value);
          setCollapsed(new Set());
        }}
        searchPlaceholder={t('settings.chains.search')}
        filters={
          <SearchSelect
            size="sm"
            className="w-36"
            searchable={false}
            allowClear={false}
            aria-label={t('settings.chains.level')}
            value={level}
            onChange={(value) => {
              setLevel((value as ChainLevel | 'all') || 'all');
              setCollapsed(new Set());
            }}
            options={[
              { value: 'all', label: t('settings.chains.level.all') },
              { value: 'province', label: t('settings.chains.level.province') },
              { value: 'chain', label: t('settings.chains.level.chain') },
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
            header: t('settings.chains.col.name'),
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
                      aria-label={`${open ? t('settings.chains.collapse') : t('settings.chains.expand')} ${row.name}`}
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
            header: t('settings.chains.col.level'),
            width: '6rem',
            cell: (row) => <span className="text-sm">{t(LEVEL_KEY[row.level])}</span>,
          },
          {
            id: 'province',
            header: t('settings.chains.col.province'),
            width: '10rem',
            cell: (row) =>
              row.level === 'chain' ? (
                <span className="text-sm">{row.provinceName}</span>
              ) : (
                <Dash />
              ),
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            {row.level === 'province' ? (
              <ListRowAction
                iconOnly
                icon={<IconPlus />}
                aria-label={t('settings.chains.addChild')}
                onClick={() => addChild(row)}
              />
            ) : (
              <PopConfirm
                title={t('settings.chains.deleteConfirm').replace('{name}', row.name)}
                confirmLabel={t('settings.chains.delete')}
                cancelLabel={t('settings.chains.cancel')}
                tone="danger"
                onConfirm={() => remove(row.id)}
              >
                <ListRowAction
                  iconOnly
                  tone="danger"
                  icon={<IconTrash />}
                  aria-label={t('settings.chains.delete')}
                />
              </PopConfirm>
            )}
          </ListRowActions>
        )}
      />
    </div>
  );
}
