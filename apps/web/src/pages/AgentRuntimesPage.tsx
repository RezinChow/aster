import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  ConsoleConfirmDialog,
  ConsoleDrawer,
  ConsoleEmptyState,
  FilterChip,
  ListToolbar,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  getCloudAgentRuntime,
  getCloudAgentRuntimeLogs,
  listCloudAgentRuntimes,
  stopCloudAgentRuntime,
  type CloudAgentRuntimeLogPage,
  type CloudAgentRuntimeLogRecord,
  type CloudAgentRuntimeProjection,
} from '@/lib/agentRuntimeApi';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';

const DASH = '—';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_ORDER = [
  'running',
  'pending',
  'cancelling',
  'succeeded',
  'completed',
  'failed',
  'cancelled',
] as const;

const STATUS_KEY: Record<string, MessageKey> = {
  running: 'agentRuntimes.status.running',
  pending: 'agentRuntimes.status.pending',
  succeeded: 'agentRuntimes.status.succeeded',
  completed: 'agentRuntimes.status.completed',
  failed: 'agentRuntimes.status.failed',
  cancelled: 'agentRuntimes.status.cancelled',
  cancelling: 'agentRuntimes.status.cancelling',
};

const LOG_KIND: Record<string, MessageKey> = {
  execution_requested: 'agentRuntimes.log.execution_requested',
  model_output: 'agentRuntimes.log.model_output',
  tool_request: 'agentRuntimes.log.tool_request',
  tool_result: 'agentRuntimes.log.tool_result',
  approval_resolved: 'agentRuntimes.log.approval_resolved',
  execution_failed: 'agentRuntimes.log.execution_failed',
  execution_completed: 'agentRuntimes.log.execution_completed',
  execution_cancelled: 'agentRuntimes.log.execution_cancelled',
};

const OUTCOME_KEY: Record<string, MessageKey> = {
  succeeded: 'agentRuntimes.log.outcome.succeeded',
  failed: 'agentRuntimes.log.outcome.failed',
  approved: 'agentRuntimes.log.outcome.approved',
  denied: 'agentRuntimes.log.outcome.denied',
  expired: 'agentRuntimes.log.outcome.expired',
};

type Query =
  | { kind: 'conversation'; id: string }
  | { kind: 'execution'; id: string };

function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'running':
    case 'pending':
      return 'primary';
    case 'cancelling':
      return 'warn';
    case 'succeeded':
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function canStop(status: string): boolean {
  return status === 'running' || status === 'pending';
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

function clip(value: string, max = 180): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function textAt(value: unknown, key: string): string | null {
  const field = asRecord(value)?.[key];
  return typeof field === 'string' && field.trim() ? field.trim() : null;
}

function toolName(value: unknown): string | null {
  return textAt(asRecord(value)?.tool, 'name');
}

function formatWhen(value: string, locale: string): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function failureKey(err: unknown, fallback: MessageKey): MessageKey {
  if (err instanceof ApiRequestError) {
    const message = err.message.toLowerCase();
    if (err.code === 404 || message.includes('not found')) {
      return 'agentRuntimes.notFound';
    }
    if (
      err.code === 401 ||
      err.code === 403 ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('permission')
    ) {
      return 'agentRuntimes.forbidden';
    }
  }
  return fallback;
}

/**
 * Agents in the current Cloud scope.
 * A pasted conversation or execution ID loads rows through the list toolbar.
 * Stop is only offered while a run is still in progress.
 */
export function AgentRuntimesPage() {
  const { t, locale } = useI18n();
  const scope = useCloudScopeContext();
  const orgReady = Boolean(scope.cloudOrganizationId);
  const [rows, setRows] = useState<CloudAgentRuntimeProjection[]>([]);
  const [queried, setQueried] = useState(false);
  const [pending, setPending] = useState<'load' | 'stop' | null>(null);
  const [pageError, setPageError] = useState<MessageKey | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logs, setLogs] = useState<CloudAgentRuntimeLogPage | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<MessageKey | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [stopError, setStopError] = useState<MessageKey | null>(null);
  const [copied, setCopied] = useState(false);
  const lastQuery = useRef<Query | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const loadId = useCallback(async (id: string) => {
    setPending('load');
    setPageError(null);
    setSelectedId(null);
    setStatusFilter('all');
    try {
      let list: CloudAgentRuntimeProjection[] = [];
      let listed = false;
      try {
        list = await listCloudAgentRuntimes(id, 50);
        listed = true;
      } catch (err) {
        if (failureKey(err, 'agentRuntimes.loadFailed') !== 'agentRuntimes.notFound') {
          throw err;
        }
      }
      let kind: Query['kind'] = 'conversation';
      if (list.length === 0) {
        try {
          list = [await getCloudAgentRuntime(id)];
          kind = 'execution';
        } catch (err) {
          if (
            listed &&
            failureKey(err, 'agentRuntimes.openFailed') === 'agentRuntimes.notFound'
          ) {
            list = [];
          } else {
            throw err;
          }
        }
      }
      lastQuery.current = { kind, id };
      setRows(list);
      setQueried(true);
    } catch (err) {
      setRows([]);
      setQueried(true);
      setPageError(failureKey(err, 'agentRuntimes.loadFailed'));
    } finally {
      setPending(null);
    }
  }, []);

  useEffect(() => {
    const id = search.trim();
    if (!orgReady || !UUID_RE.test(id)) return;
    if (lastQuery.current?.id === id) return;
    lastQuery.current = { kind: 'conversation', id };
    void loadId(id);
  }, [loadId, orgReady, search]);

  const onRefresh = useCallback(() => {
    const id = lastQuery.current?.id ?? search.trim();
    if (!UUID_RE.test(id)) return;
    void loadId(id);
  }, [loadId, search]);

  useEffect(() => {
    if (!selectedId) {
      setLogs(null);
      setLogsError(null);
      setLogsLoading(false);
      return;
    }
    let cancelled = false;
    setLogs(null);
    setLogsError(null);
    setLogsLoading(true);
    void getCloudAgentRuntimeLogs(selectedId, { limit: 50 })
      .then((page) => {
        if (!cancelled) setLogs(page);
      })
      .catch((err) => {
        if (!cancelled) setLogsError(failureKey(err, 'agentRuntimes.logsFailed'));
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const loadMoreLogs = useCallback(async () => {
    if (!selectedId || !logs?.nextCursor || logsLoading) return;
    setLogsLoading(true);
    setLogsError(null);
    try {
      const page = await getCloudAgentRuntimeLogs(selectedId, {
        limit: 50,
        cursor: logs.nextCursor,
      });
      setLogs((current) => {
        const seen = new Set((current?.records ?? []).map((row) => row.sequence));
        const extra = page.records.filter((row) => !seen.has(row.sequence));
        return {
          executionId: page.executionId || current?.executionId || '',
          records: [...(current?.records ?? []), ...extra],
          nextCursor: page.nextCursor,
        };
      });
    } catch (err) {
      setLogsError(failureKey(err, 'agentRuntimes.logsFailed'));
    } finally {
      setLogsLoading(false);
    }
  }, [logs?.nextCursor, logsLoading, selectedId]);

  const confirmStop = useCallback(async () => {
    if (!stopId) return;
    setPending('stop');
    setStopError(null);
    try {
      const mutation = await stopCloudAgentRuntime(stopId);
      const next = mutation.projection;
      setRows((prev) =>
        prev.map((row) =>
          row.agentExecutionId === next.agentExecutionId ? next : row,
        ),
      );
      setStopId(null);
    } catch (err) {
      const key = failureKey(err, 'agentRuntimes.stopFailed');
      setStopError(key);
      setPageError(key);
      throw err;
    } finally {
      setPending(null);
    }
  }, [stopId]);

  const copyExecutionId = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, []);

  const statusLabel = useCallback(
    (status: string) => {
      const key = STATUS_KEY[status];
      return key ? t(key) : status;
    },
    [t],
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  const statusFilters = useMemo(() => {
    const known = STATUS_ORDER.filter((status) => statusCounts.has(status));
    const extra = [...statusCounts.keys()].filter(
      (status) => !STATUS_ORDER.includes(status as (typeof STATUS_ORDER)[number]),
    );
    return [...known, ...extra];
  }, [statusCounts]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        row.agentExecutionId.toLowerCase().includes(needle) ||
        row.conversationId.toLowerCase().includes(needle) ||
        row.operationId.toLowerCase().includes(needle) ||
        row.status.toLowerCase().includes(needle) ||
        statusLabel(row.status).toLowerCase().includes(needle)
      );
    });
  }, [rows, search, statusFilter, statusLabel]);

  const needle = search.trim();
  const filtersActive =
    statusFilter !== 'all' || (needle !== '' && !UUID_RE.test(needle));
  const selected = rows.find((row) => row.agentExecutionId === selectedId) ?? null;
  const busy = pending != null;

  return (
    <AdminPageShell
      title={t('nav.agentRuntimes')}
      description={t('nav.agentRuntimesDesc')}
    >
      {pageError ? (
        <AppErrorBanner message={t(pageError)} onRetry={onRefresh} />
      ) : null}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('agentRuntimes.search')}
        filters={
          <div
            className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
            role="group"
            aria-label={t('agentRuntimes.filter.status')}
          >
            <FilterChip
              inset
              label={t('agentRuntimes.filter.all')}
              count={rows.length}
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            {statusFilters.map((status) => (
              <FilterChip
                key={status}
                inset
                label={statusLabel(status)}
                count={statusCounts.get(status) ?? 0}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              />
            ))}
          </div>
        }
      />

      {!orgReady ? (
        <ConsoleEmptyState title={t('agentRuntimes.needSession')} />
      ) : (
        <I18nDataTable
            rows={filtered}
            rowKey={(row) => row.agentExecutionId}
            loading={pending === 'load'}
            onRefresh={queried ? onRefresh : undefined}
            selectedRowKey={selectedId}
            onRowClick={(row) => setSelectedId(row.agentExecutionId)}
            empty={
              <ConsoleEmptyState
                title={
                  filtersActive
                    ? t('agentRuntimes.emptyFiltered')
                    : t('agentRuntimes.empty.title')
                }
                variant={filtersActive ? 'no-match' : 'no-data'}
                onClearFilters={
                  filtersActive
                    ? () => {
                        setSearch('');
                        setStatusFilter('all');
                      }
                    : undefined
                }
                clearFiltersLabel={t('admin.empty.clearFilters')}
              />
            }
            columns={[
              {
                id: 'execution',
                header: t('agentRuntimes.col.execution'),
                cell: (row) => (
                  <span className="font-mono text-xs text-ink">
                    {shortId(row.agentExecutionId)}
                  </span>
                ),
              },
              {
                id: 'status',
                header: t('agentRuntimes.col.status'),
                cell: (row) => (
                  <Badge tone={statusTone(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                ),
              },
              {
                id: 'bound',
                header: t('agentRuntimes.col.bound'),
                cell: (row) => (
                  <Badge tone={row.fullyBound ? 'success' : 'neutral'}>
                    {row.fullyBound
                      ? t('agentRuntimes.bound.yes')
                      : t('agentRuntimes.bound.partial')}
                  </Badge>
                ),
              },
            ]}
            defaultPagination={{ page: 1, pageSize: 10 }}
            pageSizeOptions={[10, 20, 50]}
          />
      )}

      <ConsoleDrawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected ? shortId(selected.agentExecutionId) : t('agentRuntimes.detail.title')}
        className="!w-[min(100%,42rem)]"
        footer={
          selected && canStop(selected.status) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="!border-[color:var(--color-error)] !text-[color:var(--color-error)]"
              disabled={busy}
              onClick={() => {
                setStopError(null);
                setStopId(selected.agentExecutionId);
              }}
            >
              {t('agentRuntimes.action.stop')}
            </Button>
          ) : null
        }
      >
        {selected ? (
          <RunDetail
            row={selected}
            logs={logs}
            logsLoading={logsLoading}
            logsError={logsError}
            copied={copied}
            locale={locale}
            scopeProjectId={scope.projectId}
            scopeEnvId={scope.envId}
            scopeProjectLabel={scope.projectLabel}
            scopeEnvLabel={scope.envLabel}
            statusLabel={statusLabel}
            onCopy={() => void copyExecutionId(selected.agentExecutionId)}
            onLoadMore={() => void loadMoreLogs()}
            t={t}
          />
        ) : null}
      </ConsoleDrawer>

      <ConsoleConfirmDialog
        open={stopId != null}
        onOpenChange={(open) => {
          if (!open && pending !== 'stop') {
            setStopId(null);
            setStopError(null);
          }
        }}
        title={t('agentRuntimes.stop.title')}
        confirmLabel={t('agentRuntimes.stop.confirm')}
        cancelLabel={t('agentRuntimes.stop.cancel')}
        tone="danger"
        loading={pending === 'stop'}
        onConfirm={confirmStop}
      >
        {stopError ? (
          <p className="text-sm text-[color:var(--color-error)]">{t(stopError)}</p>
        ) : null}
      </ConsoleConfirmDialog>
    </AdminPageShell>
  );
}

function RunDetail({
  row,
  logs,
  logsLoading,
  logsError,
  copied,
  locale,
  scopeProjectId,
  scopeEnvId,
  scopeProjectLabel,
  scopeEnvLabel,
  statusLabel,
  onCopy,
  onLoadMore,
  t,
}: {
  row: CloudAgentRuntimeProjection;
  logs: CloudAgentRuntimeLogPage | null;
  logsLoading: boolean;
  logsError: MessageKey | null;
  copied: boolean;
  locale: string;
  scopeProjectId: string;
  scopeEnvId: string;
  scopeProjectLabel: string;
  scopeEnvLabel: string;
  statusLabel: (status: string) => string;
  onCopy: () => void;
  onLoadMore: () => void;
  t: (key: MessageKey) => string;
}) {
  const projectName =
    scopeProjectId === row.projectId && scopeProjectLabel ? scopeProjectLabel : '';
  const envName = scopeEnvId === row.environmentId && scopeEnvLabel ? scopeEnvLabel : '';

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
        <Badge tone={row.fullyBound ? 'success' : 'neutral'}>
          {row.fullyBound ? t('agentRuntimes.bound.yes') : t('agentRuntimes.bound.partial')}
        </Badge>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact
          label={t('agentRuntimes.col.execution')}
          value={row.agentExecutionId}
          action={
            <Button type="button" size="sm" variant="ghost" onClick={onCopy}>
              {copied ? t('agentRuntimes.action.copied') : t('agentRuntimes.action.copy')}
            </Button>
          }
        />
        <Fact label={t('agentRuntimes.col.conversation')} value={row.conversationId} />
        <Fact label={t('agentRuntimes.col.operation')} value={row.operationId} />
        <Fact
          label={t('agentRuntimes.col.project')}
          value={row.projectId}
          name={projectName}
        />
        <Fact
          label={t('agentRuntimes.col.environment')}
          value={row.environmentId}
          name={envName}
        />
      </dl>

      <dl className="grid grid-cols-1 gap-y-2">
        <Digest
          label={t('agentRuntimes.col.profileDigest')}
          value={row.harnessInvocationProfileDigest}
        />
        <Digest
          label={t('agentRuntimes.col.workspaceDigest')}
          value={row.workspaceMaterializationDigest}
        />
        <Digest
          label={t('agentRuntimes.col.egressDigest')}
          value={row.egressPolicyDigest}
        />
      </dl>

      <section className="space-y-2">
        <h3 className="font-medium text-ink">{t('agentRuntimes.detail.logs')}</h3>
        {logsError ? <AppErrorBanner message={t(logsError)} /> : null}
        {logsLoading && !logs ? (
          <p className="text-ink-muted">{t('agentRuntimes.detail.logsLoading')}</p>
        ) : null}
        {logs && logs.records.length === 0 && !logsLoading ? (
          <p className="text-ink-muted">{t('agentRuntimes.detail.logsEmpty')}</p>
        ) : null}
        {logs && logs.records.length > 0 ? (
          <ol className="space-y-2">
            {logs.records.map((record) => (
              <LogEvent
                key={record.sequence}
                record={record}
                locale={locale}
                t={t}
              />
            ))}
          </ol>
        ) : null}
        {logs?.nextCursor ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={logsLoading}
            loading={logsLoading}
            onClick={onLoadMore}
          >
            {t('agentRuntimes.action.loadMore')}
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function Fact({
  label,
  value,
  name,
  action,
}: {
  label: string;
  value: string;
  name?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0">
        {name ? <div className="text-ink">{name}</div> : null}
        <div className="flex items-start gap-2">
          <span className="min-w-0 break-all font-mono text-xs text-ink">{value || DASH}</span>
          {action}
        </div>
      </dd>
    </div>
  );
}

function Digest({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={value ? 'break-all font-mono text-xs text-ink' : 'text-ink-muted'}>
        {value || DASH}
      </dd>
    </div>
  );
}

function LogEvent({
  record,
  locale,
  t,
}: {
  record: CloudAgentRuntimeLogRecord;
  locale: string;
  t: (key: MessageKey) => string;
}) {
  const kindKey = LOG_KIND[record.kind];
  const summary = eventSummary(record, t);
  return (
    <li className="rounded-md bg-[color:var(--color-control-fill)] px-3 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-ink">
          {kindKey ? t(kindKey) : record.kind || DASH}
        </span>
        <span className="text-xs tabular-nums text-ink-muted">
          #{record.sequence}
          {record.occurredAt ? ` · ${formatWhen(record.occurredAt, locale)}` : ''}
        </span>
      </div>
      {summary ? <p className="mt-1 text-ink">{summary}</p> : null}
    </li>
  );
}

function eventSummary(
  record: CloudAgentRuntimeLogRecord,
  t: (key: MessageKey) => string,
): string | null {
  const content = record.content;
  if (record.kind === 'model_output') {
    const text = textAt(content, 'text');
    return text ? clip(text) : null;
  }
  if (record.kind === 'tool_request') {
    return toolName(content);
  }
  if (record.kind === 'tool_result') {
    const name = toolName(content);
    const outcome = outcomeLabel(textAt(content, 'outcome'), t);
    return [name, outcome].filter(Boolean).join(' · ') || null;
  }
  if (record.kind === 'execution_failed') {
    const reason = textAt(content, 'reason');
    return reason ? clip(reason) : null;
  }
  if (record.kind === 'approval_resolved') {
    return outcomeLabel(textAt(content, 'outcome'), t);
  }
  return null;
}

function outcomeLabel(
  outcome: string | null,
  t: (key: MessageKey) => string,
): string | null {
  if (!outcome) return null;
  const key = OUTCOME_KEY[outcome];
  return key ? t(key) : outcome;
}
