import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  ConsoleConfirmDialog,
  DangerZone,
  ConsoleDropdownMenu,
  ConsoleEmptyState,
  FilterChip,
  ConsolePagination,
  SearchSelect,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
  type ConsoleDropdownMenuItem,
  type SearchSelectOption,
} from '@a3s-lab/ui';
import { OfficeMarkdownEditor, toMarkdownContent } from '@/components/OfficeMarkdownEditor';
import { IconMore, IconRotateCcw, IconSearch } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import type { FacetCount } from '@/lib/assetHubApi';

export type FacetOption = { value: string; label: string; count?: number };

/**
 * Rows drawn for one facet group.
 * The selected value is not an input: choosing an option or 「全部」 must not
 * insert, remove, or reorder rows. `expanded` is the only switch.
 */
export function visibleFacetOptions<T>(options: readonly T[], limit: number, expanded: boolean): readonly T[] {
  if (expanded || options.length <= limit) return options;
  return options.slice(0, limit);
}

/** One left-rail filter group: 「全部」 plus values with counts. */
export function FacetSection({
  title,
  options,
  value,
  onChange,
  limit = 8,
}: {
  title: string;
  options: FacetOption[];
  value: string;
  onChange: (value: string) => void;
  limit?: number;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const heldCollapsed = useRef(false);
  useEffect(() => {
    if (heldCollapsed.current || !value) return;
    const index = options.findIndex((option) => option.value === value);
    if (index >= limit) setExpanded(true);
  }, [options, value, limit]);
  if (options.length === 0) return null;
  const visible = visibleFacetOptions(options, limit, expanded);
  return (
    <section className="space-y-1">
      <h3 className="px-2.5 pt-3 pb-1 text-[12px] font-medium text-[var(--spec-muted)]">{title}</h3>
      <ul className="space-y-0.5">
        <li>
          <FacetRow label={t('assets.facet.all')} active={!value} onClick={() => onChange('')} />
        </li>
        {visible.map((option) => (
          <li key={option.value}>
            <FacetRow
              label={option.label}
              count={option.count}
              active={value === option.value}
              onClick={() => onChange(value === option.value ? '' : option.value)}
            />
          </li>
        ))}
      </ul>
      {options.length > limit ? (
        <button
          type="button"
          className="px-2 text-xs text-ink-muted hover:text-ink"
          onClick={() =>
            setExpanded((open) => {
              heldCollapsed.current = open;
              return !open;
            })
          }
        >
          {expanded ? t('assets.facet.less') : t('assets.facet.more')}
        </button>
      ) : null}
    </section>
  );
}

function FacetRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-[8px] px-2.5 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-inset',
        active
          ? 'bg-[var(--spec-selected-row)] font-medium text-[var(--spec-ink)]'
          : 'text-[var(--spec-body)] hover:bg-[var(--spec-hover-row)] hover:text-[var(--spec-ink)]',
      )}
    >
      <span className="truncate">{label}</span>
      {count !== undefined ? (
        <span className="shrink-0 tabular-nums text-[12px] text-[var(--spec-muted)]">{count}</span>
      ) : null}
    </button>
  );
}

export function facetOptions(
  counts: FacetCount[] | undefined,
  label: (value: string) => string = (value) => value,
): FacetOption[] {
  return (counts ?? []).map((count) => ({
    value: count.value,
    label: label(count.value),
    count: count.count,
  }));
}

export type AssetColumn = {
  id: string;
  header: string;
  className?: string;
  align?: 'left' | 'right';
};

export type AssetRowAction = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
};

export type AssetTableRow = {
  id: string;
  href: string;
  title: string;
  /** One-line summary under the name. */
  description?: string;
  /** Status chips under the name, kept out of the data columns. */
  badges?: ReactNode;
  mark: ReactNode;
  cells: ReactNode[];
  inline?: AssetRowAction[];
  menu?: ConsoleDropdownMenuItem[];
};

export type AssetBatchAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: (ids: string[]) => Promise<void>;
};

function CheckMark({ mixed = false }: { mixed?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 overflow-visible" aria-hidden>
      {mixed ? (
        <path d="M3.5 8h9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path
          d="M3.2 8.3 6.3 11.4 12.8 4.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function RowCheckbox({
  checked,
  mixed = false,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}) {
  const active = checked || mixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border outline-none focus-visible:ring-2 focus-visible:ring-black/10',
        active ? 'border-[var(--spec-ink)] bg-[var(--spec-ink)] text-white' : 'border-[var(--spec-rail-plate)] bg-white text-transparent',
      )}
    >
      {active ? <CheckMark mixed={mixed} /> : null}
    </button>
  );
}

/** Documents-page library: filter rail, search, table, hover actions, floating batch bar. */
export function AssetHubLayout({
  rail,
  search,
  onSearchChange,
  searchPlaceholder,
  sort,
  sortOptions,
  onSortChange,
  total,
  loading,
  isEmpty,
  empty,
  page,
  pageSize,
  onPageChange,
  columns,
  rows,
  batchActions = [],
  onReload,
  filtered = false,
  onReset,
  segment,
  error,
  confirmHint,
}: {
  rail: ReactNode;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  sort: string;
  sortOptions: SearchSelectOption[];
  onSortChange: (value: string) => void;
  total: number;
  loading: boolean;
  isEmpty: boolean;
  empty: ReactNode;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  columns: AssetColumn[];
  rows: AssetTableRow[];
  batchActions?: AssetBatchAction[];
  onReload?: () => void;
  filtered?: boolean;
  onReset?: () => void;
  /** Status or visibility control, left of search. */
  segment?: ReactNode;
  /** Load failure. Empty library stays on `empty`. */
  error?: string | null;
  /** Batch delete field label. `{count}` is the number the operator must type. */
  confirmHint?: string;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<{ action: AssetBatchAction; ids: string[] } | null>(null);
  const [working, setWorking] = useState(false);
  const visibleIds = rows.map((row) => row.id);
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  useEffect(() => {
    setSelected((current) => current.filter((id) => visibleIds.includes(id)));
    // Visible ids are the selection scope for this page of results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIds.join('|')]);

  const toggleAll = () => {
    setSelected(allSelected ? [] : visibleIds);
  };
  const toggleOne = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const runBatch = async (action: AssetBatchAction, ids: string[]) => {
    setWorking(true);
    try {
      await action.onClick(ids);
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      setPending(null);
    } finally {
      setWorking(false);
    }
  };

  const hasRail = rail !== null && rail !== undefined && rail !== false;
  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col border-t border-[var(--spec-hairline)] lg:flex-row">
      {hasRail ? (
        <aside className="w-full shrink-0 border-[var(--spec-hairline)] lg:sticky lg:top-0 lg:max-h-[calc(100vh-12rem)] lg:w-56 lg:overflow-y-auto lg:border-r">
          <div className="px-3 pt-2 pb-4">{rail}</div>
        </aside>
      ) : null}
      <div className="relative min-w-0 flex-1">
        <div className="sticky top-0 z-10 bg-white px-6 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {segment}
              <label className="relative flex h-[30px] w-[220px] items-center">
                <span className="pointer-events-none absolute left-2.5 text-[var(--spec-muted)]">
                  <IconSearch className="size-4" />
                </span>
                <input
                  value={search}
                  placeholder={searchPlaceholder}
                  onChange={(event) => onSearchChange(event.target.value)}
                  className="h-[30px] w-full rounded-[8px] border-0 bg-[var(--spec-field)] pr-3 pl-8 text-[13px] text-[var(--spec-ink)] outline-none placeholder:text-[var(--spec-muted)]"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] whitespace-nowrap text-[var(--spec-muted)] tabular-nums">
                {t('assets.total').replace('{count}', String(total))}
              </span>
              <SearchSelect
                size="sm"
                className="w-36"
                value={sort}
                options={sortOptions}
                searchable={false}
                allowClear={false}
                onChange={onSortChange}
              />
              {filtered && onReset ? (
                <button
                  type="button"
                  onClick={onReset}
                  className="flex h-8 items-center rounded-[8px] border border-[var(--spec-canvas)] bg-white px-3 text-[13px] text-[var(--spec-ink)] outline-none hover:bg-[var(--spec-quiet-button-hover)] focus-visible:ring-2 focus-visible:ring-black/10"
                >
                  {t('assets.facet.reset')}
                </button>
              ) : null}
              {onReload ? (
                <button
                  type="button"
                  aria-label={t('assets.action.refresh')}
                  onClick={onReload}
                  className="flex size-8 items-center justify-center rounded-[8px] text-[var(--spec-ink)] outline-none hover:bg-[var(--spec-field)] focus-visible:ring-2 focus-visible:ring-black/10"
                >
                  <IconRotateCcw className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {loading && isEmpty ? (
          <div className="space-y-2 px-6 py-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-14 rounded-[8px]" />
            ))}
          </div>
        ) : error ? (
          <AssetLoadError message={error} onRetry={onReload} />
        ) : isEmpty ? (
          <div className="px-6 py-10">{empty}</div>
        ) : (
          <div data-ui="assets.table" className={selectedVisible.length > 0 ? 'overflow-x-auto pb-24' : 'overflow-x-auto pb-4'}>
            <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
              <thead>
                <tr className="text-[13px] font-medium text-[var(--spec-ink)]">
                  <th className="h-9 w-14 pl-6 font-medium">
                    <RowCheckbox
                      checked={allSelected}
                      mixed={someSelected}
                      label={
                        selectedVisible.length > 0
                          ? t('assets.column.selectAll')
                          : t('assets.column.name')
                      }
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="h-9 min-w-[240px] font-medium">
                    {selectedVisible.length > 0 ? (
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={toggleAll}
                          className="text-[13px] font-medium text-[var(--spec-ink)] outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                        >
                          {t('assets.column.selectAll')}
                        </button>
                        <span className="font-normal text-[var(--spec-muted)]">
                          {t('assets.batch.selected').replace('{count}', String(selectedVisible.length))}
                        </span>
                      </span>
                    ) : (
                      t('assets.column.name')
                    )}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      className={cn(
                        'h-9 pr-3 font-medium whitespace-nowrap',
                        column.align === 'right' && 'text-right',
                        column.className,
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const checked = selected.includes(row.id);
                  const inline = row.inline ?? [];
                  const menu = row.menu ?? [];
                  return (
                    <tr
                      key={row.id}
                      className={checked ? 'bg-[var(--spec-selected-row)]' : 'hover:bg-[var(--spec-hover-row)]'}
                    >
                      <td className="py-2 pl-6">
                        <RowCheckbox checked={checked} label={row.title} onChange={() => toggleOne(row.id)} />
                      </td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-1">
                        <Link
                          to={row.href}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-black/10"
                        >
                          {row.mark}
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="min-w-0 truncate text-[13px] font-medium text-[var(--spec-title-ink)]">
                                {row.title}
                              </span>
                              {row.badges ? (
                                <span className="flex shrink-0 flex-wrap items-center gap-1">{row.badges}</span>
                              ) : null}
                            </span>
                            {row.description ? (
                              <span className="block truncate text-[12px] text-[var(--spec-caption)]">{row.description}</span>
                            ) : null}
                          </span>
                        </Link>
                        {inline.length + menu.length > 0 ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            {inline.map((action) => (
                              <button
                                key={action.id}
                                type="button"
                                aria-label={action.label}
                                title={action.label}
                                onClick={action.onClick}
                                className="flex size-6 items-center justify-center rounded-[6px] text-[var(--spec-ink)] outline-none hover:bg-[var(--spec-selected-row)] focus-visible:ring-2 focus-visible:ring-black/10"
                              >
                                {action.icon}
                              </button>
                            ))}
                            {menu.length > 0 ? (
                              <ConsoleDropdownMenu
                                aria-label={t('assets.action.more')}
                                items={menu}
                                trigger={
                                  <span className="flex size-6 items-center justify-center rounded-[6px] text-[var(--spec-ink)] hover:bg-[var(--spec-selected-row)]">
                                    <IconMore className="size-3.5" />
                                  </span>
                                }
                              />
                            ) : null}
                          </div>
                        ) : null}
                        </div>
                      </td>
                      {row.cells.map((cell, index) => (
                        <td
                          key={columns[index]?.id ?? index}
                          className={cn(
                            'pr-3 text-[13px] text-[var(--spec-body)]',
                            columns[index]?.align === 'right' && 'text-right',
                          )}
                        >
                          <div className="truncate">{cell}</div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {total > pageSize ? (
              <div className="px-6 pt-3">
                <ConsolePagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
              </div>
            ) : null}
          </div>
        )}

        {selectedVisible.length > 0 && batchActions.length > 0 ? (
          <div
            data-ui="assets.batch-bar"
            className="sticky bottom-4 z-20 flex justify-center"
          >
            <div className="flex items-center gap-1 rounded-[12px] border border-[var(--spec-card-border)] bg-white px-2 py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
              <span className="px-2 text-[13px] whitespace-nowrap text-[var(--spec-muted)]">
                {t('assets.batch.selected').replace('{count}', String(selectedVisible.length))}
              </span>
              {batchActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    const ids = selectedVisible;
                    if (ids.length === 0) return;
                    if (action.danger) setPending({ action, ids });
                    else void runBatch(action, ids);
                  }}
                  className={cn(
                    'flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] outline-none hover:bg-[var(--spec-field)] focus-visible:ring-2 focus-visible:ring-black/10',
                    action.danger ? 'text-[var(--spec-danger-text)] hover:bg-[#fdecec]' : 'text-[var(--spec-ink)]',
                  )}
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <ConsoleConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        tone="danger"
        title={t('assets.batch.deleteTitle').replace('{count}', String(pending?.ids.length ?? 0))}
        description={t('assets.batch.deleteDesc')}
        confirmText={pending && pending.ids.length > 0 ? String(pending.ids.length) : undefined}
        confirmHint={confirmHint?.replace('{count}', String(pending?.ids.length ?? 0))}
        confirmLabel={pending?.action.label ?? t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={working}
        onConfirm={() => {
          if (pending) return runBatch(pending.action, pending.ids);
        }}
      />
    </div>
  );
}

export function AssetCardLink({
  to,
  mark,
  title,
  subtitle,
  badges,
  description,
  footer,
}: {
  to: string;
  mark: ReactNode;
  title: string;
  subtitle?: ReactNode;
  badges?: ReactNode;
  description: string;
  footer: ReactNode;
}) {
  return (
    <Card
      as={Link}
      to={to}
      className="flex min-h-[132px] flex-col gap-2.5 p-4 transition-colors hover:bg-control-fill"
    >
      <div className="flex items-start gap-3">
        {mark}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium text-ink">{title}</span>
            {badges}
          </div>
          {subtitle ? <div className="truncate text-xs text-ink-faint">{subtitle}</div> : null}
        </div>
      </div>
      <p className="line-clamp-2 flex-1 text-sm text-ink-muted">{description || '—'}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">{footer}</div>
    </Card>
  );
}

/** Colored tile with the icon, or the first letter when there is none. */
export function AssetMark({
  name,
  color,
  iconUrl,
  size = 40,
}: {
  name: string;
  color?: string;
  iconUrl?: string | null;
  size?: number;
}) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-semibold text-white"
      style={{ width: size, height: size, background: color || '#64748B', fontSize: size * 0.42 }}
      aria-hidden
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

export function ReadmeView({ markdown }: { markdown: string }) {
  const { t } = useI18n();
  if (!markdown.trim()) {
    return <ConsoleEmptyState plain title={t('assets.readme.empty')} />;
  }
  return (
    <OfficeMarkdownEditor
      preview
      content={toMarkdownContent(markdown)}
      onChange={() => undefined}
      className="min-h-[360px]"
    />
  );
}

/** 设置页底部的删除区：输入名称确认后才执行。 */
export function DeleteAssetZone({
  name,
  description,
  onDelete,
}: {
  name: string;
  description: string;
  onDelete: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DangerZone
        title={t('assets.danger.title')}
        description={description}
        actionLabel={t('assets.action.delete')}
        onAction={() => setOpen(true)}
      />
      <ConsoleConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={t('assets.danger.confirmTitle').replace('{name}', name)}
        description={t('assets.danger.confirmDesc')}
        confirmText={name}
        confirmHint={t('assets.danger.confirmHint').replace('{name}', name)}
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await onDelete();
            setOpen(false);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}

/** Underline sections shared by model, connector, and skill details. */
export function AssetDetailTabs({
  label,
  value,
  onChange,
  options,
  packed = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; count?: number }[];
  /** Hug each label. Repository pages use this; the market shelf keeps equal tabs. */
  packed?: boolean;
}) {
  return (
    <Tabs value={value} onValueChange={onChange} className="gap-0">
      <TabsList className={cn('os-market-shelf-tabs', packed && '!justify-start')} aria-label={label}>
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className={cn(
              'os-market-shelf-tab !h-auto !rounded-none !bg-transparent !px-3.5 !py-2.5 !shadow-none',
              packed && '!flex-none',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className="os-market-shelf-tab__count tabular-nums">{option.count}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** DESIGN.md §6 white pill on the `#f5f5f5` track. */
export function AssetSegment({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-[30px] shrink-0 items-stretch rounded-[8px] bg-[var(--spec-field)] p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <FilterChip
            key={option.value || 'all'}
            inset
            role="radio"
            aria-checked={active}
            label={option.label}
            active={active}
            onClick={() => onChange(option.value)}
          />
        );
      })}
    </div>
  );
}

function AssetLoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="text-[14px] text-[var(--spec-muted)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="h-[30px] rounded-[8px] border border-[var(--spec-canvas)] bg-white px-3 text-[13px] text-[var(--spec-ink)] outline-none hover:bg-[var(--spec-quiet-button-hover)] focus-visible:ring-2 focus-visible:ring-black/10"
        >
          {t('assets.error.retry')}
        </button>
      ) : null}
    </div>
  );
}

/** Loading, a failed load, and a missing asset stay separate. */
export function AssetDetailStatus({
  loading,
  missing,
  error,
  onRetry,
}: {
  loading: boolean;
  missing: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (loading) return <Skeleton className="h-64 rounded-[8px]" />;
  if (missing || !error) return <ConsoleEmptyState title={t('assets.notFound')} />;
  return <AssetLoadError message={error} onRetry={onRetry} />;
}


