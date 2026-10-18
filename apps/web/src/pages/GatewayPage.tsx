import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  ConsoleEmptyState,
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
  listLocalGatewayServices,
  type GatewayCoverage,
  type GatewayLive,
  type GatewayMatch,
  type GatewayPlatformRoute,
  type GatewayStandard,
  type GatewaySurface,
} from '@/lib/gatewayApi';
import { fill } from '@/pages/settings/configKit';

/** Matches the gateway's own health-check interval in the local ACL. */
export const GATEWAY_POLL_MS = 5_000;

type Translate = (key: MessageKey) => string;

const STANDARD_LABEL: Record<string, MessageKey> = {
  'openai.models': 'gateway.standard.openai.models',
  'openai.chat': 'gateway.standard.openai.chat',
  'openai.completions': 'gateway.standard.openai.completions',
  'openai.embeddings': 'gateway.standard.openai.embeddings',
  'openai.responses': 'gateway.standard.openai.responses',
  'anthropic.messages': 'gateway.standard.anthropic.messages',
  rerank: 'gateway.standard.rerank',
  ocr: 'gateway.standard.ocr',
  'decision.systemone': 'gateway.standard.decision.systemone',
  'gemini.generate': 'gateway.standard.gemini.generate',
  'gemini.embed': 'gateway.standard.gemini.embed',
  'openai.images': 'gateway.standard.openai.images',
  'openai.audio': 'gateway.standard.openai.audio',
  api: 'gateway.standard.api',
  mcp: 'gateway.standard.mcp',
};

export function GatewayPage() {
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<GatewaySurface | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const inFlight = useRef(false);

  const reload = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setCatalog(await listLocalGatewayServices());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tRef.current('gateway.loadFailed'));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const tick = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    const id = window.setInterval(tick, GATEWAY_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [reload]);

  const live = catalog?.live ?? null;
  const model = catalog?.model ?? [];
  const api = catalog?.api ?? [];
  const mcp = catalog?.mcp ?? [];
  const platform = catalog?.platform ?? [];
  const standards = useMemo(() => [...model, ...api, ...mcp], [model, api, mcp]);
  const mounted = standards.filter((item) => item.coverage === 'mounted').length;
  const needle = q.trim().toLowerCase();
  const labelOf = (id: string) => {
    const key = STANDARD_LABEL[id];
    return key ? t(key) : id;
  };
  const visibleModel = model.filter((item) => standardMatches(item, needle, labelOf(item.id)));
  const visibleApi = api.filter((item) => standardMatches(item, needle, labelOf(item.id)));
  const visibleMcp = mcp.filter((item) => standardMatches(item, needle, labelOf(item.id)));
  const visiblePlatform = platform.filter((route) =>
    matches(needle, [
      route.name,
      route.target,
      String(route.priority ?? ''),
      ...route.middlewares,
      ...route.matches.map((item) => item.value),
    ]),
  );
  const nothing =
    !loading &&
    visibleModel.length + visibleApi.length + visibleMcp.length + visiblePlatform.length === 0;

  const number = (value: number | null | undefined) =>
    value == null ? '—' : value.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US');

  const empty = (
    <ConsoleEmptyState
      title={needle ? t('gateway.emptyStandards') : t('gateway.empty')}
      description={needle ? t('gateway.emptyFilteredHint') : t('gateway.emptyHint')}
      variant={needle ? 'no-match' : 'no-data'}
      onClearFilters={needle ? () => setQ('') : undefined}
      clearFiltersLabel={t('admin.empty.clearFilters')}
    />
  );

  return (
    <AdminPageShell
      title={t('nav.gateway')}
      description={t('nav.gatewayDesc')}
      actions={<LiveIndicator live={live} stale={error != null} t={t} />}
    >
      {error ? <AppErrorBanner message={error} onRetry={() => void reload()} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t('gateway.stat.state')}
          value={loading ? '—' : stateLabel(live, t)}
          tone={live?.reachable ? (live.state === 'Running' ? 'success' : 'warn') : undefined}
        />
        <Stat
          label={t('gateway.stat.uptime')}
          value={loading || live?.uptimeSecs == null ? '—' : formatUptime(live.uptimeSecs, t)}
        />
        <Stat
          label={t('gateway.stat.mounted')}
          value={
            loading
              ? '—'
              : fill(t('gateway.stat.mountedValue'), { mounted, total: standards.length })
          }
        />
        <Stat
          label={t('gateway.stat.traffic')}
          value={
            loading || live?.totalRequests == null
              ? '—'
              : fill(t('gateway.stat.trafficValue'), {
                  requests: number(live.totalRequests),
                  errors: number(live.errorResponses),
                  active: number(live.activeConnections),
                })
          }
        />
      </div>

      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('gateway.searchStandards')}
      />

      {nothing ? (
        empty
      ) : (
        <div className="space-y-8">
          <StandardSection
            title={t('gateway.plane.model')}
            rows={visibleModel}
            loading={loading}
            labelOf={labelOf}
            t={t}
            onRefresh={() => void reload()}
          />
          <StandardSection
            title={t('gateway.plane.api')}
            rows={visibleApi}
            loading={loading}
            labelOf={labelOf}
            t={t}
            onRefresh={() => void reload()}
          />
          <StandardSection
            title={t('gateway.plane.mcp')}
            rows={visibleMcp}
            loading={loading}
            labelOf={labelOf}
            t={t}
            onRefresh={() => void reload()}
          />
          {loading || visiblePlatform.length > 0 ? (
            <section className="space-y-3">
              <SectionHeading title={t('gateway.plane.platform')} count={visiblePlatform.length} />
              <I18nDataTable
                rows={visiblePlatform}
                rowKey={(row) => row.name}
                loading={loading}
                showPagination={false}
                onRefresh={() => void reload()}
                expandedRowKey={expandedRoute}
                onExpandedRowChange={setExpandedRoute}
                renderExpanded={(row) => <MiddlewarePanel names={row.middlewares} t={t} />}
                columns={[
                {
                  id: 'route',
                  header: t('gateway.col.route'),
                  cell: (row) => (
                    <span className="font-mono text-[13px] font-medium text-ink">{row.name}</span>
                  ),
                },
                {
                  id: 'match',
                  header: t('gateway.col.match'),
                  cell: (row) => <MatchChips matches={row.matches} />,
                },
                {
                  id: 'target',
                  header: t('gateway.col.target'),
                  cell: (row) => (
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink">
                      <HealthDot route={row} live={live} />
                      {row.target}
                    </span>
                  ),
                },
                {
                  id: 'requests',
                  header: t('gateway.col.requests'),
                  cell: (row) => traffic(row.requests, row.errors, row.avgLatencyMs, number, t),
                },
              ]}
              />
            </section>
          ) : null}
        </div>
      )}
    </AdminPageShell>
  );
}

function StandardSection({
  title,
  rows,
  loading,
  labelOf,
  t,
  onRefresh,
}: {
  title: string;
  rows: GatewayStandard[];
  loading: boolean;
  labelOf: (id: string) => string;
  t: Translate;
  onRefresh: () => void;
}) {
  if (!loading && rows.length === 0) return null;
  const on = rows.filter((row) => row.coverage === 'mounted').length;
  return (
    <section className="space-y-3">
      <SectionHeading title={title} count={loading ? null : on} total={loading ? null : rows.length} />
      <I18nDataTable
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        showPagination={false}
        onRefresh={onRefresh}
        columns={[
          {
            id: 'standard',
            header: t('gateway.col.standard'),
            cell: (row) => (
              <span className="text-[13px] font-medium text-ink">{labelOf(row.id)}</span>
            ),
          },
          {
            id: 'paths',
            header: t('gateway.col.paths'),
            cell: (row) => (
              <span className="flex flex-col gap-1">
                {row.routes.map((route) => (
                  <span key={`${route.method} ${route.path}`} className="font-mono text-xs text-ink">
                    <span className="mr-2 text-ink-muted">{route.method}</span>
                    {route.path}
                  </span>
                ))}
              </span>
            ),
          },
          {
            id: 'mount',
            header: t('gateway.col.mount'),
            cell: (row) => <CoverageBadge coverage={row.coverage} t={t} />,
          },
        ]}
      />
    </section>
  );
}

function SectionHeading({
  title,
  count,
  total,
}: {
  title: string;
  count: number | null;
  total?: number | null;
}) {
  const note =
    count == null ? null : total == null ? String(count) : `${count} / ${total}`;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      {note ? <span className="text-xs tabular-nums text-ink-muted">{note}</span> : null}
    </div>
  );
}

function CoverageBadge({ coverage, t }: { coverage: GatewayCoverage; t: Translate }) {
  if (coverage === 'mounted') return <Badge tone="success">{t('gateway.mount.on')}</Badge>;
  if (coverage === 'partial') return <Badge tone="warn">{t('gateway.mount.partial')}</Badge>;
  return <Badge tone="neutral">{t('gateway.mount.off')}</Badge>;
}

function MiddlewarePanel({ names, t }: { names: string[]; t: Translate }) {
  return (
    <dl className="os-work-expand">
      <div className="os-work-expand__summary">
        <dt>{t('gateway.col.middlewares')}</dt>
        <dd>
          {names.length === 0 ? (
            <span className="text-ink-muted">—</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {names.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-ink"
                >
                  {name}
                </span>
              ))}
            </span>
          )}
        </dd>
      </div>
    </dl>
  );
}

function MatchChips({ matches }: { matches: GatewayMatch[] }) {
  if (matches.length === 0) return <span className="text-ink-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {matches.map((match) => (
        <span
          key={`${match.kind}:${match.value}`}
          className="inline-flex items-center rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-ink"
        >
          {match.kind === 'prefix' ? `${match.value.replace(/\/$/, '')}/*` : match.value}
        </span>
      ))}
    </span>
  );
}

function traffic(
  requests: number | null,
  errors: number | null,
  latency: number | null,
  number: (value: number | null | undefined) => string,
  t: Translate,
) {
  if (requests == null) return '—';
  return (
    <span className="tabular-nums">
      {number(requests)}
      {errors ? (
        <span className="ml-1.5 text-[color:var(--color-danger-text)]">
          {fill(t('gateway.errorsSuffix'), { n: number(errors) })}
        </span>
      ) : null}
      {latency != null ? (
        <span className="ml-1.5 text-ink-muted">
          {fill(t('gateway.latencySuffix'), { ms: latency.toFixed(1) })}
        </span>
      ) : null}
    </span>
  );
}

function standardMatches(standard: GatewayStandard, needle: string, label: string) {
  return matches(needle, [
    standard.id,
    label,
    standard.coverage,
    ...standard.routes.flatMap((route) => [route.method, route.path]),
  ]);
}

function matches(needle: string, parts: string[]) {
  return !needle || parts.join(' ').toLowerCase().includes(needle);
}

export type Matcher = { kind: 'prefix' | 'exact' | 'host' | 'raw'; value: string };

/** `PathPrefix(`/api`)` → `/api/*`; `Path(`/a`, `/b`)` → two exact paths; anything else stays raw. */
export function parseMatchers(rule: string): Matcher[] {
  const out: Matcher[] = [];
  const call = /\b(PathPrefix|Path|Host)\(([^)]*)\)/g;
  let rest = rule;
  for (const match of rule.matchAll(call)) {
    const kind = match[1] === 'PathPrefix' ? 'prefix' : match[1] === 'Path' ? 'exact' : 'host';
    for (const arg of match[2].matchAll(/`([^`]*)`/g)) out.push({ kind, value: arg[1] });
    rest = rest.replace(match[0], '');
  }
  if (out.length === 0 || rest.replace(/[\s&|()]/g, '') !== '') return [{ kind: 'raw', value: rule }];
  return out;
}

type Health = {
  tone: BadgeTone;
  label: MessageKey;
  params: Record<string, string | number>;
  rank: number;
};

export function healthOf(
  service: { health?: { healthy: number; total: number } | null; healthPath?: string | null },
  live: { reachable: boolean } | null,
): Health {
  if (!live?.reachable) return { tone: 'neutral', label: 'gateway.health.unknown', params: {}, rank: 3 };
  const health = service.health;
  if (!health || health.total === 0) {
    return { tone: 'neutral', label: 'gateway.health.unreported', params: {}, rank: 3 };
  }
  const params = { healthy: health.healthy, total: health.total };
  if (health.healthy === 0) return { tone: 'danger', label: 'gateway.health.down', params, rank: 0 };
  if (health.healthy < health.total) {
    return { tone: 'warn', label: 'gateway.health.partial', params, rank: 1 };
  }
  if (!service.healthPath) return { tone: 'neutral', label: 'gateway.health.passive', params, rank: 2 };
  return { tone: 'success', label: 'gateway.health.up', params, rank: 2 };
}

function HealthDot({ route, live }: { route: GatewayPlatformRoute; live: GatewayLive | null }) {
  const tone = healthOf(route, live).tone;
  const color =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warn'
        ? 'bg-amber-500'
        : tone === 'danger'
          ? 'bg-[color:var(--color-danger-text)]'
          : 'bg-ink-muted/40';
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function stateLabel(live: GatewayLive | null, t: Translate) {
  if (!live) return '—';
  if (!live.reachable) return t('gateway.state.offline');
  switch (live.state) {
    case 'Running':
      return t('gateway.state.running');
    case 'Reloading':
      return t('gateway.state.reloading');
    case 'Starting':
    case 'Created':
      return t('gateway.state.starting');
    default:
      return live.state ?? '—';
  }
}

export function formatUptime(seconds: number, t: Translate) {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return fill(t('gateway.uptime.days'), { d: days, h: hours });
  if (hours > 0) return fill(t('gateway.uptime.hours'), { h: hours, m: minutes });
  if (minutes > 0) return fill(t('gateway.uptime.minutes'), { m: minutes });
  return fill(t('gateway.uptime.seconds'), { s: seconds });
}

function LiveIndicator({
  live,
  stale,
  t,
}: {
  live: GatewayLive | null;
  stale: boolean;
  t: Translate;
}) {
  if (!live) return null;
  const on = live.reachable && !stale;
  const time = new Date(live.observedAt).toLocaleTimeString([], { hour12: false });
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-success' : 'bg-ink-muted/50'}`} aria-hidden />
      {fill(t(on ? 'gateway.live.synced' : 'gateway.live.stale'), { time })}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warn' | 'danger' }) {
  const color =
    tone === 'success'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-[color:var(--color-danger-text)]'
          : 'text-ink';
  return (
    <div className="min-w-0 border-l border-border/70 pl-3">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className={`mt-0.5 truncate text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}
