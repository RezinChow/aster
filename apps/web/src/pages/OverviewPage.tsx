import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Badge,
  DateRangePicker,
  ConsolePageHeader,
  RingProgress,
  FilterChip,
  SearchSelect,
} from '@a3s-lab/ui';
import { ApiTrafficChart, formatRpm } from '@/components/ApiTrafficChart';
import { TokenHeatmap } from '@/components/TokenHeatmap';
import {
  overviewKpis,
  overviewPlanMix,
  overviewPlanMeta,
  overviewFunnel,
  overviewUserSpendRank,
  overviewApiRevenueRank,
  overviewModelUsageRank,
  overviewMcpUsageRank,
} from '@/data/overview';
import {
  overviewResources,
  overviewServices,
  resourceCategoryTotal,
  resourceCountTotal,
  type OverviewResourceKind,
  type OverviewServiceId,
} from '@/data/overviewInventory';
import {
  clusterCards,
  poolSummary,
  type ResourcePool,
} from '@/data/platformPools';
import {
  apiTrafficForRange,
  apiTrafficSeries,
  apiTrafficSummary,
  systemLogs,
  type OpsTimeRangeId,
  type SystemLogLevel,
} from '@/data/platformOps';
import {
  loadOpsSpineSnapshot,
  type OpsSpineSnapshot,
} from '@/data/opsSpine';
import {
  buildTokenHeatmap,
  daysForRange,
  defaultCustomRange,
  tokenChannelOptions,
  tokenUserOptions,
} from '@/data/platformTokens';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { eventTone } from '@/lib/status';
import { Tooltip } from '@/shell/Tooltip';

export type OverviewLens = 'home' | 'platform';

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
    template,
  );
}

const LENS_COPY: Record<
  OverviewLens,
  { title: MessageKey; eyebrow: MessageKey; description: MessageKey }
> = {
  home: {
    title: 'overview.title',
    eyebrow: 'overview.eyebrow',
    description: 'overview.description',
  },
  platform: {
    title: 'overview.title.platform',
    eyebrow: 'overview.eyebrow.platform',
    description: 'overview.description.platform',
  },
};

const AUTO_REFRESH_MS = 30_000;

function formatClock(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function OverviewRefreshControls() {
  const { t } = useI18n();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshedAt(new Date());
      setRefreshing(false);
    }, 220);
  }

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh]);

  const refreshLabel = refreshing
    ? t('overview.refresh.busy')
    : t('overview.refresh.action');

  return (
    <div className="os-overview__refresh">
      <span className="os-overview__refresh-time">
        {fill(t('overview.refresh.at'), { time: formatClock(refreshedAt) })}
      </span>
      <label className="os-overview__auto">
        <span className="os-overview__auto-label">
          {t('overview.refresh.auto')}
        </span>
        <button
          type="button"
          className="os-overview__switch"
          role="switch"
          aria-checked={autoRefresh}
          aria-label={t('overview.refresh.auto')}
          onClick={() => setAutoRefresh((v) => !v)}
        >
          <span className="os-overview__switch-thumb" />
        </button>
      </label>
      <Tooltip label={refreshLabel} side="bottom">
        <button
          type="button"
          className="os-overview__refresh-btn"
          onClick={refresh}
          disabled={refreshing}
          aria-busy={refreshing}
          aria-label={refreshLabel}
          data-busy={refreshing ? 'true' : undefined}
        >
          <svg
            className="os-overview__refresh-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.2" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}

type OverviewKpiIconName =
  | 'traffic'
  | 'latency'
  | 'errors'
  | 'saturation'
  | 'tokens'
  | 'cpu'
  | 'gpu'
  | 'object'
  | 'logs'
  | 'api'
  | 'usage'
  | 'commerce'
  | 'users'
  | 'payingUsers'
  | 'customers'
  | 'channels'
  | 'tasks'
  | 'gateway'
  | 'fleet'
  | 'attention'
  | 'health'
  | 'signals'
  | 'agents'
  | 'workflows'
  | 'functions'
  | 'cells'
  | 'inference'
  | 'services'
  | 'resources';

type OverviewKpiKey =
  | 'tasks'
  | 'gateway'
  | 'fleet'
  | 'usage'
  | 'activeUsers'
  | 'payingUsers'
  | 'customers'
  | 'channels'
  | 'paidSeats'
  | 'revenue'
  | 'orders'
  | 'tickets';

function formatGrowthPct(ratio: number) {
  const pct = Math.round(ratio * 1000) / 10;
  const abs = Math.abs(pct).toFixed(pct % 1 === 0 ? 0 : 1);
  if (pct > 0) return `+${abs}%`;
  if (pct < 0) return `−${abs}%`;
  return '0%';
}

function growthTone(ratio: number): 'up' | 'down' | 'flat' {
  if (ratio > 0) return 'up';
  if (ratio < 0) return 'down';
  return 'flat';
}

function parseCountableKpi(raw: string): {
  prefix: string;
  target: number;
  decimals: number;
  suffix: string;
  useGrouping: boolean;
} | null {
  const m = raw
    .trim()
    .match(
      /^([^0-9-+]*)([+-]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[+-]?\d+(?:\.\d+)?)([a-zA-Z%]*)$/,
    );
  if (!m) return null;
  const prefix = m[1] ?? '';
  const num = m[2] ?? '';
  const suffix = m[3] ?? '';
  const useGrouping = num.includes(',');
  const cleaned = num.replace(/,/g, '');
  const target = Number(cleaned);
  if (!Number.isFinite(target)) return null;
  const decimals = cleaned.includes('.')
    ? (cleaned.split('.')[1]?.length ?? 0)
    : 0;
  return { prefix, target, decimals, suffix, useGrouping };
}

function formatCounted(
  n: number,
  decimals: number,
  useGrouping: boolean,
) {
  if (useGrouping) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

/** Count-up on first mount for overview KPI values. */
function KpiCountValue({
  value,
  delay = 0,
  duration = 920,
}: {
  value: string;
  delay?: number;
  duration?: number;
}) {
  const parsed = useMemo(() => parseCountableKpi(value), [value]);
  const [display, setDisplay] = useState(() => {
    if (!parsed) return value;
    return `${parsed.prefix}${formatCounted(0, parsed.decimals, parsed.useGrouping)}${parsed.suffix}`;
  });

  useEffect(() => {
    if (!parsed) {
      setDisplay(value);
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finalText = `${parsed.prefix}${formatCounted(
      parsed.target,
      parsed.decimals,
      parsed.useGrouping,
    )}${parsed.suffix}`;

    if (reduced) {
      setDisplay(finalText);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    setDisplay(
      `${parsed.prefix}${formatCounted(0, parsed.decimals, parsed.useGrouping)}${parsed.suffix}`,
    );

    const timeout = window.setTimeout(() => {
      const tick = (now: number) => {
        if (start == null) start = now;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        const current =
          parsed.decimals > 0
            ? parsed.target * eased
            : Math.round(parsed.target * eased);
        setDisplay(
          `${parsed.prefix}${formatCounted(
            current,
            parsed.decimals,
            parsed.useGrouping,
          )}${parsed.suffix}`,
        );
        if (t < 1) raf = window.requestAnimationFrame(tick);
        else setDisplay(finalText);
      };
      raf = window.requestAnimationFrame(tick);
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      window.cancelAnimationFrame(raf);
    };
  }, [parsed, value, delay, duration]);

  return (
    <p className="os-overview__kpi-value" aria-label={value}>
      {display}
    </p>
  );
}

const KPI_SPARK_COLOR: Partial<
  Record<OverviewKpiKey, 'teal' | 'blue' | 'amber' | 'coral'>
> = {
  activeUsers: 'teal',
  payingUsers: 'blue',
  customers: 'amber',
  channels: 'coral',
  paidSeats: 'teal',
  revenue: 'blue',
  orders: 'coral',
  tickets: 'amber',
  tasks: 'amber',
};

function GrowthValue({ ratio }: { ratio: number }) {
  const tone = growthTone(ratio);
  return (
    <span className="os-overview__kpi-growth-value" data-tone={tone}>
      <span className="os-overview__kpi-growth-arrow" aria-hidden>
        {tone === 'up' ? '↑' : tone === 'down' ? '↓' : '→'}
      </span>
      {formatGrowthPct(ratio)}
    </span>
  );
}

function KpiSparkline({
  series,
  color,
}: {
  series: number[];
  color?: 'teal' | 'blue' | 'amber' | 'coral';
}) {
  if (series.length < 2) return null;
  const w = 88;
  const h = 28;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => ({
    x: (i / (series.length - 1)) * w,
    y: h - ((v - min) / span) * (h - 4) - 2,
  }));

  /** Catmull-Rom → cubic Bézier for a smooth curve. */
  let curve = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    curve += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const area = `${curve} L ${w} ${h} L 0 ${h} Z`;
  const rising = series[series.length - 1]! >= series[0]!;

  return (
    <svg
      className="os-overview__kpi-spark"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden
      data-color={color}
      data-tone={rising ? 'up' : 'down'}
    >
      <path
        className="os-overview__kpi-spark-area"
        d={area}
        fill="currentColor"
      />
      <path
        className="os-overview__kpi-spark-line"
        d={curve}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KpiRow({ keys }: { keys: OverviewKpiKey[] }) {
  const { t } = useI18n();
  const map: Record<
    OverviewKpiKey,
    {
      to: string;
      icon: OverviewKpiIconName;
      label: string;
      value: string;
      hint: string;
      wow?: number;
      mom?: number;
      series?: number[];
    }
  > = {
    tasks: {
      to: '/work-orders',
      icon: 'tasks',
      label: t('overview.kpi.tasks'),
      value: overviewKpis.tasks.value,
      hint: t('overview.kpi.tasksHint'),
      wow: overviewKpis.tasks.wow,
      mom: overviewKpis.tasks.mom,
      series: overviewKpis.tasks.series,
    },
    gateway: {
      to: '/gateway',
      icon: 'gateway',
      label: t('overview.kpi.gateway'),
      value: overviewKpis.gateway.value,
      hint: t('overview.kpi.gatewayHint'),
    },
    fleet: {
      to: '/fleet',
      icon: 'fleet',
      label: t('overview.kpi.fleet'),
      value: overviewKpis.fleet.value,
      hint: t('overview.kpi.fleetHint'),
    },
    usage: {
      to: '/usage',
      icon: 'usage',
      label: t('overview.kpi.usage'),
      value: overviewKpis.usage.value,
      hint: t('overview.kpi.usageHint'),
    },
    activeUsers: {
      to: '/team/members',
      icon: 'users',
      label: t('overview.kpi.activeUsers'),
      value: overviewKpis.activeUsers.value,
      hint: t('overview.kpi.activeUsersHint'),
      wow: overviewKpis.activeUsers.wow,
      mom: overviewKpis.activeUsers.mom,
      series: overviewKpis.activeUsers.series,
    },
    payingUsers: {
      to: '/team/members',
      icon: 'payingUsers',
      label: t('overview.kpi.payingUsers'),
      value: overviewKpis.payingUsers.value,
      hint: t('overview.kpi.payingUsersHint'),
      wow: overviewKpis.payingUsers.wow,
      mom: overviewKpis.payingUsers.mom,
      series: overviewKpis.payingUsers.series,
    },
    customers: {
      to: '/customers',
      icon: 'customers',
      label: t('overview.kpi.customers'),
      value: overviewKpis.customers.value,
      hint: t('overview.kpi.customersHint'),
      wow: overviewKpis.customers.wow,
      mom: overviewKpis.customers.mom,
      series: overviewKpis.customers.series,
    },
    channels: {
      to: '/channels',
      icon: 'channels',
      label: t('overview.kpi.channels'),
      value: overviewKpis.channels.value,
      hint: t('overview.kpi.channelsHint'),
      wow: overviewKpis.channels.wow,
      mom: overviewKpis.channels.mom,
      series: overviewKpis.channels.series,
    },
    paidSeats: {
      to: '/team/members',
      icon: 'payingUsers',
      label: t('overview.kpi.paidSeats'),
      value: overviewKpis.paidSeats.value,
      hint: t('overview.kpi.paidSeatsHint'),
      wow: overviewKpis.paidSeats.wow,
      mom: overviewKpis.paidSeats.mom,
      series: overviewKpis.paidSeats.series,
    },
    revenue: {
      to: '/usage',
      icon: 'usage',
      label: t('overview.kpi.revenue'),
      value: overviewKpis.revenue.value,
      hint: t('overview.kpi.revenueHint'),
      wow: overviewKpis.revenue.wow,
      mom: overviewKpis.revenue.mom,
      series: overviewKpis.revenue.series,
    },
    orders: {
      to: '/customers',
      icon: 'commerce',
      label: t('overview.kpi.orders'),
      value: overviewKpis.orders.value,
      hint: t('overview.kpi.ordersHint'),
      wow: overviewKpis.orders.wow,
      mom: overviewKpis.orders.mom,
      series: overviewKpis.orders.series,
    },
    tickets: {
      to: '/work-orders',
      icon: 'tasks',
      label: t('overview.kpi.tickets'),
      value: overviewKpis.tickets.value,
      hint: t('overview.kpi.ticketsHint'),
      wow: overviewKpis.tickets.wow,
      mom: overviewKpis.tickets.mom,
      series: overviewKpis.tickets.series,
    },
  };

  return (
    <section className="os-overview__kpi-cards" aria-label="KPI">
      {keys.map((key, index) => {
        const item = map[key];
        const rich =
          item.wow != null && item.mom != null && item.series != null;
        return (
          <Link
            key={key}
            to={item.to}
            className={
              rich
                ? 'ui-card os-overview__kpi-card os-overview__kpi-card--rich'
                : 'ui-card os-overview__kpi-card'
            }
            title={item.hint}
          >
            <span className="os-overview__kpi-card-icon">
              <OverviewKpiIcon name={item.icon} />
            </span>
            <div className="os-overview__kpi-card-body">
              <p className="os-overview__kpi-label">{item.label}</p>
              <KpiCountValue value={item.value} delay={index * 70} />
            </div>
            {rich ? (
              <div className="os-overview__kpi-card-aside">
                <div className="os-overview__kpi-growth">
                  <div className="os-overview__kpi-growth-row">
                    <span>{t('overview.kpi.wow')}</span>
                    <GrowthValue ratio={item.wow!} />
                  </div>
                  <div className="os-overview__kpi-growth-row">
                    <span>{t('overview.kpi.mom')}</span>
                    <GrowthValue ratio={item.mom!} />
                  </div>
                </div>
                <KpiSparkline
                  series={item.series!}
                  color={KPI_SPARK_COLOR[key]}
                />
              </div>
            ) : null}
          </Link>
        );
      })}
    </section>
  );
}

function HomeDashboard() {
  const { t } = useI18n();
  return (
    <>
      {/* First viewport ≤ 4 modules (PAGE-UX Overview / PRINCIPLES §6.1) */}
      <KpiRow
        keys={['activeUsers', 'payingUsers', 'customers', 'revenue']}
      />
      <div className="os-overview__split os-overview__split--platform">
        <PlanMixPanel />
        <ConversionFunnelPanel />
      </div>

      <div
        className="os-overview__below"
        aria-label={t('overview.belowFold')}
      >
        <KpiRow keys={['paidSeats', 'channels', 'orders', 'tickets']} />
        <ResourcesInventoryPanel />
        <div className="os-overview__split os-overview__split--platform">
          <UserSpendRankPanel />
          <ApiRevenueRankPanel />
        </div>
      </div>
    </>
  );
}

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';
  const large = sweep > 180 ? 1 : 0;
  const so = polarPoint(cx, cy, rOuter, startAngle);
  const eo = polarPoint(cx, cy, rOuter, endAngle);
  const si = polarPoint(cx, cy, rInner, endAngle);
  const ei = polarPoint(cx, cy, rInner, startAngle);
  return [
    `M ${so.x} ${so.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${eo.x} ${eo.y}`,
    `L ${si.x} ${si.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ');
}

type DonutSegment = {
  id: string;
  name: string;
  value: number;
  customers: number;
  color: string;
};

type DonutTip = {
  name: string;
  seats: number;
  customers: number;
  pct: number;
  color: string;
  x: number;
  y: number;
};

function SubscriptionDonut({
  segments,
  centerValue,
  centerLabel,
  seatsLabel,
  customersLabel,
  size = 148,
  strokeWidth = 22,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  seatsLabel: string;
  customersLabel: string;
  size?: number;
  strokeWidth?: number;
}) {
  const tipId = useId();
  const [tip, setTip] = useState<DonutTip | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = (size - 4) / 2;
  const rInner = rOuter - strokeWidth;
  const gapDeg = 1.2;

  let angle = 0;
  const slices = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const start = angle + gapDeg / 2;
    const end = angle + sweep - gapDeg / 2;
    angle += sweep;
    const mid = (start + end) / 2;
    return {
      ...seg,
      start,
      end: Math.max(start, end),
      mid,
      pct: Math.round((seg.value / total) * 100),
      path: donutSlicePath(cx, cy, rOuter, rInner, start, Math.max(start, end)),
    };
  });

  useEffect(() => {
    if (!tip) return;
    const hide = () => {
      setTip(null);
      setActiveId(null);
    };
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  function showTip(slice: (typeof slices)[number], el: SVGGraphicsElement) {
    const rect = el.getBoundingClientRect();
    setActiveId(slice.id);
    setTip({
      name: slice.name,
      seats: slice.value,
      customers: slice.customers,
      pct: slice.pct,
      color: slice.color,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }

  function hideTip() {
    setTip(null);
    setActiveId(null);
  }

  return (
    <div
      className="os-overview__donut"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={centerLabel}
      >
        <circle
          className="os-overview__donut-track"
          cx={cx}
          cy={cy}
          r={(rOuter + rInner) / 2}
          fill="none"
          strokeWidth={strokeWidth}
        />
        {slices.map((slice) =>
          slice.path ? (
            <path
              key={slice.id}
              className="os-overview__donut-slice"
              d={slice.path}
              fill={slice.color}
              data-active={activeId === slice.id ? 'true' : undefined}
              tabIndex={0}
              role="button"
              aria-label={`${slice.name}, ${slice.value}`}
              onMouseEnter={(e) => showTip(slice, e.currentTarget)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(slice, e.currentTarget)}
              onBlur={hideTip}
            />
          ) : null,
        )}
      </svg>
      <div className="os-overview__donut-label">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>

      {tip
        ? createPortal(
            <div
              id={tipId}
              className="os-overview__api-tip os-overview__donut-tip"
              role="tooltip"
              style={{ left: tip.x, top: tip.y }}
            >
              <p className="os-overview__donut-tip-title">
                <span
                  className="os-overview__res-legend-swatch"
                  style={{ background: tip.color }}
                  aria-hidden
                />
                {tip.name}
              </p>
              <ul className="os-overview__donut-tip-list">
                <li>
                  <span>{seatsLabel}</span>
                  <strong>{tip.seats}</strong>
                </li>
                <li>
                  <span>{customersLabel}</span>
                  <strong>{tip.customers}</strong>
                </li>
                <li>
                  <span>%</span>
                  <strong>{tip.pct}%</strong>
                </li>
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function PlanMixPanel() {
  const { t } = useI18n();
  const totalSeats = overviewPlanMix.reduce((s, p) => s + p.seats, 0);
  const paidPct = totalSeats
    ? Math.round((overviewPlanMeta.paidSeats / totalSeats) * 100)
    : 0;

  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--plans"
      aria-labelledby="ov-plans"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="customers" />
          </span>
          <div>
            <h2 id="ov-plans">{t('overview.plans.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.plans.meta')}
            </p>
          </div>
        </div>
        <Link to="/admin/customers" className="os-overview__link">
          {t('overview.kpi.customers')}
        </Link>
      </div>

      <div className="os-overview__plan-body">
        <div className="os-overview__plan-rings">
          <SubscriptionDonut
            segments={overviewPlanMix.map((p) => ({
              id: p.id,
              name: t(`overview.plans.${p.id}` as MessageKey),
              value: p.seats,
              customers: p.customers,
              color: p.color,
            }))}
            centerValue={String(totalSeats)}
            centerLabel={t('overview.plans.seatsLabel')}
            seatsLabel={t('overview.plans.seatsLabel')}
            customersLabel={t('overview.kpi.customers')}
          />
          <div className="os-overview__plan-paid">
            <RingProgress
              value={paidPct}
              size={72}
              strokeWidth={7}
              label={t('overview.plans.paidShare')}
              className="os-overview__plan-paid-ring"
            />
            <p className="os-overview__plan-paid-caption">
              {t('overview.plans.paidShare')}
            </p>
          </div>
        </div>

        <ul className="os-overview__plan-list">
          {overviewPlanMix.map((plan) => {
            const pct = totalSeats
              ? Math.round((plan.seats / totalSeats) * 100)
              : 0;
            return (
              <li key={plan.id} className="os-overview__plan-row">
                <span
                  className="os-overview__res-dot"
                  style={{ background: plan.color }}
                  aria-hidden
                />
                <div className="os-overview__plan-row-main">
                  <p className="os-overview__res-row-name">
                    {t(`overview.plans.${plan.id}` as MessageKey)}
                  </p>
                  <p className="os-overview__plan-row-meta">
                    {fill(t('overview.plans.rowMeta'), {
                      seats: plan.seats,
                      customers: plan.customers,
                      pct,
                    })}
                  </p>
                </div>
                <span className="os-overview__plan-row-value">{plan.seats}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="os-overview__plan-footnotes">
        <p>
          {fill(t('overview.plans.trials'), {
            count: overviewPlanMeta.trials,
          })}
        </p>
        <p>
          {fill(t('overview.plans.annual'), {
            pct: Math.round(overviewPlanMeta.annualShare * 100),
          })}
        </p>
        <p>
          {fill(t('overview.plans.collaborators'), {
            count: overviewPlanMeta.collaboratorSeats,
          })}
        </p>
      </div>
    </section>
  );
}

function ConversionFunnelPanel() {
  const { t } = useI18n();
  const tipId = useId();
  const [tip, setTip] = useState<{
    name: string;
    count: number;
    conv: number | null;
    ofTop: number;
    drop: number | null;
    x: number;
    y: number;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const top = overviewFunnel[0]?.count || 1;
  const last = overviewFunnel[overviewFunnel.length - 1]?.count ?? 0;
  const overall =
    top > 0 ? Math.round((last / top) * 1000) / 10 : 0;

  const stages = overviewFunnel.map((stage, index) => {
    const prev = overviewFunnel[index - 1]?.count;
    const widthPct = Math.max(2.5, (stage.count / top) * 100);
    const ofTop = Math.round((stage.count / top) * 1000) / 10;
    const conv =
      prev && prev > 0
        ? Math.round((stage.count / prev) * 1000) / 10
        : null;
    const drop =
      conv != null ? Math.round((100 - conv) * 10) / 10 : null;
    return { ...stage, widthPct, ofTop, conv, drop, index };
  });

  useEffect(() => {
    if (!tip) return;
    const hide = () => {
      setTip(null);
      setActiveId(null);
    };
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip]);

  function showTip(
    stage: (typeof stages)[number],
    el: HTMLElement,
  ) {
    const rect = el.getBoundingClientRect();
    setActiveId(stage.id);
    setTip({
      name: t(`overview.funnel.stage.${stage.id}` as MessageKey),
      count: stage.count,
      conv: stage.conv,
      ofTop: stage.ofTop,
      drop: stage.drop,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }

  function hideTip() {
    setTip(null);
    setActiveId(null);
  }

  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--funnel"
      aria-labelledby="ov-funnel"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="users" />
          </span>
          <div>
            <h2 id="ov-funnel">{t('overview.funnel.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.funnel.meta')}
              {' · '}
              {fill(t('overview.funnel.overall'), { pct: overall })}
            </p>
          </div>
        </div>
        <Link to="/admin/team/members" className="os-overview__link">
          {t('overview.kpi.activeUsers')}
        </Link>
      </div>

      <ol className="os-overview__funnel" aria-label={t('overview.funnel.title')}>
        {stages.map((stage) => {
          const name = t(
            `overview.funnel.stage.${stage.id}` as MessageKey,
          );
          return (
            <li
              key={stage.id}
              className="os-overview__funnel-step"
              data-active={activeId === stage.id ? 'true' : undefined}
            >
              {stage.conv != null ? (
                <div className="os-overview__funnel-bridge" aria-hidden>
                  <span className="os-overview__funnel-bridge-rate">
                    {fill(t('overview.funnel.conv'), { pct: stage.conv })}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                className="os-overview__funnel-row"
                aria-describedby={
                  tip && activeId === stage.id ? tipId : undefined
                }
                aria-label={`${name}, ${stage.count.toLocaleString('en-US')}${
                  stage.conv != null
                    ? `, ${fill(t('overview.funnel.conv'), { pct: stage.conv })}`
                    : ''
                }`}
                onMouseEnter={(e) => showTip(stage, e.currentTarget)}
                onMouseLeave={hideTip}
                onFocus={(e) => showTip(stage, e.currentTarget)}
                onBlur={hideTip}
              >
                <span className="os-overview__funnel-step-name">{name}</span>
                <span className="os-overview__funnel-track" aria-hidden>
                  <span className="os-overview__funnel-frame" />
                  <span
                    className="os-overview__funnel-fill"
                    style={{ width: `${stage.widthPct}%` }}
                  />
                </span>
                <span className="os-overview__funnel-metrics">
                  <strong className="os-overview__funnel-step-count">
                    {stage.count.toLocaleString('en-US')}
                  </strong>
                  <span className="os-overview__funnel-step-share">
                    {stage.ofTop}%
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {tip
        ? createPortal(
            <div
              id={tipId}
              className="os-overview__api-tip os-overview__donut-tip"
              role="tooltip"
              style={{ left: tip.x, top: tip.y }}
            >
              <p className="os-overview__donut-tip-title">{tip.name}</p>
              <ul className="os-overview__donut-tip-list">
                <li>
                  <span>{t('overview.funnel.count')}</span>
                  <strong>{tip.count.toLocaleString('en-US')}</strong>
                </li>
                <li>
                  <span>{t('overview.funnel.ofTop')}</span>
                  <strong>{tip.ofTop}%</strong>
                </li>
                {tip.conv != null ? (
                  <li>
                    <span>{t('overview.funnel.rate')}</span>
                    <strong>
                      {fill(t('overview.funnel.conv'), { pct: tip.conv })}
                    </strong>
                  </li>
                ) : null}
                {tip.drop != null ? (
                  <li>
                    <span>{t('overview.funnel.dropLabel')}</span>
                    <strong>{tip.drop}%</strong>
                  </li>
                ) : null}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

const SERVICE_ICON: Record<OverviewServiceId, OverviewKpiIconName> = {
  workflows: 'workflows',
  functions: 'functions',
  cells: 'cells',
  inference: 'inference',
};

const SERVICE_LABEL: Record<OverviewServiceId, MessageKey> = {
  workflows: 'overview.services.workflows',
  functions: 'overview.services.functions',
  cells: 'overview.services.cells',
  inference: 'overview.services.inference',
};

function ServicesInventoryPanel() {
  const { t } = useI18n();
  return (
    <section className="os-overview__services" aria-labelledby="ov-services">
      <div className="os-overview__services-head">
        <h2 id="ov-services">{t('overview.services.title')}</h2>
        <p className="os-overview__panel-card-meta">
          {t('overview.services.meta')}
        </p>
      </div>
      <div className="os-overview__svc-grid">
        {overviewServices.map((svc, index) => (
          <Link
            key={svc.id}
            to={svc.href}
            className="ui-card os-overview__svc-tile"
          >
            <span className="os-overview__kpi-card-icon" data-tone={svc.id}>
              <OverviewKpiIcon name={SERVICE_ICON[svc.id]} />
            </span>
            <div className="os-overview__svc-tile-body">
              <p className="os-overview__kpi-label">
                {t(SERVICE_LABEL[svc.id])}
              </p>
              <KpiCountValue
                value={String(svc.count)}
                delay={index * 70}
              />
              <p className="os-overview__svc-tile-status">
                {fill(t('overview.services.status'), {
                  ready: svc.ready,
                  degraded: svc.degraded,
                })}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const RESOURCE_LABEL: Record<OverviewResourceKind, MessageKey> = {
  agent: 'overview.resources.kind.agent',
  workflow: 'overview.resources.kind.workflow',
  model: 'overview.resources.kind.model',
  api: 'overview.resources.kind.api',
  connector: 'overview.resources.kind.connector',
  skill: 'overview.resources.kind.skill',
  tool: 'overview.resources.kind.tool',
  applet: 'overview.resources.kind.applet',
  knowledge: 'overview.resources.kind.knowledge',
};

function ResourceKindIcon({ kind }: { kind: OverviewResourceKind }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'agent':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.5-3.5 3.8-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case 'workflow':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M8.2 7.5L10.5 15M15.8 7.5L13.5 15" />
        </svg>
      );
    case 'model':
      return (
        <svg {...props}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      );
    case 'api':
      return (
        <svg {...props}>
          <path d="M3 16c2.5-6 4.5-9 7-9s4 5 5.5 5 2.8-3 5.5-6" />
          <path d="M3 19h18" />
        </svg>
      );
    case 'connector':
      return (
        <svg {...props}>
          <path d="M8 7h8v3H8zM8 14h8v3H8z" />
          <path d="M10 10v4M14 10v4" />
        </svg>
      );
    case 'skill':
      return (
        <svg {...props}>
          <path d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        </svg>
      );
    case 'tool':
      return (
        <svg {...props}>
          <path d="M14.5 5.5a4 4 0 0 1 4 4L12 16l-4-4 6.5-6.5Z" />
          <path d="M8 16 5 19" />
        </svg>
      );
    case 'applet':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg {...props}>
          <path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 3V5Z" />
          <path d="M13 5h7v14a3 3 0 0 0-3-3h-4V5Z" />
        </svg>
      );
  }
}

function ResourcesInventoryPanel() {
  const { t } = useI18n();
  const categoryTotal = resourceCategoryTotal();
  const countTotal = resourceCountTotal();

  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--resources"
      aria-labelledby="ov-resources"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="resources" />
          </span>
          <div>
            <h2 id="ov-resources">{t('overview.resources.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.resources.meta')}
              {' · '}
              {fill(t('overview.resources.summary.categories'), {
                n: categoryTotal,
              })}
              {' · '}
              {fill(t('overview.resources.summary.resources'), {
                n: countTotal,
              })}
            </p>
          </div>
        </div>
        <Link to="/admin/marketplace" className="os-overview__link">
          {t('overview.resources.openMarket')}
        </Link>
      </div>

      <ul className="os-overview__res-list">
        {overviewResources.map((item) => (
          <li key={item.kind}>
            <Link to={item.href} className="os-overview__res-row">
              <span className="os-overview__res-row-label">
                <span
                  className="os-overview__res-icon"
                  style={{
                    color: item.color,
                    backgroundColor: `${item.color}1a`,
                  }}
                  aria-hidden
                >
                  <ResourceKindIcon kind={item.kind} />
                </span>
                <span className="os-overview__res-row-name">
                  {t(RESOURCE_LABEL[item.kind])}
                </span>
              </span>
              <span className="os-overview__res-row-stats">
                <span>
                  {t('overview.resources.categories')}{' '}
                  <strong>{item.categories}</strong>
                </span>
                <span>
                  {t('overview.resources.resources')}{' '}
                  <strong>{item.resources}</strong>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}`;
}

function formatCompactCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return value.toLocaleString('en-US');
}

function UserSpendRankPanel() {
  const { t } = useI18n();
  const top = overviewUserSpendRank[0]?.spendUsd || 1;
  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--rank"
      aria-labelledby="ov-user-spend"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="usage" />
          </span>
          <div>
            <h2 id="ov-user-spend">{t('overview.rank.userSpend.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.rank.userSpend.meta')}
            </p>
          </div>
        </div>
        <Link to="/admin/usage" className="os-overview__link">
          {t('overview.viewAll')}
        </Link>
      </div>
      <ol className="os-overview__rank-list">
        {overviewUserSpendRank.map((row, index) => {
          const pct = Math.max(4, Math.round((row.spendUsd / top) * 100));
          return (
            <li key={row.id}>
              <Link to={row.href} className="os-overview__rank-row">
                <span className="os-overview__rank-pos" aria-hidden>
                  {index + 1}
                </span>
                <img
                  className="os-overview__rank-mark os-overview__rank-mark--avatar"
                  src={row.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                />
                <span className="os-overview__rank-main">
                  <span className="os-overview__rank-name">{row.name}</span>
                  <span className="os-overview__rank-sub">{row.org}</span>
                  <span className="os-overview__rank-track" aria-hidden>
                    <span
                      className="os-overview__rank-fill os-overview__rank-fill--spend"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
                <span className="os-overview__rank-value">
                  <strong>{formatUsd(row.spendUsd)}</strong>
                  <span>{t('overview.rank.spend')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ApiRevenueRankPanel() {
  const { t } = useI18n();
  const top = overviewApiRevenueRank[0]?.revenueUsd || 1;
  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--rank"
      aria-labelledby="ov-api-revenue"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="api" />
          </span>
          <div>
            <h2 id="ov-api-revenue">{t('overview.rank.apiRevenue.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.rank.apiRevenue.meta')}
            </p>
          </div>
        </div>
        <Link to="/admin/marketplace?kind=api" className="os-overview__link">
          {t('overview.viewAll')}
        </Link>
      </div>
      <ol className="os-overview__rank-list">
        {overviewApiRevenueRank.map((row, index) => {
          const pct = Math.max(4, Math.round((row.revenueUsd / top) * 100));
          return (
            <li key={row.id}>
              <Link to={row.href} className="os-overview__rank-row">
                <span className="os-overview__rank-pos" aria-hidden>
                  {index + 1}
                </span>
                <img
                  className="os-overview__rank-mark os-overview__rank-mark--logo"
                  src={row.logoUrl}
                  alt=""
                  width={28}
                  height={28}
                />
                <span className="os-overview__rank-main">
                  <span className="os-overview__rank-name">{row.name}</span>
                  <span className="os-overview__rank-sub">
                    {row.provider}
                    {' · '}
                    {formatCompactCount(row.calls)} {t('overview.rank.calls')}
                  </span>
                  <span className="os-overview__rank-track" aria-hidden>
                    <span
                      className="os-overview__rank-fill os-overview__rank-fill--revenue"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
                <span className="os-overview__rank-value">
                  <strong>{formatUsd(row.revenueUsd)}</strong>
                  <span>{t('overview.rank.revenue')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ModelUsageRankPanel() {
  const { t } = useI18n();
  const top = overviewModelUsageRank[0]?.tokens || 1;
  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--rank"
      aria-labelledby="ov-model-usage"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="tokens" />
          </span>
          <div>
            <h2 id="ov-model-usage">{t('overview.rank.modelUsage.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.rank.modelUsage.meta')}
            </p>
          </div>
        </div>
        <Link to="/admin/assets/models" className="os-overview__link">
          {t('overview.viewAll')}
        </Link>
      </div>
      <ol className="os-overview__rank-list">
        {overviewModelUsageRank.map((row, index) => {
          const pct = Math.max(4, Math.round((row.tokens / top) * 100));
          return (
            <li key={row.id}>
              <Link to={row.href} className="os-overview__rank-row">
                <span className="os-overview__rank-pos" aria-hidden>
                  {index + 1}
                </span>
                <img
                  className="os-overview__rank-mark os-overview__rank-mark--logo"
                  src={row.logoUrl}
                  alt=""
                  width={28}
                  height={28}
                />
                <span className="os-overview__rank-main">
                  <span className="os-overview__rank-name">{row.name}</span>
                  <span className="os-overview__rank-sub">
                    {row.provider}
                    {' · '}
                    {formatCompactCount(row.requests)} {t('overview.rank.calls')}
                  </span>
                  <span className="os-overview__rank-track" aria-hidden>
                    <span
                      className="os-overview__rank-fill os-overview__rank-fill--tokens"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
                <span className="os-overview__rank-value">
                  <strong>{formatTokens(row.tokens)}</strong>
                  <span>{t('overview.rank.tokens')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function McpUsageRankPanel() {
  const { t } = useI18n();
  const top = overviewMcpUsageRank[0]?.calls || 1;
  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--rank"
      aria-labelledby="ov-mcp-usage"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="resources" />
          </span>
          <div>
            <h2 id="ov-mcp-usage">{t('overview.rank.mcpUsage.title')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.rank.mcpUsage.meta')}
            </p>
          </div>
        </div>
        <Link to="/admin/marketplace?kind=tool" className="os-overview__link">
          {t('overview.viewAll')}
        </Link>
      </div>
      <ol className="os-overview__rank-list">
        {overviewMcpUsageRank.map((row, index) => {
          const pct = Math.max(4, Math.round((row.calls / top) * 100));
          return (
            <li key={row.id}>
              <Link to={row.href} className="os-overview__rank-row">
                <span className="os-overview__rank-pos" aria-hidden>
                  {index + 1}
                </span>
                <img
                  className="os-overview__rank-mark os-overview__rank-mark--logo"
                  src={row.logoUrl}
                  alt=""
                  width={28}
                  height={28}
                />
                <span className="os-overview__rank-main">
                  <span className="os-overview__rank-name">{row.name}</span>
                  <span className="os-overview__rank-sub">
                    {row.provider}
                    {' · '}
                    {row.tools} {t('overview.rank.tools')}
                  </span>
                  <span className="os-overview__rank-track" aria-hidden>
                    <span
                      className="os-overview__rank-fill os-overview__rank-fill--mcp"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
                <span className="os-overview__rank-value">
                  <strong>{formatCompactCount(row.calls)}</strong>
                  <span>{t('overview.rank.calls')}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function poolHealthLabel(
  health: ResourcePool['health'],
  t: (k: MessageKey) => string,
) {
  switch (health) {
    case 'saturated':
      return t('overview.platform.health.saturated');
    case 'degraded':
      return t('overview.platform.health.degraded');
    case 'unreachable':
      return t('overview.platform.health.unreachable');
    default:
      return t('overview.platform.health.healthy');
  }
}

/** Utilization → ring color: green · blue · yellow · orange · red */
function utilTone(pct: number): 'green' | 'blue' | 'yellow' | 'orange' | 'red' {
  if (pct < 40) return 'green';
  if (pct < 60) return 'blue';
  if (pct < 75) return 'yellow';
  if (pct < 90) return 'orange';
  return 'red';
}

function logLevelTone(level: SystemLogLevel) {
  if (level === 'debug') return 'neutral' as const;
  return eventTone(level);
}

function opsTimeOptions(t: (k: MessageKey) => string) {
  return [
    { value: '1h', label: t('overview.platform.time.1h') },
    { value: '6h', label: t('overview.platform.time.6h') },
    { value: '24h', label: t('overview.platform.time.24h') },
    { value: '7d', label: t('overview.platform.time.7d') },
  ];
}

function SystemLogsPanel() {
  const { t } = useI18n();
  const [level, setLevel] = useState<'all' | SystemLogLevel>('all');
  const [timeRange, setTimeRange] = useState<OpsTimeRangeId>('24h');
  const levels: Array<'all' | SystemLogLevel> = [
    'all',
    'error',
    'warn',
    'info',
    'debug',
  ];
  const levelLabel = (id: 'all' | SystemLogLevel): MessageKey => {
    switch (id) {
      case 'all':
        return 'overview.platform.logsLevel.all';
      case 'debug':
        return 'overview.platform.logsLevel.debug';
      case 'info':
        return 'overview.platform.logsLevel.info';
      case 'warn':
        return 'overview.platform.logsLevel.warn';
      case 'error':
        return 'overview.platform.logsLevel.error';
    }
  };
  const rows = useMemo(() => {
    const limit =
      timeRange === '1h' ? 4 : timeRange === '6h' ? 6 : timeRange === '24h' ? 8 : 10;
    const filtered =
      level === 'all'
        ? systemLogs
        : systemLogs.filter((log) => log.level === level);
    return filtered.slice(0, limit);
  }, [level, timeRange]);

  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--logs"
      aria-labelledby="ov-logs"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="logs" />
          </span>
          <div>
            <h2 id="ov-logs">
              {t('overview.platform.logsTitle')}{' '}
              <Badge tone="neutral">{t('overview.platform.mockBadge')}</Badge>
            </h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.platform.logsMockMeta')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/topology"
            className="text-xs font-medium text-ink hover:opacity-80"
          >
            {t('overview.platform.openOps')} →
          </Link>
          <SearchSelect
            className="os-overview__ops-time-filter"
            size="sm"
            value={timeRange}
            options={opsTimeOptions(t)}
            onChange={(next) => setTimeRange(next as OpsTimeRangeId)}
            searchPlaceholder={t('overview.tokens.filter.search')}
            emptyText={t('overview.tokens.filter.empty')}
            aria-label={t('overview.platform.logsTime')}
          />
        </div>
      </div>
      <div
        className="os-admin-chips os-overview__log-filters"
        role="group"
        aria-label={t('overview.platform.logsFilter')}
      >
        {levels.map((id) => (
          <FilterChip
            key={id}
            label={t(levelLabel(id))}
            active={level === id}
            onClick={() => setLevel(id)}
          />
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="os-overview__log-empty">
          {t('overview.platform.logsEmpty')}
        </p>
      ) : (
        <ul className="os-overview__logs">
          {rows.map((log) => (
            <li key={log.id} className="os-overview__log">
              <span className="os-overview__log-time">{log.at}</span>
              <Badge tone={logLevelTone(log.level)}>{log.level}</Badge>
              <span className="os-overview__log-source">{log.source}</span>
              <span className="os-overview__log-msg">{log.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApiTrafficPanel() {
  const { t } = useI18n();
  const [timeRange, setTimeRange] = useState<OpsTimeRangeId>('24h');
  const series = useMemo(
    () => apiTrafficForRange(timeRange, apiTrafficSeries),
    [timeRange],
  );
  const summary = apiTrafficSummary(series);
  const deltaSign = summary.deltaPct > 0 ? '+' : '';

  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--api"
      aria-labelledby="ov-api"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="api" />
          </span>
          <div>
            <h2 id="ov-api">
              {t('overview.platform.apiTitle')}{' '}
              <Badge tone="neutral">{t('overview.platform.mockBadge')}</Badge>
            </h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.platform.apiMockMeta')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/topology"
            className="text-xs font-medium text-ink hover:opacity-80"
          >
            {t('overview.platform.openOps')} →
          </Link>
          <SearchSelect
            className="os-overview__ops-time-filter"
            size="sm"
            value={timeRange}
            options={opsTimeOptions(t)}
            onChange={(next) => setTimeRange(next as OpsTimeRangeId)}
            searchPlaceholder={t('overview.tokens.filter.search')}
            emptyText={t('overview.tokens.filter.empty')}
            aria-label={t('overview.platform.apiTime')}
          />
        </div>
      </div>
      <div className="os-overview__api-summary">
        <div>
          <p className="os-overview__kpi-label">
            {t('overview.platform.apiCurrent')}
          </p>
          <p className="os-overview__api-value">
            {formatRpm(summary.latest)}
            <span className="os-overview__api-unit">rpm</span>
          </p>
        </div>
        <div>
          <p className="os-overview__kpi-label">
            {t('overview.platform.apiPeak')}
          </p>
          <p className="os-overview__api-value os-overview__api-value--sm">
            {formatRpm(summary.peak)}
            <span className="os-overview__api-unit">rpm</span>
          </p>
        </div>
        <div>
          <p className="os-overview__kpi-label">
            {t('overview.platform.apiDelta')}
          </p>
          <p
            className="os-overview__api-delta"
            data-dir={
              summary.deltaPct > 0
                ? 'up'
                : summary.deltaPct < 0
                  ? 'down'
                  : 'flat'
            }
          >
            {deltaSign}
            {summary.deltaPct}%
          </p>
        </div>
      </div>
      <ApiTrafficChart
        className="os-overview__api-chart"
        series={series}
        ariaLabel={t('overview.platform.apiTitle')}
      />
    </section>
  );
}

function OverviewKpiIcon({
  name,
}: {
  name: OverviewKpiIconName;
}) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'traffic':
      return (
        <svg {...props}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19V8" />
        </svg>
      );
    case 'latency':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4.5L15 15" />
        </svg>
      );
    case 'errors':
      return (
        <svg {...props}>
          <path d="m12 4 9 16H3L12 4Z" />
          <path d="M12 10v4" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    case 'saturation':
      return (
        <svg {...props}>
          <path d="M5 19a9 9 0 1 1 14 0" />
          <path d="M12 19v-6" />
          <path d="m12 13 3.2-2.4" />
        </svg>
      );
    case 'tokens':
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      );
    case 'cpu':
      return (
        <svg {...props}>
          <rect x="7" y="7" width="10" height="10" rx="1.5" />
          <path d="M9 3v2M12 3v2M15 3v2M9 19v2M12 19v2M15 19v2M3 9h2M3 12h2M3 15h2M19 9h2M19 12h2M19 15h2" />
        </svg>
      );
    case 'gpu':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M7 10h4M7 14h2" />
          <circle cx="16" cy="12" r="2" />
        </svg>
      );
    case 'object':
      return (
        <svg {...props}>
          <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" />
          <path d="M12 12v8M4 7.5 12 12l8-4.5" />
        </svg>
      );
    case 'logs':
      return (
        <svg {...props}>
          <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      );
    case 'api':
      return (
        <svg {...props}>
          <path d="M3 16c2.5-6 4.5-9 7-9s4 5 5.5 5 2.8-3 5.5-6" />
          <path d="M3 19h18" />
        </svg>
      );
    case 'usage':
      return (
        <svg {...props}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-8" />
          <path d="M22 19V11" />
        </svg>
      );
    case 'commerce':
      return (
        <svg {...props}>
          <path d="M7 7h10v12H7z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
          <path d="M9 12h6" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M15 19a4.5 4.5 0 0 1 5.5-4.2" />
        </svg>
      );
    case 'payingUsers':
      return (
        <svg {...props}>
          <circle cx="10" cy="8" r="3" />
          <path d="M4 19a6 6 0 0 1 12 0" />
          <path d="M17 10h4" />
          <path d="M19 8v4" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...props}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    case 'channels':
      return (
        <svg {...props}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 11h18" />
          <path d="M8 15h3" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...props}>
          <path d="M9 6h11" />
          <path d="M9 12h11" />
          <path d="M9 18h11" />
          <path d="M4 6h.01" />
          <path d="M4 12h.01" />
          <path d="M4 18h.01" />
        </svg>
      );
    case 'gateway':
      return (
        <svg {...props}>
          <path d="M12 3v18" />
          <path d="M5 8h14" />
          <path d="M7 8v5a5 5 0 0 0 10 0V8" />
        </svg>
      );
    case 'fleet':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="7" height="7" rx="1.5" />
          <rect x="14" y="4" width="7" height="7" rx="1.5" />
          <rect x="3" y="13" width="7" height="7" rx="1.5" />
          <rect x="14" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'attention':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    case 'health':
      return (
        <svg {...props}>
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </svg>
      );
    case 'signals':
      return (
        <svg {...props}>
          <path d="M4 18V6" />
          <path d="M10 18v-8" />
          <path d="M16 18V9" />
          <path d="M22 18v-4" />
        </svg>
      );
    case 'agents':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19a7 7 0 0 1 14 0" />
          <path d="M16 5.5 18 4l1.5 2" />
        </svg>
      );
    case 'workflows':
      return (
        <svg {...props}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="12" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <path d="M8.5 7.5 15.5 11" />
          <path d="M15.5 13 8.5 16.5" />
        </svg>
      );
    case 'functions':
      return (
        <svg {...props}>
          <path d="M15 3.5c-4.2 0-6.2 2.4-6.2 6.6V21" />
          <path d="M6.5 12h10" />
          <path d="M8.8 21c1.4 1.6 3.4 2 5.4 1" />
        </svg>
      );
    case 'cells':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <path d="M13 16.5h7" />
          <path d="M16.5 13v7" />
        </svg>
      );
    case 'inference':
      return (
        <svg {...props}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
        </svg>
      );
    case 'services':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="5" rx="1.5" />
          <rect x="3" y="11" width="18" height="5" rx="1.5" />
          <rect x="3" y="18" width="11" height="2.5" rx="1" />
        </svg>
      );
    case 'resources':
      return (
        <svg {...props}>
          <path d="M4 8h16v11H4z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
          <path d="M9 13h6" />
        </svg>
      );
    default:
      return null;
  }
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function spineStatusTone(
  status: OpsSpineSnapshot['services'][number]['status'],
) {
  switch (status) {
    case 'healthy':
      return 'success' as const;
    case 'degraded':
      return 'warn' as const;
    case 'down':
      return 'danger' as const;
    default:
      return 'neutral' as const;
  }
}

function spineLabelKey(
  id: OpsSpineSnapshot['services'][number]['id'],
): MessageKey {
  switch (id) {
    case 'gateway':
      return 'ops.spine.gateway';
    case 'runtime':
      return 'ops.spine.runtime';
    case 'api':
      return 'ops.spine.api';
    case 'cloud':
      return 'ops.spine.cloud';
    case 'auth':
      return 'ops.spine.auth';
    case 'billing':
      return 'ops.spine.billing';
    case 'registry':
      return 'ops.spine.registry';
  }
}

function spineStatusKey(
  status: OpsSpineSnapshot['services'][number]['status'],
): MessageKey {
  switch (status) {
    case 'healthy':
      return 'ops.status.healthy';
    case 'degraded':
      return 'ops.status.degraded';
    case 'down':
      return 'ops.status.down';
    default:
      return 'ops.status.unknown';
  }
}

function PlatformOpsEntry({ spine }: { spine: OpsSpineSnapshot | null }) {
  const { t } = useI18n();
  return (
    <section
      className="ui-card os-overview__panel-card os-overview__panel-card--spine"
      aria-labelledby="ov-ops-spine"
    >
      <div className="os-overview__panel-card-head">
        <div className="os-overview__panel-card-title">
          <span className="os-overview__kpi-card-icon">
            <OverviewKpiIcon name="api" />
          </span>
          <div>
            <h2 id="ov-ops-spine">{t('overview.platform.spineTitle')}</h2>
            <p className="os-overview__panel-card-meta">
              {t('overview.platform.spineMeta')}
            </p>
          </div>
        </div>
        <Link
          to="/admin/topology"
          className="text-sm font-medium text-ink hover:opacity-80"
        >
          {t('overview.platform.openOps')} →
        </Link>
      </div>
      <div className="os-overview__spine-grid">
        {(spine?.services ?? []).map((svc) => (
          <Link
            key={svc.id}
            to={svc.href === '/topology' ? '/admin/topology' : svc.href}
            className="os-overview__spine-item"
          >
            <div className="os-overview__spine-item-head">
              <span className="os-overview__spine-item-name">
                {t(spineLabelKey(svc.id))}
              </span>
              <Badge tone={spineStatusTone(svc.status)}>
                {t(spineStatusKey(svc.status))}
              </Badge>
            </div>
            <p className="os-overview__spine-item-detail">{svc.detail}</p>
          </Link>
        ))}
        {!spine ? (
          <p className="col-span-full text-xs text-ink-muted">
            {t('ops.refreshing')}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PlatformDashboard() {
  const { t } = useI18n();
  const summary = poolSummary();
  const clusters = clusterCards();
  const satPct = Math.round(
    Math.max(summary.cpuUsed, summary.gpuUsed, summary.objectUsed) * 100,
  );
  const [spine, setSpine] = useState<OpsSpineSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const reload = () => {
      void loadOpsSpineSnapshot().then((snap) => {
        if (!cancelled) setSpine(snap);
      });
    };
    reload();
    const id = window.setInterval(reload, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const [rangeId, setRangeId] = useState('365d');
  const [rangeBeforeCustom, setRangeBeforeCustom] = useState('365d');
  const [customRange, setCustomRange] = useState(defaultCustomRange);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [channelId, setChannelId] = useState('all');
  const [userId, setUserId] = useState('all');

  const heatmap = useMemo(
    () =>
      buildTokenHeatmap({
        ...(rangeId === 'custom' &&
        customRange.start.slice(0, 10) &&
        customRange.end.slice(0, 10)
          ? {
              start: customRange.start.slice(0, 10),
              end: customRange.end.slice(0, 10),
            }
          : { days: daysForRange(rangeId === 'custom' ? '30d' : rangeId) }),
        channelId,
        userId,
      }),
    [rangeId, customRange, channelId, userId],
  );

  const rangeOptions = [
    { value: '30d', label: t('overview.tokens.range.30d') },
    { value: '90d', label: t('overview.tokens.range.90d') },
    { value: '365d', label: t('overview.tokens.range.365d') },
    { value: 'custom', label: t('overview.tokens.range.custom') },
  ];

  const customCommittedRef = useRef(false);

  function onRangeChange(next: string) {
    if (next === 'custom') {
      if (rangeId !== 'custom') setRangeBeforeCustom(rangeId);
      customCommittedRef.current =
        rangeId === 'custom' &&
        Boolean(customRange.start && customRange.end);
      setRangeId('custom');
      setCustomRangeOpen(true);
      return;
    }
    setRangeId(next);
  }

  function onCustomRangeOpenChange(open: boolean) {
    setCustomRangeOpen(open);
    if (open) return;
    if (!customCommittedRef.current) {
      setRangeId(rangeBeforeCustom);
    }
  }

  const channelOptions = tokenChannelOptions.map((opt) => ({
    value: opt.id,
    label:
      opt.id === 'all'
        ? t('overview.tokens.filter.allChannels')
        : opt.label,
    icon: opt.imageUrl ? (
      <img
        className="os-overview__token-filter-mark os-overview__token-filter-mark--logo"
        src={opt.imageUrl}
        alt=""
      />
    ) : undefined,
  }));
  const userOptions = tokenUserOptions.map((opt) => ({
    value: opt.id,
    label:
      opt.id === 'all' ? t('overview.tokens.filter.allUsers') : opt.label,
    icon: opt.imageUrl ? (
      <img
        className="os-overview__token-filter-mark os-overview__token-filter-mark--avatar"
        src={opt.imageUrl}
        alt=""
      />
    ) : undefined,
  }));

  const healthy = spine?.services.filter((s) => s.status === 'healthy').length ?? 0;
  const total = spine?.services.length ?? 4;

  const platformKpis = [
    {
      key: 'ops',
      to: '/admin/topology',
      icon: 'api' as const,
      label: t('overview.platform.spineTitle'),
      value: spine ? `${healthy}/${total}` : '—',
    },
    {
      key: 'gateway',
      to: '/admin/gateway',
      icon: 'traffic' as const,
      label: t('ops.spine.gateway'),
      value: spine
        ? t(spineStatusKey(spine.services.find((s) => s.id === 'gateway')?.status ?? 'unknown'))
        : '—',
    },
    {
      key: 'runtime',
      to: '/admin/topology',
      icon: 'latency' as const,
      label: t('ops.spine.runtime'),
      value: spine
        ? t(spineStatusKey(spine.services.find((s) => s.id === 'runtime')?.status ?? 'unknown'))
        : '—',
    },
    {
      key: 'saturation',
      to: '/admin/fleet',
      icon: 'saturation' as const,
      label: t('overview.kpi.saturation'),
      value: `${satPct}%`,
    },
  ];

  return (
    <>
      <PlatformOpsEntry spine={spine} />

      {/* First viewport ≤ 4 modules */}
      <section className="os-overview__kpi-cards" aria-label="KPI">
        {platformKpis.map((item, index) => (
          <Link key={item.key} to={item.to} className="ui-card os-overview__kpi-card">
            <span className="os-overview__kpi-card-icon">
              <OverviewKpiIcon name={item.icon} />
            </span>
            <div className="os-overview__kpi-card-body">
              <p className="os-overview__kpi-label">{item.label}</p>
              <KpiCountValue value={item.value} delay={index * 70} />
            </div>
          </Link>
        ))}
      </section>

      <div className="os-overview__split os-overview__split--platform">
        <ModelUsageRankPanel />
        <McpUsageRankPanel />
      </div>

      <ServicesInventoryPanel />

      <div
        className="os-overview__below"
        aria-label={t('overview.belowFold')}
      >
      <div className="os-overview__split os-overview__split--platform">
        <section
          className="ui-card os-overview__panel-card os-overview__panel-card--tokens"
          aria-labelledby="ov-tokens"
        >
          <div className="os-overview__panel-card-head">
            <div className="os-overview__panel-card-title">
              <span className="os-overview__kpi-card-icon">
                <OverviewKpiIcon name="tokens" />
              </span>
              <div>
                <h2 id="ov-tokens">{t('overview.tokens.title')}</h2>
                <p className="os-overview__panel-card-meta">
                  {fill(t('overview.tokens.total'), {
                    total: formatTokens(heatmap.total),
                  })}
                </p>
              </div>
            </div>

            <div
              className="os-overview__token-filters"
              data-custom={rangeId === 'custom' ? 'true' : undefined}
            >
              <SearchSelect
                className="os-overview__token-filter"
                size="sm"
                value={rangeId}
                options={rangeOptions}
                onChange={onRangeChange}
                searchPlaceholder={t('overview.tokens.filter.search')}
                emptyText={t('overview.tokens.filter.empty')}
                aria-label={t('overview.tokens.filter.range')}
              />
              <DateRangePicker
                variant="modal"
                showTrigger={false}
                open={customRangeOpen}
                onOpenChange={onCustomRangeOpenChange}
                value={customRange}
                onChange={(next) => {
                  customCommittedRef.current = true;
                  setCustomRange(next);
                  setRangeId('custom');
                }}
                mode="datetime"
                title={t('overview.tokens.filter.customRange')}
                startLabel={t('overview.tokens.range.start')}
                endLabel={t('overview.tokens.range.end')}
                confirmLabel={t('overview.tokens.range.confirm')}
                cancelLabel={t('overview.tokens.range.cancel')}
                preset30dLabel={t('overview.tokens.range.30d')}
                weekdayLabels={[
                  t('overview.tokens.dow.sun'),
                  t('overview.tokens.dow.mon'),
                  t('overview.tokens.dow.tue'),
                  t('overview.tokens.dow.wed'),
                  t('overview.tokens.dow.thu'),
                  t('overview.tokens.dow.fri'),
                  t('overview.tokens.dow.sat'),
                ]}
                aria-label={t('overview.tokens.filter.customRange')}
              />
              <SearchSelect
                className="os-overview__token-filter"
                size="sm"
                value={channelId}
                options={channelOptions}
                onChange={setChannelId}
                searchPlaceholder={t('overview.tokens.filter.search')}
                emptyText={t('overview.tokens.filter.empty')}
                aria-label={t('overview.tokens.filter.channel')}
              />
              <SearchSelect
                className="os-overview__token-filter"
                size="sm"
                value={userId}
                options={userOptions}
                onChange={setUserId}
                searchPlaceholder={t('overview.tokens.filter.search')}
                emptyText={t('overview.tokens.filter.empty')}
                aria-label={t('overview.tokens.filter.user')}
              />
            </div>
          </div>

          <TokenHeatmap
            className="os-overview__heatmap"
            weeks={heatmap.weeks}
            lessLabel={t('overview.tokens.legend.less')}
            moreLabel={t('overview.tokens.legend.more')}
            formatTokens={formatTokens}
            tokensLabel="tokens"
            weekdayLabels={[
              t('overview.tokens.dow.sun'),
              t('overview.tokens.dow.mon'),
              t('overview.tokens.dow.tue'),
              t('overview.tokens.dow.wed'),
              t('overview.tokens.dow.thu'),
              t('overview.tokens.dow.fri'),
              t('overview.tokens.dow.sat'),
            ]}
          />
        </section>

        <section
          className="ui-card os-overview__panel-card os-overview__panel-card--clusters"
          aria-labelledby="ov-pools"
        >
          <div className="os-overview__panel-card-head">
            <h2 id="ov-pools">{t('overview.platform.poolsTitle')}</h2>
            <Link to="/admin/fleet" className="os-overview__link">
              {t('overview.platform.openFleet')}
            </Link>
          </div>
          <div className="os-overview__cluster-list">
            {clusters.map((cluster) => {
              const computePct =
                cluster.computeUsedRatio == null
                  ? null
                  : Math.round(cluster.computeUsedRatio * 100);
              const memoryPct = Math.round(cluster.memoryUsedRatio * 100);
              const showHealth = cluster.health !== 'healthy';
              return (
                <Link
                  key={cluster.kind}
                  to={cluster.href}
                  className="os-overview__cluster-row"
                  data-health={cluster.health}
                >
                  <div className="os-overview__cluster-identity">
                    <div className="os-overview__cluster-title-row">
                      <p className="os-overview__cluster-name">
                        {cluster.kind === 'cpu'
                          ? t('overview.platform.cluster.cpu')
                          : cluster.kind === 'gpu'
                            ? t('overview.platform.cluster.gpu')
                            : t('overview.platform.cluster.object')}
                      </p>
                      {showHealth ? (
                        <span
                          className="os-overview__cluster-health"
                          data-health={cluster.health}
                        >
                          {poolHealthLabel(cluster.health, t)}
                        </span>
                      ) : null}
                    </div>
                    {cluster.pendingClaims > 0 ? (
                      <p className="os-overview__cluster-pending-line">
                        {fill(t('overview.platform.pending'), {
                          n: cluster.pendingClaims,
                        })}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className="os-overview__cluster-metrics"
                    data-layout={
                      cluster.kind === 'object' ? 'storage' : undefined
                    }
                  >
                    {cluster.kind === 'object' ? (
                      <div
                        className="os-overview__cluster-storage"
                        data-tone={utilTone(memoryPct)}
                      >
                        <div className="os-overview__cluster-storage-head">
                          <span className="os-overview__cluster-metric-kind">
                            {t('overview.platform.metric.storage')}
                          </span>
                          <span className="os-overview__cluster-storage-pct">
                            {fill(t('overview.platform.used'), {
                              pct: memoryPct,
                            })}
                          </span>
                          <span className="os-overview__cluster-storage-quota">
                            {fill(t('overview.platform.storage.quota'), {
                              size: cluster.memoryLabel,
                            })}
                          </span>
                        </div>
                        <div
                          className="os-overview__cluster-storage-track"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={memoryPct}
                          aria-label={`${t('overview.platform.metric.storage')} ${fill(t('overview.platform.used'), { pct: memoryPct })}`}
                        >
                          <span
                            className="os-overview__cluster-storage-fill"
                            style={{ width: `${memoryPct}%` }}
                          />
                        </div>
                        <div className="os-overview__cluster-storage-foot">
                          <span>
                            {fill(t('overview.platform.storage.used'), {
                              size: cluster.storageUsedLabel ?? '—',
                            })}
                          </span>
                          <span>
                            {fill(t('overview.platform.storage.free'), {
                              size: cluster.memoryFreeLabel,
                            })}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {computePct != null && cluster.computeLabel ? (
                          <div
                            className="os-overview__cluster-metric"
                            data-tone={utilTone(computePct)}
                          >
                            <RingProgress
                              value={computePct}
                              size={46}
                              strokeWidth={4.5}
                              label={`${t('overview.platform.metric.compute')} ${fill(t('overview.platform.used'), { pct: computePct })}`}
                            />
                            <div className="os-overview__cluster-metric-meta">
                              <span className="os-overview__cluster-metric-kind">
                                {t('overview.platform.metric.compute')}
                              </span>
                              <span className="os-overview__cluster-metric-value">
                                {cluster.computeLabel}
                              </span>
                              <span className="os-overview__cluster-metric-free">
                                {cluster.computeFreeLabel}
                              </span>
                            </div>
                          </div>
                        ) : null}
                        <div
                          className="os-overview__cluster-metric"
                          data-tone={utilTone(memoryPct)}
                        >
                          <RingProgress
                            value={memoryPct}
                            size={46}
                            strokeWidth={4.5}
                            label={`${t('overview.platform.metric.memory')} ${fill(t('overview.platform.used'), { pct: memoryPct })}`}
                          />
                          <div className="os-overview__cluster-metric-meta">
                            <span className="os-overview__cluster-metric-kind">
                              {t('overview.platform.metric.memory')}
                            </span>
                            <span className="os-overview__cluster-metric-value">
                              {cluster.memoryLabel}
                            </span>
                            <span className="os-overview__cluster-metric-free">
                              {cluster.memoryFreeLabel}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      <div className="os-overview__split os-overview__split--bottom">
        <SystemLogsPanel />
        <ApiTrafficPanel />
      </div>
      </div>
    </>
  );
}

export function OverviewPage({ lens = 'home' }: { lens?: OverviewLens }) {
  const { t } = useI18n();
  const copy = LENS_COPY[lens];

  return (
    <div className="os-overview" data-lens={lens}>
      <header className="os-overview__hero">
        <ConsolePageHeader title={t(copy.title)} actions={<OverviewRefreshControls />} />
      </header>

      {lens === 'home' ? <HomeDashboard /> : null}

      {lens === 'platform' ? <PlatformDashboard /> : null}
    </div>
  );
}
