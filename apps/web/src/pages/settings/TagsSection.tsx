import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, ListToolbar, PageLoading, PopConfirm, SearchSelect, useShowPageLoading, useToast } from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { RegionCascader } from '@/components/RegionCascader';
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@/components/UiIcons';
import type { TagCatalog, TagCodeResult, TagGrade, TagLevel, TagTreeRow } from '@/data/tags';
import { TAG_SCOPE_NATIONWIDE } from '@/data/tags.data';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

type TagsModule = typeof import('@/data/tags');

const LEVEL_KEY: Record<TagLevel, MessageKey> = {
  group: 'settings.tags.level.group',
  tag: 'settings.tags.level.tag',
};

const GRADE_KEY: Record<TagGrade, MessageKey> = {
  national: 'settings.tags.grade.national',
  provincial: 'settings.tags.grade.provincial',
  municipal: 'settings.tags.grade.municipal',
  county: 'settings.tags.grade.county',
};

const CODE_ERROR: Record<Exclude<TagCodeResult, 'ok'>, MessageKey> = {
  empty: 'settings.tags.code.empty',
  invalid: 'settings.tags.code.invalid',
  duplicate: 'settings.tags.code.duplicate',
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
  row: TagTreeRow;
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
        aria-label={`${row.name} ${t('settings.tags.col.name')}`}
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

function ScopeCell({
  row,
  onCommit,
}: {
  row: TagTreeRow;
  onCommit: (id: string, scopeId: string) => void;
}) {
  const { t } = useI18n();
  const [path, setPath] = useState(row.scopePath);
  const timer = useRef(0);

  useEffect(() => {
    setPath(row.scopePath);
  }, [row.scopePath]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <RegionCascader
        size="sm"
        className="w-52"
        expandSingleChild={false}
        province={path[0] ?? ''}
        city={path[1] ?? ''}
        county={path[2] ?? ''}
        placeholder={t('settings.tags.scope.nationwide')}
        aria-label={`${row.name} ${t('settings.tags.col.scope')}`}
        onChange={(next) => {
          const parts = [next.province, next.city, next.county].filter((part) => part.length > 0);
          setPath(parts);
          window.clearTimeout(timer.current);
          const scopeId = parts[parts.length - 1] ?? '';
          if (!scopeId) {
            onCommit(row.id, '');
            return;
          }
          timer.current = window.setTimeout(() => onCommit(row.id, scopeId), 500);
        }}
      />
    </div>
  );
}

function CodeCell({
  row,
  onCommit,
}: {
  row: TagTreeRow;
  onCommit: (id: string, code: string) => TagCodeResult;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState(row.code);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommit = useRef(false);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setValue(row.code);
  }, [row.code]);

  function commit(next: string) {
    if (skipCommit.current) {
      skipCommit.current = false;
      setValue(row.code);
      return;
    }
    const result = onCommit(row.id, next);
    if (result !== 'ok') setValue(row.code);
    else setValue(next.trim().toLowerCase());
  }

  return (
    <div className="min-w-0" onClick={(event) => event.stopPropagation()}>
      <Input
        ref={inputRef}
        size="sm"
        allowClear={false}
        value={value}
        className="font-mono"
        aria-label={`${row.name} ${t('settings.tags.col.code')}`}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            skipCommit.current = true;
            setValue(row.code);
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export function TagsSection() {
  const { t } = useI18n();
  const toast = useToast();
  const [catalog, setCatalog] = useState<TagCatalog | null>(null);
  const [tags, setTags] = useState<TagsModule | null>(null);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<TagLevel | 'all'>('all');
  const [grade, setGrade] = useState<TagGrade | 'all'>('all');
  const [region, setRegion] = useState({ province: '', city: '', county: '' });
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const clearFocus = useCallback(() => setFocusId(null), []);

  useEffect(() => {
    let cancelled = false;
    void import('@/data/tags').then((mod) => {
      if (cancelled) return;
      setTags(mod);
      setCatalog(mod.loadTagCatalog());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scope =
    region.province === TAG_SCOPE_NATIONWIDE ? TAG_SCOPE_NATIONWIDE : region.county || region.city || region.province;
  const filtering = query.trim() !== '' || level !== 'all' || grade !== 'all' || scope !== '';

  const autoOpen = useMemo(() => {
    if (!catalog || !tags || (query.trim() === '' && scope === '')) return new Set<string>();
    return tags.tagTreeAutoOpen(catalog, query, level, grade, scope);
  }, [catalog, grade, level, query, scope, tags]);

  const openIds = useMemo(() => {
    if (!filtering) return expanded;
    const open = new Set(autoOpen);
    for (const id of collapsed) open.delete(id);
    return open;
  }, [autoOpen, collapsed, expanded, filtering]);

  const rows = useMemo(() => {
    if (!catalog || !tags) return [];
    return tags.visibleTagTree(catalog, openIds, query, level, grade, scope);
  }, [catalog, grade, level, openIds, query, scope, tags]);

  const firstLoad = useShowPageLoading(!catalog || !tags);
  if (!catalog || !tags) return firstLoad ? <PageLoading variant="contain" /> : null;
  // 窄化不流入下方闭包——绑定守卫后的非空存储。
  const tagStore = tags;

  async function refreshList() {
    setLoading(true);
    try {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 0);
      });
      setCatalog(tagStore.reloadTagCatalog());
      setQuery('');
      setLevel('all');
      setGrade('all');
      setRegion({ province: '', city: '', county: '' });
      setExpanded(new Set());
      setCollapsed(new Set());
      setFocusId(null);
      setTableKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  }

  function toggle(row: TagTreeRow) {
    if (!row.branch) return;
    if (filtering) setCollapsed((current) => toggleId(current, row.id));
    else setExpanded((current) => toggleId(current, row.id));
  }

  function commitName(id: string, name: string) {
    if (!tagStore.renameTag(id, name)) return;
    setCatalog(tagStore.loadTagCatalog());
  }

  function commitCode(id: string, code: string): TagCodeResult {
    const result = tagStore.setTagCode(id, code);
    if (result !== 'ok') {
      toast.push({ title: t(CODE_ERROR[result]), tone: 'danger' });
      return result;
    }
    setCatalog(tagStore.loadTagCatalog());
    return result;
  }

  function setGradeOf(id: string, next: TagGrade) {
    if (!tagStore.setTagGrade(id, next)) return;
    setCatalog(tagStore.loadTagCatalog());
  }

  function setScope(id: string, scopeId: string) {
    if (!tagStore.setTagScope(id, scopeId)) return;
    setCatalog(tagStore.loadTagCatalog());
  }

  function reveal(createdId: string, parentId: string) {
    setCatalog(tagStore.loadTagCatalog());
    if (parentId) {
      setExpanded((current) => {
        const next = new Set(current);
        next.add(parentId);
        return next;
      });
      setCollapsed((current) => {
        if (!current.has(parentId)) return current;
        const next = new Set(current);
        next.delete(parentId);
        return next;
      });
    }
    if (level !== 'all' || grade !== 'all' || scope !== '') {
      setLevel('all');
      setGrade('all');
      setRegion({ province: '', city: '', county: '' });
    }
    setFocusId(createdId);
  }

  function addGroup() {
    const created = tagStore.addTag('', t('settings.tags.new.group'));
    if (!created) return;
    if (query.trim()) {
      setQuery('');
      setCollapsed(new Set());
    }
    reveal(created.id, '');
  }

  function addChild(row: TagTreeRow) {
    if (row.level !== 'group') return;
    const created = tagStore.addTag(row.id, t('settings.tags.new.tag'));
    if (!created) return;
    if (query.trim() && !t('settings.tags.new.tag').includes(query.trim())) {
      setQuery('');
      setCollapsed(new Set());
    }
    reveal(created.id, row.id);
  }

  function remove(id: string) {
    tagStore.removeTag(id);
    setCatalog(tagStore.loadTagCatalog());
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        {t('settings.tags.summary')
          .replace('{groups}', String(catalog.counts.group))
          .replace('{tags}', String(catalog.counts.tag))
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
        searchPlaceholder={t('settings.tags.search')}
        filters={
          <>
            <SearchSelect
              size="sm"
              className="w-32"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.tags.level')}
              value={level}
              onChange={(value) => {
                const next = (value as TagLevel | 'all') || 'all';
                setLevel(next);
                if (next === 'group') setGrade('all');
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.tags.level.all') },
                { value: 'group', label: t('settings.tags.level.group') },
                { value: 'tag', label: t('settings.tags.level.tag') },
              ]}
            />
            <SearchSelect
              size="sm"
              className="w-32"
              searchable={false}
              allowClear={false}
              aria-label={t('settings.tags.grade')}
              value={grade}
              onChange={(value) => {
                const next = (value as TagGrade | 'all') || 'all';
                setGrade(next);
                if (next !== 'all' && level === 'group') setLevel('all');
                setCollapsed(new Set());
              }}
              options={[
                { value: 'all', label: t('settings.tags.grade.all') },
                { value: 'national', label: t('settings.tags.grade.national') },
                { value: 'provincial', label: t('settings.tags.grade.provincial') },
                { value: 'municipal', label: t('settings.tags.grade.municipal') },
                { value: 'county', label: t('settings.tags.grade.county') },
              ]}
            />
            <RegionCascader
              size="sm"
              className="w-44"
              expandSingleChild={false}
              province={region.province}
              city={region.city}
              county={region.county}
              placeholder={t('settings.tags.scope.all')}
              aria-label={t('settings.tags.scope.filter')}
              nationwideOption={{ value: TAG_SCOPE_NATIONWIDE, label: t('settings.tags.scope.nationwide') }}
              onChange={(next) => {
                setRegion(next);
                setCollapsed(new Set());
              }}
            />
          </>
        }
        primaryAction={
          <Button type="button" size="sm" onClick={addGroup}>
            <IconPlus />
            {t('settings.tags.addGroup')}
          </Button>
        }
      />
      <I18nDataTable
        rows={rows}
        key={`${tableKey}:${level}:${grade}:${scope}`}
        rowKey={(row) => row.id}
        loading={loading}
        showPagination={level !== 'all' || grade !== 'all'}
        defaultPagination={{ page: 1, pageSize: 50 }}
        pageSizeOptions={[50, 100]}
        onRefresh={() => refreshList()}
        columns={[
          {
            id: 'name',
            header: t('settings.tags.col.name'),
            cell: (row) => {
              const open = openIds.has(row.id);
              return (
                <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: row.depth * 20 }}>
                  {row.branch ? (
                    <button
                      type="button"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-control-fill hover:text-ink"
                      aria-expanded={open}
                      aria-label={`${open ? t('settings.tags.collapse') : t('settings.tags.expand')} ${row.name}`}
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
            header: t('settings.tags.col.level'),
            width: '6rem',
            cell: (row) => <span className="text-sm">{t(LEVEL_KEY[row.level])}</span>,
          },
          {
            id: 'grade',
            header: t('settings.tags.col.grade'),
            width: '8rem',
            cell: (row) => {
              if (row.level !== 'tag' || !row.grade) return <Dash />;
              return (
                <div onClick={(event) => event.stopPropagation()}>
                  <SearchSelect
                    size="sm"
                    className="w-28"
                    searchable={false}
                    allowClear={false}
                    aria-label={`${row.name} ${t('settings.tags.grade')}`}
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
            id: 'scope',
            header: t('settings.tags.col.scope'),
            width: '14rem',
            cell: (row) => (row.level === 'group' ? <ScopeCell row={row} onCommit={setScope} /> : <Dash />),
          },
          {
            id: 'code',
            header: t('settings.tags.col.code'),
            width: '14rem',
            cell: (row) => <CodeCell row={row} onCommit={commitCode} />,
          },
        ]}
        rowActions={(row) => (
          <ListRowActions>
            {row.level === 'group' ? (
              <ListRowAction
                iconOnly
                icon={<IconPlus />}
                aria-label={t('settings.tags.addChild')}
                onClick={() => addChild(row)}
              />
            ) : null}
            <PopConfirm
              title={t('settings.tags.deleteConfirm').replace('{name}', row.name)}
              description={row.childCount > 0 ? t('settings.tags.deleteConfirmBody') : undefined}
              confirmLabel={t('settings.tags.delete')}
              cancelLabel={t('settings.tags.cancel')}
              tone="danger"
              onConfirm={() => remove(row.id)}
            >
              <ListRowAction iconOnly tone="danger" icon={<IconTrash />} aria-label={t('settings.tags.delete')} />
            </PopConfirm>
          </ListRowActions>
        )}
      />
    </div>
  );
}
