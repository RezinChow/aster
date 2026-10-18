import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ConsoleDrawer,
  ConsoleEmptyState,
  FilterChip,
  ListToolbar,
  Switch,
  type BadgeTone,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { I18nDataTable } from '@/components/I18nDataTable';
import { useI18n, type MessageKey } from '@/i18n/useI18n';
import type { Locale } from '@/prefs/store';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  searchLogs,
  type LogCounts,
  type LogLevelName,
  type LogRow,
} from '@/lib/logsApi';

const WINDOWS = [
  { id: '15m', ms: 15 * 60 * 1000 },
  { id: '1h', ms: 60 * 60 * 1000 },
  { id: '6h', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

type WindowId = (typeof WINDOWS)[number]['id'];
type LevelFilter = 'all' | LogLevelName;

const LEVELS: Array<{
  id: LevelFilter;
  label: MessageKey;
  count: keyof LogCounts;
}> = [
  { id: 'all', label: 'events.level.all', count: 'all' },
  { id: 'error', label: 'events.level.error', count: 'error' },
  { id: 'warn', label: 'events.level.warn', count: 'warn' },
  { id: 'info', label: 'events.level.info', count: 'info' },
  { id: 'debug', label: 'events.level.debug', count: 'debug' },
  { id: 'trace', label: 'events.level.trace', count: 'trace' },
];

const FETCH_LIMIT = 200;
const MAX_FETCHES = 40;

const EMPTY_COUNTS: LogCounts = {
  all: 0,
  trace: 0,
  debug: 0,
  info: 0,
  warn: 0,
  error: 0,
};

export function EventsPage() {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [windowId, setWindowId] = useState<WindowId>('1h');
  const [rows, setRows] = useState<LogRow[]>([]);
  const [counts, setCounts] = useState<LogCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<LogRow | null>(null);
  const [copied, setCopied] = useState(false);
  const requestSeq = useRef(0);
  const filtersRef = useRef({
    level,
    q: debouncedQ,
    windowId,
  });
  filtersRef.current = { level, q: debouncedQ, windowId };

  const range = useCallback((id: WindowId) => {
    const spec = WINDOWS.find((item) => item.id === id) ?? WINDOWS[1];
    const to = new Date();
    const from = new Date(to.getTime() - spec.ms);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(handle);
  }, [q]);

  const load = useCallback(
    async (mode: 'replace' | 'live') => {
      const seq = ++requestSeq.current;
      const filters = filtersRef.current;
      if (mode === 'replace') setLoading(true);
      setError(null);
      try {
        const collected: LogRow[] = [];
        const seen = new Set<string>();
        let cursor: string | undefined;
        let nextCounts = EMPTY_COUNTS;
        for (let i = 0; i < MAX_FETCHES; i += 1) {
          const page = await searchLogs({
            level: filters.level,
            q: filters.q,
            ...range(filters.windowId),
            cursor,
            limit: FETCH_LIMIT,
          });
          if (seq !== requestSeq.current) return;
          nextCounts = page.counts;
          for (const row of page.rows) {
            if (seen.has(row.id)) continue;
            seen.add(row.id);
            collected.push(row);
          }
          if (!page.nextCursor || page.rows.length === 0) break;
          cursor = page.nextCursor;
        }
        if (seq !== requestSeq.current) return;
        setCounts(nextCounts);
        setRows(collected);
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setRows([]);
        setCounts(EMPTY_COUNTS);
        setError(
          err instanceof ApiRequestError
            ? err.message
            : tRef.current('events.loadFailed'),
        );
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [range],
  );

  useEffect(() => {
    void load('replace');
  }, [debouncedQ, level, windowId, load]);

  useEffect(() => {
    if (!live) return;
    const handle = window.setInterval(() => {
      void load('live');
    }, 5_000);
    return () => window.clearInterval(handle);
  }, [live, load]);

  const filtered = q.trim() !== '' || level !== 'all';

  const fieldsText = useMemo(() => {
    if (!selected) return '';
    return JSON.stringify(selected.fields ?? {}, null, 2);
  }, [selected]);

  return (
    <AdminPageShell title={t('nav.events')} description={t('nav.eventsDesc')}>
      {error ? (
        <AppErrorBanner message={error} onRetry={() => void load('replace')} />
      ) : null}
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('events.search')}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
              role="group"
              aria-label={t('events.filterWindow')}
            >
              {WINDOWS.map((item) => (
                <FilterChip
                  key={item.id}
                  inset
                  label={t(`events.window.${item.id}`)}
                  active={windowId === item.id}
                  onClick={() => {
                    setLive(false);
                    setWindowId(item.id);
                  }}
                />
              ))}
            </div>
            <div
              className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
              role="group"
              aria-label={t('events.filterLevel')}
            >
              {LEVELS.map((item) => (
                <FilterChip
                  key={item.id}
                  inset
                  label={t(item.label)}
                  count={counts[item.count]}
                  active={level === item.id}
                  onClick={() => setLevel(item.id)}
                />
              ))}
            </div>
            <Switch
              checked={live}
              onCheckedChange={setLive}
              label={t('events.live')}
            />
          </div>
        }
      />
      <I18nDataTable
        key={`${windowId}:${level}:${debouncedQ}`}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        defaultPagination={{ page: 1, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
        onRefresh={() => load('replace')}
        onRowClick={(row) => {
          setCopied(false);
          setSelected(row);
        }}
        columns={[
          {
            id: 'at',
            header: t('events.col.at'),
            cell: (row) => (
              <span className="whitespace-nowrap font-mono text-xs tabular-nums text-ink-muted">
                {formatTs(row.ts, locale)}
              </span>
            ),
          },
          {
            id: 'level',
            header: t('events.col.level'),
            cell: (row) => (
              <Badge tone={levelTone(row.level)}>{levelLabel(row.level, t)}</Badge>
            ),
          },
          {
            id: 'target',
            header: t('events.col.target'),
            cell: (row) => (
              <span className="font-mono text-xs text-ink">{row.target}</span>
            ),
          },
          {
            id: 'message',
            header: t('events.col.message'),
            cell: (row) => (
              <span className="line-clamp-2 text-sm text-ink">{row.message}</span>
            ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            variant={filtered ? 'no-match' : 'no-data'}
            title={filtered ? t('admin.empty.title') : t('events.emptyTitle')}
            description={
              filtered ? t('admin.empty.description') : t('events.emptyBody')
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={
              filtered
                ? () => {
                    setQ('');
                    setDebouncedQ('');
                    setLevel('all');
                    setWindowId('1h');
                  }
                : undefined
            }
          />
        }
      />

      <ConsoleDrawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected ? formatTs(selected.ts, locale) : t('events.detail')}
        description={selected?.target}
        className="!w-[min(100%,48rem)]"
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={levelTone(selected.level)}>{levelLabel(selected.level, t)}</Badge>
              <span className="font-mono text-xs text-ink-muted">
                {t('events.service')}: {selected.service}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-ink">{selected.message}</p>
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs text-ink-muted">
                  {t('events.fields')}
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(fieldsText).then(() => {
                      setCopied(true);
                    });
                  }}
                >
                  {copied ? t('events.copied') : t('events.copy')}
                </Button>
              </div>
              <pre className="overflow-auto rounded-md bg-surface p-3 font-mono text-xs text-ink">
                {fieldsText}
              </pre>
            </section>
          </div>
        ) : null}
      </ConsoleDrawer>
    </AdminPageShell>
  );
}

function formatTs(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function levelLabel(level: string, t: (key: MessageKey) => string) {
  switch (level) {
    case 'trace':
      return t('events.level.trace');
    case 'debug':
      return t('events.level.debug');
    case 'info':
      return t('events.level.info');
    case 'warn':
      return t('events.level.warn');
    case 'error':
      return t('events.level.error');
    default:
      return level;
  }
}

function levelTone(level: string): BadgeTone {
  if (level === 'error') return 'danger';
  if (level === 'warn') return 'warn';
  if (level === 'info') return 'primary';
  return 'neutral';
}
