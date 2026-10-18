import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Input, ListToolbar, PageLoading, PopConfirm, SearchSelect, useShowPageLoading } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { RegionCascader } from '@/components/RegionCascader';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@/components/UiIcons';
import type { AdminCatalog, AdminOrganType, AdminRank, AdminTreeRow } from '@/data/administration';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type AdministrationModule = typeof import('@/data/administration');

const RANK_KEY: Record<AdminRank, MessageKey> = {
  central: 'settings.administration.level.central',
  provincial: 'settings.administration.level.provincial',
  municipal: 'settings.administration.level.municipal',
  county: 'settings.administration.level.county',
};

const TYPE_KEY: Record<AdminOrganType, MessageKey> = {
  general: 'settings.administration.type.general',
  constituent: 'settings.administration.type.constituent',
  special: 'settings.administration.type.special',
  direct: 'settings.administration.type.direct',
  staff: 'settings.administration.type.staff',
  institution: 'settings.administration.type.institution',
  bureau: 'settings.administration.type.bureau',
  government: 'settings.administration.type.government',
  prefecture: 'settings.administration.type.prefecture',
  sar: 'settings.administration.type.sar',
  ting: 'settings.administration.type.ting',
  ju: 'settings.administration.type.ju',
  wei: 'settings.administration.type.wei',
  office: 'settings.administration.type.office',
  public: 'settings.administration.type.public',
  mass: 'settings.administration.type.mass',
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
  row: AdminTreeRow;
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

  if (row.kind !== 'organ') {
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
        aria-label={`${row.name} ${t('settings.administration.col.name')}`}
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

export function AdministrationSection() {
  const { t } = useI18n();
  const [catalog, setCatalog] = useState<AdminCatalog | null>(null);
  const [admin, setAdmin] = useState<AdministrationModule | null>(null);
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState<AdminRank | 'all'>('all');
  const [region, setRegion] = useState({ province: '', city: '', county: '' });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const clearFocus = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/administration').then((mod) => {
      if (cancelled) return;
      setAdmin(mod);
      setCatalog(mod.loadAdministrationCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const nationwide = admin?.ADMIN_SCOPE_NATIONWIDE ?? 'nationwide';
  const scope =
    region.province === nationwide ? nationwide : region.county || region.city || region.province;
  const filtering = query.trim() !== '' || rank !== 'all' || scope !== '';

  const autoOpen = useMemo(() => {
    if (!catalog || !admin || scope !== '' || (query.trim() === '' && rank === 'all')) return new Set<string>();
    return admin.administrationTreeAutoOpen(catalog, query, rank);
  }, [admin, catalog, query, rank, scope]);

  const openIds = useMemo(() => {
    if (!filtering) return expanded;
    const open = new Set(autoOpen);
    for (const id of collapsed) open.delete(id);
    return open;
  }, [autoOpen, collapsed, expanded, filtering]);

  const rows = useMemo(() => {
    if (!catalog || !admin) return [];
    return admin.visibleAdministrationTree(catalog, openIds, query, rank, scope);
  }, [admin, catalog, openIds, query, rank, scope]);

  const firstLoad = useShowPageLoading(!catalog || !admin);
  if (!catalog || !admin) return firstLoad ? <PageLoading variant="contain" /> : null;
  // 窄化不流入下方闭包——绑定守卫后的非空存储。
  const adminStore = admin;

  async function refreshList() {
    setLoading(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      setCatalog(adminStore.reloadAdministrationCatalog());
      setQuery('');
      setRank('all');
      setRegion({ province: '', city: '', county: '' });
      setExpanded(new Set());
      setCollapsed(new Set());
      setFocusId(null);
      setTableKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  function toggle(row: AdminTreeRow) {
    if (!row.branch) return;
    if (filtering) setCollapsed((current) => toggleId(current, row.id));
    else setExpanded((current) => toggleId(current, row.id));
  }

  function commitName(id: string, name: string) {
    if (!adminStore.renameOrgan(id, name)) return;
    setCatalog(adminStore.loadAdministrationCatalog());
  }

  function setRankOf(id: string, next: AdminRank) {
    if (!adminStore.setOrganRank(id, next)) return;
    setCatalog(adminStore.loadAdministrationCatalog());
  }

  function addChild(row: AdminTreeRow) {
    const label = t('settings.administration.new.organ');
    const created = adminStore.addOrgan(row.id, label);
    if (!created) return;
    setCatalog(adminStore.loadAdministrationCatalog());
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
    if (rank !== 'all' && rank !== created.rank) setRank('all');
    setFocusId(created.id);
  }

  function remove(id: string) {
    adminStore.removeOrgan(id);
    setCatalog(adminStore.loadAdministrationCatalog());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {t('settings.administration.summary')
          .replace('{central}', String(catalog.counts.central))
          .replace('{provincial}', String(catalog.counts.provincial))
          .replace('{municipal}', String(catalog.counts.municipal))
          .replace('{county}', String(catalog.counts.county))}
      </p>
      <ListToolbar
        search={query}
        onSearchChange={(value) => {
          setQuery(value);
          setCollapsed(new Set());
        }}
        searchPlaceholder={t('settings.administration.search')}
        filters={
          <>
            <SearchSelect
              size="sm"
              className="w-32"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.administration.level')}
              value={rank}
              onChange={(value) => {
                setRank((value as AdminRank | 'all') || 'all');
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.administration.level.all') },
                { value: 'central', label: t('settings.administration.level.central') },
                { value: 'provincial', label: t('settings.administration.level.provincial') },
                { value: 'municipal', label: t('settings.administration.level.municipal') },
                { value: 'county', label: t('settings.administration.level.county') },
              ]}
            />
            <RegionCascader
              size="sm"
              className="w-44"
              expandSingleChild={false}
              province={region.province}
              city={region.city}
              county={region.county}
              placeholder={t('settings.administration.scope.all')}
              aria-label={t('settings.administration.scope.filter')}
              nationwideOption={{ value: nationwide, label: t('settings.administration.scope.nationwide') }}
              onChange={(next) => {
                setRegion(next);
                setCollapsed(new Set());
              }}
            />
          </>
        }
      />
      <I18nDataTable
        rows={rows}
        key={`${tableKey}:${rank}:${scope}`}
        rowKey={(row) => row.id}
        loading={loading}
        showPagination={rank !== 'all' || scope !== ''}
        defaultPagination={{ page: 1, pageSize: 50 }}
        pageSizeOptions={[50, 100]}
        onRefresh={() => refreshList()}
        columns={[
          {
            id: 'name',
            header: t('settings.administration.col.name'),
            cell: (row) => {
              const open = openIds.has(row.id);
              return (
                <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: row.depth * 20 }}>
                  {row.branch ? (
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-control-fill hover:text-ink"
                      aria-expanded={open}
                      aria-label={`${open ? t('settings.administration.collapse') : t('settings.administration.expand')} ${row.name}`}
                      onClick={() => toggle(row)}
                    >
                      {open ? <IconChevronDown width={14} height={14} /> : <IconChevronRight width={14} height={14} />}
                    </button>
                  ) : (
                    <span className="size-5 shrink-0" />
                  )}
                  <NameCell row={row} autoFocus={focusId === row.id} onFocused={clearFocus} onCommit={commitName} />
                </div>
              );
            },
          },
          {
            id: 'level',
            header: t('settings.administration.col.level'),
            width: '8rem',
            cell: (row) => {
              if (row.kind !== 'organ' || !row.rank) {
                return <span className="text-sm">{t('settings.administration.level.system')}</span>;
              }
              return (
                <div onClick={(event) => event.stopPropagation()}>
                  <SearchSelect
                    size="sm"
                    className="w-28"
                    searchable={false}
                    allowClear={false}
                    aria-label={`${row.name} ${t('settings.administration.level')}`}
                    value={row.rank}
                    onChange={(value) => {
                      if (value === 'central' || value === 'provincial' || value === 'municipal' || value === 'county') {
                        setRankOf(row.id, value);
                      }
                    }}
                    options={[
                      { value: 'central', label: t(RANK_KEY.central) },
                      { value: 'provincial', label: t(RANK_KEY.provincial) },
                      { value: 'municipal', label: t(RANK_KEY.municipal) },
                      { value: 'county', label: t(RANK_KEY.county) },
                    ]}
                  />
                </div>
              );
            },
          },
          {
            id: 'type',
            header: t('settings.administration.col.type'),
            width: '10rem',
            cell: (row) =>
              row.organType ? <span className="text-sm">{t(TYPE_KEY[row.organType])}</span> : <Dash />,
          },
          {
            id: 'scope',
            header: t('settings.administration.col.scope'),
            width: '14rem',
            cell: (row) => (
              <span className="text-sm">{row.scopeId ? row.scopeName : t('settings.administration.scope.nationwide')}</span>
            ),
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            <ListRowAction
              iconOnly
              icon={<IconPlus />}
              aria-label={t('settings.administration.addChild')}
              onClick={() => addChild(row)}
            />
            {row.kind === 'organ' && row.childCount === 0 ? (
              <PopConfirm
                title={t('settings.administration.deleteConfirm').replace('{name}', row.name)}
                confirmLabel={t('settings.administration.delete')}
                cancelLabel={t('settings.administration.cancel')}
                tone="danger"
                onConfirm={() => remove(row.id)}
              >
                <ListRowAction
                  iconOnly
                  tone="danger"
                  icon={<IconTrash />}
                  aria-label={t('settings.administration.delete')}
                />
              </PopConfirm>
            ) : null}
          </ListRowActions>
        )}
      />
    </div>
  );
}
