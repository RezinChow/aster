import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  ConsoleDrawer,
  ConsoleEmptyState,
  FilterChip,
  ListToolbar,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  getCloudFunction,
  listCloudFunctionRuns,
  listCloudFunctions,
  type CloudFunctionDetail,
  type CloudFunctionRelease,
  type CloudFunctionRun,
  type CloudFunctionSummary,
} from '@/lib/functionsApi';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';

type ModeFilter = 'all' | 'hosted_task' | 'hosted_service' | 'external' | 'unbound';
type RunFilter = 'all' | 'failed';

function modeTone(mode: string | undefined): BadgeTone {
  switch (mode) {
    case 'hosted_task':
      return 'primary';
    case 'hosted_service':
      return 'success';
    case 'external':
      return 'warn';
    default:
      return 'neutral';
  }
}

function assetStateTone(state: string): BadgeTone {
  switch (state) {
    case 'active':
    case 'published':
    case 'ready':
    case 'succeeded':
      return 'success';
    case 'archived':
    case 'yanked':
    case 'cancelled':
      return 'neutral';
    case 'failed':
      return 'danger';
    case 'running':
    case 'queued':
    case 'scheduled':
      return 'primary';
    default:
      return 'neutral';
  }
}

function modeLabel(
  mode: string | undefined,
  labels: { task: string; service: string; external: string; unbound: string },
) {
  switch (mode) {
    case 'hosted_task':
      return labels.task;
    case 'hosted_service':
      return labels.service;
    case 'external':
      return labels.external;
    default:
      return labels.unbound;
  }
}

const STATUS_KEY: Record<string, MessageKey> = {
  active: 'functions.state.active',
  archived: 'functions.state.archived',
  draft: 'functions.release.draft',
  published: 'functions.release.published',
  yanked: 'functions.release.yanked',
  queued: 'functions.run.queued',
  scheduled: 'functions.run.scheduled',
  running: 'functions.run.running',
  cancelling: 'functions.run.cancelling',
  cleanup_pending: 'functions.run.cleanupPending',
  succeeded: 'functions.run.succeeded',
  failed: 'functions.run.failed',
  cancelled: 'functions.run.cancelled',
};

function statusText(value: string, translate: (key: MessageKey) => string) {
  const key = STATUS_KEY[value];
  return key ? translate(key) : value;
}

function rowMode(row: CloudFunctionSummary): Exclude<ModeFilter, 'all'> {
  const mode = row.latestRelease?.profile?.mode;
  if (mode === 'hosted_task' || mode === 'hosted_service' || mode === 'external') {
    return mode;
  }
  return 'unbound';
}

function formatTimeoutMs(value: number | null | undefined, dash: string) {
  if (value == null) return dash;
  if (value < 1000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} s`;
  return `${(value / 60_000).toFixed(value % 60_000 === 0 ? 0 : 1)} min`;
}

function formatDurationMs(value: number | null | undefined, dash: string) {
  if (value == null) return dash;
  if (value < 1000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(2)} s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = ((value % 60_000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

function medianMs(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function shortDigest(value: string | undefined) {
  if (!value) return '—';
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}

function formatWhen(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'en' ? 'en' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function latestProfile(row: CloudFunctionSummary) {
  return row.latestRelease?.profile ?? null;
}

function isFailedRun(run: CloudFunctionRun) {
  return run.status === 'failed';
}

export function FunctionsPage() {
  const { t, locale } = useI18n();
  const scope = useCloudScopeContext();
  const tRef = useRef(t);
  tRef.current = t;
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<ModeFilter>('all');
  const [rows, setRows] = useState<CloudFunctionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CloudFunctionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [runs, setRuns] = useState<CloudFunctionRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [runFilter, setRunFilter] = useState<RunFilter>('all');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listCloudFunctions());
    } catch (err) {
      setRows([]);
      setError(
        err instanceof ApiRequestError
          ? err.message
          : tRef.current('functions.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setRuns([]);
      setRunsError(null);
      setRunFilter('all');
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setRunFilter('all');
    void getCloudFunction(selectedId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(
          err instanceof ApiRequestError
            ? err.message
            : tRef.current('functions.detailFailed'),
        );
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || !scope.projectId || !scope.envId) {
      setRuns([]);
      setRunsError(null);
      return;
    }
    let cancelled = false;
    setRunsLoading(true);
    setRunsError(null);
    void listCloudFunctionRuns(selectedId, {
      projectId: scope.projectId,
      environmentId: scope.envId,
      limit: 50,
    })
      .then((next) => {
        if (!cancelled) setRuns(next);
      })
      .catch((err) => {
        if (cancelled) return;
        setRuns([]);
        setRunsError(
          err instanceof ApiRequestError
            ? err.message
            : tRef.current('functions.runsFailed'),
        );
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, scope.projectId, scope.envId]);

  const modeCounts = useMemo(() => {
    const counts: Record<ModeFilter, number> = {
      all: rows.length,
      hosted_task: 0,
      hosted_service: 0,
      external: 0,
      unbound: 0,
    };
    for (const row of rows) counts[rowMode(row)] += 1;
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (mode !== 'all' && rowMode(row) !== mode) return false;
      if (!needle) return true;
      const profile = latestProfile(row);
      return (
        row.name.toLowerCase().includes(needle) ||
        row.assetId.toLowerCase().includes(needle) ||
        row.state.toLowerCase().includes(needle) ||
        (row.latestRelease?.version ?? '').toLowerCase().includes(needle) ||
        (profile?.mode ?? '').toLowerCase().includes(needle)
      );
    });
  }, [mode, q, rows]);

  const filtersActive = q.trim() !== '' || mode !== 'all';
  const modeLabels = {
    task: t('functions.mode.hostedTask'),
    service: t('functions.mode.hostedService'),
    external: t('functions.mode.external'),
    unbound: t('functions.mode.unbound'),
  };
  const labelStatus = (value: string) => statusText(value, t);
  const scopeReady = Boolean(scope.projectId && scope.envId);
  const drawerDescription = detail
    ? [
        detail.releases[0]?.version,
        scopeReady ? `${scope.projectLabel} / ${scope.envLabel}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  const modeFilters: Array<{ value: ModeFilter; label: string }> = [
    { value: 'all', label: t('functions.filter.all') },
    { value: 'hosted_task', label: modeLabels.task },
    { value: 'hosted_service', label: modeLabels.service },
    { value: 'external', label: modeLabels.external },
    { value: 'unbound', label: modeLabels.unbound },
  ];

  return (
    <AdminPageShell title={t('nav.functions')} description={t('nav.functionsDesc')}>
      {error ? <AppErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('functions.search')}
        filters={
          <div
            className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
            role="group"
            aria-label={t('functions.filterMode')}
          >
            {modeFilters.map((item) => (
              <FilterChip
                key={item.value}
                inset
                label={item.label}
                count={modeCounts[item.value]}
                active={mode === item.value}
                onClick={() => setMode(item.value)}
              />
            ))}
          </div>
        }
      />

      <I18nDataTable
        rows={filtered}
        rowKey={(row) => row.assetId}
        loading={loading}
        onRefresh={reload}
        selectedRowKey={selectedId}
        onRowClick={(row) => setSelectedId(row.assetId)}
        empty={
          <ConsoleEmptyState
            title={filtersActive ? t('functions.emptyFiltered') : t('functions.empty')}
            description={
              filtersActive ? t('functions.emptyFilteredHint') : t('functions.emptyHint')
            }
            variant={filtersActive ? 'no-match' : 'no-data'}
            onClearFilters={
              filtersActive
                ? () => {
                    setQ('');
                    setMode('all');
                  }
                : undefined
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
          />
        }
        columns={[
          {
            id: 'name',
            header: t('functions.col.name'),
            sortable: true,
            getSortValue: (row) => row.name,
            cell: (row) => <span className="font-medium text-ink">{row.name}</span>,
          },
          {
            id: 'release',
            header: t('functions.col.release'),
            cell: (row) => (
              <span className="font-mono text-xs text-ink">
                {row.latestRelease?.version ?? '—'}
              </span>
            ),
          },
          {
            id: 'mode',
            header: t('functions.col.mode'),
            cell: (row) => {
              const next = latestProfile(row)?.mode;
              return (
                <Badge tone={modeTone(next)}>{modeLabel(next, modeLabels)}</Badge>
              );
            },
          },
          {
            id: 'concurrency',
            header: t('functions.col.concurrency'),
            cell: (row) => {
              const value = latestProfile(row)?.maxConcurrency;
              return (
                <span className="tabular-nums text-ink">
                  {value == null ? '—' : value}
                </span>
              );
            },
          },
          {
            id: 'timeout',
            header: t('functions.col.timeout'),
            cell: (row) => (
              <span className="tabular-nums text-ink">
                {formatTimeoutMs(latestProfile(row)?.timeoutMs, '—')}
              </span>
            ),
          },
          {
            id: 'state',
            header: t('functions.col.state'),
            sortable: true,
            getSortValue: (row) => row.state,
            cell: (row) => (
              <Badge tone={assetStateTone(row.state)}>{labelStatus(row.state)}</Badge>
            ),
          },
        ]}
        defaultPagination={{ page: 1, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
      />

      <ConsoleDrawer
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={detail?.name ?? t('functions.detail.title')}
        description={drawerDescription}
        className="!w-[min(100%,42rem)]"
      >
        {detailLoading ? (
          <p className="text-sm text-ink-muted">{t('functions.detail.loading')}</p>
        ) : null}
        {detailError ? <AppErrorBanner message={detailError} /> : null}
        {detail && !detailLoading ? (
          <FunctionDetailBody
            detail={detail}
            runs={runs}
            runsLoading={runsLoading}
            runsError={runsError}
            scopeReady={scopeReady}
            runFilter={runFilter}
            onRunFilter={setRunFilter}
            locale={locale}
            statusLabel={labelStatus}
            labels={{
              releases: t('functions.detail.releases'),
              runs: t('functions.detail.runs'),
              runsHint: t('functions.detail.runsHint'),
              state: t('functions.col.state'),
              mode: t('functions.col.mode'),
              concurrency: t('functions.col.concurrency'),
              timeout: t('functions.col.timeout'),
              artifact: t('functions.detail.artifact'),
              requested: t('functions.col.requested'),
              duration: t('functions.col.duration'),
              exit: t('functions.col.exit'),
              reason: t('functions.col.reason'),
              recent: t('functions.detail.recent'),
              runCount: t('functions.detail.runCount'),
              failed: t('functions.detail.failed'),
              median: t('functions.detail.median'),
              runFilter: t('functions.runs.filter'),
              runsAll: t('functions.runs.all'),
              runsFailed: t('functions.runs.failedOnly'),
              noReleases: t('functions.detail.noReleases'),
              noRuns: t('functions.detail.noRuns'),
              noArtifact: t('functions.detail.noArtifact'),
              needScope: t('functions.detail.needScope'),
              task: modeLabels.task,
              service: modeLabels.service,
              external: modeLabels.external,
              unbound: modeLabels.unbound,
            }}
          />
        ) : null}
      </ConsoleDrawer>
    </AdminPageShell>
  );
}

function FunctionDetailBody({
  detail,
  runs,
  runsLoading,
  runsError,
  scopeReady,
  runFilter,
  onRunFilter,
  locale,
  statusLabel,
  labels,
}: {
  detail: CloudFunctionDetail;
  runs: CloudFunctionRun[];
  runsLoading: boolean;
  runsError: string | null;
  scopeReady: boolean;
  runFilter: RunFilter;
  onRunFilter: (next: RunFilter) => void;
  locale: string;
  statusLabel: (value: string) => string;
  labels: {
    releases: string;
    runs: string;
    runsHint: string;
    state: string;
    mode: string;
    concurrency: string;
    timeout: string;
    artifact: string;
    requested: string;
    duration: string;
    exit: string;
    reason: string;
    recent: string;
    runCount: string;
    failed: string;
    median: string;
    runFilter: string;
    runsAll: string;
    runsFailed: string;
    noReleases: string;
    noRuns: string;
    noArtifact: string;
    needScope: string;
    task: string;
    service: string;
    external: string;
    unbound: string;
  };
}) {
  const primary = detail.releases[0] ?? null;
  const profile = primary?.profile ?? null;
  const hasArtifact = detail.releases.some((release) =>
    Boolean(release.profile?.artifactDigest),
  );
  const failedCount = runs.filter(isFailedRun).length;
  const median = medianMs(
    runs.flatMap((run) => (run.durationMs == null ? [] : [run.durationMs])),
  );
  const visibleRuns =
    runFilter === 'failed' ? runs.filter(isFailedRun) : runs;

  return (
    <div className="space-y-5 text-sm">
      <dl className="grid grid-cols-[5.5rem_1fr] gap-y-2">
        <dt className="text-ink-muted">{labels.state}</dt>
        <dd>
          <Badge tone={assetStateTone(detail.state)}>{statusLabel(detail.state)}</Badge>
        </dd>
        <dt className="text-ink-muted">{labels.mode}</dt>
        <dd>
          <Badge tone={modeTone(profile?.mode)}>
            {modeLabel(profile?.mode, labels)}
          </Badge>
        </dd>
        <dt className="text-ink-muted">{labels.concurrency}</dt>
        <dd className="tabular-nums">{profile?.maxConcurrency ?? '—'}</dd>
        <dt className="text-ink-muted">{labels.timeout}</dt>
        <dd className="tabular-nums">{formatTimeoutMs(profile?.timeoutMs, '—')}</dd>
        <dt className="text-ink-muted">{labels.artifact}</dt>
        <dd className="break-all font-mono text-[11px]" title={profile?.artifactDigest ?? undefined}>
          {shortDigest(profile?.artifactDigest ?? undefined)}
        </dd>
      </dl>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-xs text-ink-faint">
              {labels.runs}
            </h3>
            {scopeReady ? (
              <p className="mt-1 max-w-prose text-[11px] leading-4 text-ink-muted">
                {labels.runsHint}
              </p>
            ) : null}
          </div>
          {scopeReady && runs.length > 0 ? (
            <div
              className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg bg-[color:var(--color-control-fill)] p-1"
              role="group"
              aria-label={labels.runFilter}
            >
              <FilterChip
                inset
                label={labels.runsAll}
                count={runs.length}
                active={runFilter === 'all'}
                onClick={() => onRunFilter('all')}
              />
              <FilterChip
                inset
                label={labels.runsFailed}
                count={failedCount}
                active={runFilter === 'failed'}
                onClick={() => onRunFilter('failed')}
              />
            </div>
          ) : null}
        </div>

        {runsError ? <AppErrorBanner message={runsError} /> : null}
        {!scopeReady ? (
          <p className="text-[11px] text-ink-muted">{labels.needScope}</p>
        ) : null}
        {scopeReady && !hasArtifact && !runsLoading && runs.length === 0 ? (
          <p className="text-[11px] text-ink-muted">{labels.noArtifact}</p>
        ) : null}
        {scopeReady && hasArtifact && runsLoading ? (
          <p className="text-[11px] text-ink-muted">{labels.recent}…</p>
        ) : null}
        {scopeReady && hasArtifact && !runsLoading && !runsError && runs.length === 0 ? (
          <p className="text-[11px] text-ink-muted">{labels.noRuns}</p>
        ) : null}

        {runs.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 py-1">
              <Stat
                label={`${labels.recent} · ${labels.runCount}`}
                value={String(runs.length)}
              />
              <Stat
                label={labels.failed}
                value={String(failedCount)}
                danger={failedCount > 0}
              />
              <Stat
                label={labels.median}
                value={formatDurationMs(median, '—')}
              />
            </div>
            <div className="overflow-x-auto border-y border-border/60">
              <table className="w-full min-w-[28rem] text-left text-[11px]">
                <thead>
                  <tr className="text-ink-faint">
                    <th className="py-1.5 pr-3 font-medium">{labels.requested}</th>
                    <th className="py-1.5 pr-3 font-medium">{labels.state}</th>
                    <th className="py-1.5 pr-3 font-medium">{labels.duration}</th>
                    <th className="py-1.5 pr-3 font-medium">{labels.exit}</th>
                    <th className="py-1.5 font-medium">{labels.reason}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRuns.map((run) => {
                    const reason = run.failureReason?.trim() || '—';
                    return (
                      <tr
                        key={run.executionId}
                        className="border-t border-border/60 align-top"
                      >
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-ink-muted">
                          <span title={run.executionId}>
                            {formatWhen(run.requestedAt, locale)}
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone={assetStateTone(run.status)}>{statusLabel(run.status)}</Badge>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-ink">
                          {formatDurationMs(run.durationMs, '—')}
                        </td>
                        <td className="py-2 pr-3 tabular-nums text-ink">
                          {run.exitCode ?? '—'}
                        </td>
                        <td className="max-w-[14rem] py-2 text-ink" title={reason}>
                          <span className="line-clamp-2 break-words">{reason}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visibleRuns.length === 0 ? (
              <p className="text-[11px] text-ink-muted">{labels.noRuns}</p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs text-ink-faint">
          {labels.releases}
        </h3>
        {detail.releases.length === 0 ? (
          <p className="text-[11px] text-ink-muted">{labels.noReleases}</p>
        ) : (
          <ul className="divide-y divide-border/60 border-y border-border/60">
            {detail.releases.map((release) => (
              <ReleaseRow
                key={release.releaseId}
                release={release}
                statusLabel={statusLabel}
                labels={labels}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0 border-l border-border/70 pl-3">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div
        className={`mt-0.5 text-sm font-medium tabular-nums ${
          danger ? 'text-danger' : 'text-ink'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function ReleaseRow({
  release,
  statusLabel,
  labels,
}: {
  release: CloudFunctionRelease;
  statusLabel: (value: string) => string;
  labels: {
    concurrency: string;
    timeout: string;
    unbound: string;
    task: string;
    service: string;
    external: string;
  };
}) {
  const profile = release.profile;
  const meta = profile
    ? [
        modeLabel(profile.mode, labels),
        profile.maxConcurrency == null ? null : `${labels.concurrency} ${profile.maxConcurrency}`,
        profile.timeoutMs == null ? null : formatTimeoutMs(profile.timeoutMs, '—'),
      ]
        .filter(Boolean)
        .join(' · ')
    : labels.unbound;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <div className="font-mono text-xs text-ink">{release.version}</div>
        <div className="mt-0.5 text-[11px] text-ink-muted">{meta}</div>
      </div>
      <Badge tone={assetStateTone(release.state)}>{statusLabel(release.state)}</Badge>
    </li>
  );
}
