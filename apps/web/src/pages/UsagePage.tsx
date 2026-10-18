import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  ConsoleEmptyState,
  FilterChip,
  ListToolbar,
  MetaSummary,
  SearchSelect,
} from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { useI18n, type MessageKey } from '@/i18n/useI18n';
import { ApiRequestError } from '@/lib/apiEnvelope';
import { listTokenUsage, type TokenRollup } from '@/lib/usageApi';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';

type RangeId = '7d' | '30d' | '90d';

type DayPoint = { date: string; tokens: number };

type BreakRow = {
  key: string;
  modelId: string;
  endpoint: string;
  tokens: number;
  requests: number;
  failed: number;
  unmeasured: number;
};

const RANGES: RangeId[] = ['7d', '30d', '90d'];

export function UsagePage() {
  const { locale, t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const scope = useCloudScopeContext();
  const [range, setRange] = useState<RangeId>('30d');
  const [modelId, setModelId] = useState('all');
  const [rollups, setRollups] = useState<TokenRollup[]>([]);
  const [window, setWindow] = useState<{ from: string; to: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeReady = Boolean(scope.projectId && scope.envId);

  const load = useCallback(async () => {
    if (!scope.projectId || !scope.envId) {
      setRollups([]);
      setWindow(null);
      setError(null);
      return;
    }
    const bounds = boundsFor(range);
    setLoading(true);
    setError(null);
    try {
      const page = await listTokenUsage({
        projectId: scope.projectId,
        environmentId: scope.envId,
        from: bounds.from,
        to: bounds.to,
      });
      setRollups(page.rollups);
      setWindow({ from: page.from, to: page.to });
    } catch (err) {
      setRollups([]);
      setWindow(bounds);
      setError(
        err instanceof ApiRequestError ? err.message : tRef.current('usage.tokens.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [range, scope.envId, scope.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(() => {
    const ids = new Set(rollups.map((row) => row.modelId));
    return [...ids];
  }, [rollups]);

  useEffect(() => {
    if (modelId !== 'all' && !models.includes(modelId)) setModelId('all');
  }, [modelId, models]);

  const selected = useMemo(
    () => (modelId === 'all' ? rollups : rollups.filter((row) => row.modelId === modelId)),
    [modelId, rollups],
  );

  const totals = useMemo(() => sumRollups(selected), [selected]);
  const series = useMemo(() => {
    if (!window) return [];
    return dailySeries(window.from, window.to, selected);
  }, [selected, window]);
  const peak = series.reduce((max, day) => Math.max(max, day.tokens), 0);
  const breakdown = useMemo(() => breakdownRows(selected), [selected]);
  const empty = !loading && !error && scopeReady && totals.requests === 0;

  return (
    <AdminPageShell
      title={t('nav.usage')}
      description={t('usage.tokens.hint')}
      actions={<Badge tone="neutral">{t('usage.tokens.badge')}</Badge>}
    >
      {error ? <AppErrorBanner message={error} onRetry={() => void load()} /> : null}
      {!scopeReady ? <p className="text-sm text-ink-muted">{t('usage.tokens.scopeMissing')}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg bg-[color:var(--color-control-fill)] p-1"
          role="group"
          aria-label={t('usage.tokens.range')}
        >
          {RANGES.map((id) => (
            <FilterChip
              key={id}
              inset
              label={t(rangeKey(id))}
              active={range === id}
              onClick={() => setRange(id)}
            />
          ))}
        </div>
        <SearchSelect
          size="sm"
          searchable={models.length > 8}
          allowClear={false}
          value={modelId}
          onChange={setModelId}
          disabled={!scopeReady || models.length === 0}
          options={[
            { value: 'all', label: t('usage.tokens.allModels') },
            ...models.map((id) => ({ value: id, label: shortId(id) })),
          ]}
          aria-label={t('usage.tokens.model')}
        />
      </div>

      <MetaSummary
        aria-label={t('usage.tokens.total')}
        items={[
          { id: 'tokens', label: t('usage.tokens.total'), value: formatCount(totals.tokens, locale) },
          { id: 'requests', label: t('usage.tokens.requests'), value: formatCount(totals.requests, locale) },
          {
            id: 'success',
            label: t('usage.tokens.success'),
            value: totals.requests === 0 ? '—' : `${Math.round((totals.succeeded / totals.requests) * 100)}%`,
          },
          { id: 'failed', label: t('usage.tokens.failed'), value: formatCount(totals.failed, locale) },
          { id: 'unmeasured', label: t('usage.tokens.unmeasured'), value: formatCount(totals.unmeasured, locale) },
        ]}
      />

      {totals.unmeasured > 0 ? (
        <p className="text-sm text-ink-muted">
          {t('usage.tokens.unmeasuredHint').replace('{count}', formatCount(totals.unmeasured, locale))}
        </p>
      ) : null}

      <ListToolbar
        primaryAction={
          empty ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!scopeReady}
              onClick={() => void load()}
            >
              {t('usage.refresh')}
            </Button>
          ) : undefined
        }
      />

      {empty ? (
        <ConsoleEmptyState
          variant="no-data"
          title={t('usage.tokens.empty')}
          description={t('usage.tokens.emptyBody')}
        />
      ) : (
        <>
          <section className="space-y-2" aria-label={t('usage.tokens.chart')}>
            <h2 className="text-xs text-ink-muted">
              {t('usage.tokens.chart')}
            </h2>
            <TokenBars
              series={series}
              peak={peak}
              label={t('usage.tokens.chart')}
              format={(value) => formatCount(value, locale)}
            />
          </section>
          <I18nDataTable
            rows={breakdown}
            rowKey={(row) => row.key}
            loading={loading}
            defaultPagination={{ page: 1, pageSize: 10 }}
            pageSizeOptions={[10, 20, 50]}
            onRefresh={() => load()}
            columns={[
              {
                id: 'model',
                header: t('usage.tokens.col.model'),
                cell: (row) => <span className="font-mono text-xs">{shortId(row.modelId)}</span>,
              },
              {
                id: 'endpoint',
                header: t('usage.tokens.col.endpoint'),
                cell: (row) => <span className="font-mono text-xs">{row.endpoint}</span>,
              },
              {
                id: 'tokens',
                header: t('usage.tokens.col.tokens'),
                cell: (row) => formatCount(row.tokens, locale),
              },
              {
                id: 'requests',
                header: t('usage.tokens.col.requests'),
                cell: (row) => formatCount(row.requests, locale),
              },
              {
                id: 'failed',
                header: t('usage.tokens.col.failed'),
                cell: (row) => formatCount(row.failed, locale),
              },
              {
                id: 'unmeasured',
                header: t('usage.tokens.col.unmeasured'),
                cell: (row) => formatCount(row.unmeasured, locale),
              },
            ]}
            empty={
              <ConsoleEmptyState
                variant="no-match"
                title={t('usage.tokens.empty')}
                description={t('usage.tokens.emptyBody')}
              />
            }
          />
        </>
      )}
    </AdminPageShell>
  );
}

function TokenBars({
  series,
  peak,
  label,
  format,
}: {
  series: DayPoint[];
  peak: number;
  label: string;
  format: (value: number) => string;
}) {
  if (series.length === 0 || peak <= 0) return null;
  const labelEvery = series.length <= 8 ? 1 : series.length <= 32 ? 5 : 14;
  return (
    <div className="space-y-1">
      <div className="flex h-44 items-end gap-px" role="img" aria-label={label}>
        {series.map((day) => {
          const height = Math.max(2, Math.round((day.tokens / peak) * 100));
          return (
            <div
              key={day.date}
              className="flex h-full min-w-0 flex-1 items-end"
              title={`${day.date} · ${format(day.tokens)}`}
            >
              <div
                className="w-full rounded-t-sm bg-[color:var(--color-text-link)]"
                style={{ height: day.tokens > 0 ? `${height}%` : '0%' }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-px text-[10px] text-ink-faint">
        {series.map((day, index) => (
          <span key={day.date} className="min-w-0 flex-1 truncate text-center">
            {index % labelEvery === 0 ? day.date.slice(5) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function rangeKey(id: RangeId): MessageKey {
  if (id === '7d') return 'usage.tokens.range.7d';
  if (id === '90d') return 'usage.tokens.range.90d';
  return 'usage.tokens.range.30d';
}

function boundsFor(range: RangeId) {
  const span = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (span - 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function eachDay(from: string, to: string) {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end && days.length < 100) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function dailySeries(from: string, to: string, rows: TokenRollup[]): DayPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.day, (totals.get(row.day) ?? 0) + row.totalTokens);
  }
  return eachDay(from, to).map((date) => ({ date, tokens: totals.get(date) ?? 0 }));
}

function sumRollups(rows: TokenRollup[]) {
  return rows.reduce(
    (acc, row) => {
      acc.tokens += row.totalTokens;
      acc.requests += row.requestCount;
      acc.succeeded += row.succeededCount;
      acc.failed += row.failedCount;
      acc.unmeasured += row.unknownMeasurementCount;
      return acc;
    },
    { tokens: 0, requests: 0, succeeded: 0, failed: 0, unmeasured: 0 },
  );
}

function breakdownRows(rows: TokenRollup[]): BreakRow[] {
  const grouped = new Map<string, BreakRow>();
  for (const row of rows) {
    const key = `${row.modelId}:${row.endpoint}`;
    const current = grouped.get(key) ?? {
      key,
      modelId: row.modelId,
      endpoint: row.endpoint,
      tokens: 0,
      requests: 0,
      failed: 0,
      unmeasured: 0,
    };
    current.tokens += row.totalTokens;
    current.requests += row.requestCount;
    current.failed += row.failedCount;
    current.unmeasured += row.unknownMeasurementCount;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((left, right) => right.tokens - left.tokens);
}

function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US').format(value);
}
