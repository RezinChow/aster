import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ConsoleConfirmDialog,
  CopyButton,
  ConsoleDialog,
  ConsoleDrawer,
  ConsoleEmptyState,
  Input,
  ListToolbar,
  SearchSelect,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { ListRowAction, ListRowActions } from '@/components/ListRowActions';
import { IconCopy, IconPlus, IconSettings, IconTerminal } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  cancelCloudMaintenance,
  drainCloudNode,
  generateEnrollmentToken,
  removeCloudNode,
  issueCloudEnrollmentToken,
  listCloudNodeCapacities,
  listCloudNodePools,
  listCloudNodes,
  readyCloudNode,
  scheduleCloudMaintenance,
  type CloudNode,
  type CloudNodeCapacity,
  type CloudNodeHostObservation,
  type CloudNodePool,
} from '@/lib/fleetApi';
import {
  FLEET_SSH_BRIDGE_HTTP,
  planFleetNodeSsh,
  type FleetNodeSshRefusal,
} from '@/lib/fleetSsh';
import { statusTone } from '@/lib/status';
import { FleetSshWindow } from '@/pages/FleetSshWindow';

function reportedGpu(
  models: string[] | null | undefined,
  none: string,
  unreported: string,
) {
  if (!models) return unreported;
  return models.length ? models.join(' · ') : none;
}

function hostIdentityLine(host: CloudNodeHostObservation | null | undefined) {
  const parts = [host?.operatingSystem?.trim(), host?.architecture?.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function listedAddresses(addresses: string[] | null | undefined) {
  if (!addresses?.length) return null;
  const ipv4 = addresses.filter((address) => address.includes('.') && !address.includes(':'));
  return (ipv4.length ? ipv4 : addresses).join(', ');
}

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
}

function formatCapacity(amount: number, unit: string, coresLabel: (n: string) => string) {
  if (unit === 'milli_cpu') {
    const cores = amount / 1000;
    const text = Number.isInteger(cores) ? String(cores) : cores.toFixed(1);
    return coresLabel(text);
  }
  if (unit === 'byte') {
    const gib = amount / 1024 ** 3;
    if (gib >= 1) return `${gib >= 10 ? Math.round(gib) : gib.toFixed(1)} GiB`;
    return `${Math.round(amount / 1024 ** 2)} MiB`;
  }
  if (unit === 'count') return String(amount);
  return String(amount);
}

function slotOf(snapshot: CloudNodeCapacity | undefined, kind: string) {
  return snapshot?.slots.find((item) => item.kind === kind);
}

function CapacityConfig({
  snapshot,
  labels,
}: {
  snapshot: CloudNodeCapacity | undefined;
  labels: {
    cpu: string;
    memory: string;
    disk: string;
    gpu: string;
    none: string;
    unreported: string;
    cores: (n: string) => string;
    hint: string;
  };
}) {
  const cpu = slotOf(snapshot, 'cpu');
  const memory = slotOf(snapshot, 'memory');
  const disk = slotOf(snapshot, 'ephemeral_storage');
  const gpu = slotOf(snapshot, 'accelerator');
  const rows = [
    {
      key: 'cpu',
      label: labels.cpu,
      value: cpu ? formatCapacity(cpu.amount, cpu.unit, labels.cores) : labels.unreported,
    },
    {
      key: 'memory',
      label: labels.memory,
      value: memory
        ? formatCapacity(memory.amount, memory.unit, labels.cores)
        : labels.unreported,
    },
    {
      key: 'disk',
      label: labels.disk,
      value: disk ? formatCapacity(disk.amount, disk.unit, labels.cores) : labels.unreported,
    },
    {
      key: 'gpu',
      label: labels.gpu,
      value: !snapshot
        ? labels.unreported
        : gpu
          ? formatCapacity(gpu.amount, gpu.unit, labels.cores)
          : labels.none,
    },
  ];
  return (
    <div className="min-w-[11rem]" title={labels.hint}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] leading-4">
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <dt className="text-ink-muted">{row.label}</dt>
            <dd className="tabular-nums text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type SparkTone = 'ink' | 'warning' | 'danger';

function utilizationTone(ratio: number | null): SparkTone {
  if (ratio == null || Number.isNaN(ratio)) return 'ink';
  if (ratio >= 0.9) return 'danger';
  if (ratio >= 0.7) return 'warning';
  return 'ink';
}

/** Load relative to vCPU count: ≥1.0 saturated, ≥1.5 overloaded. */
function loadTone(load1: number | null, cores: number | null): SparkTone {
  if (load1 == null || cores == null || cores <= 0) return 'ink';
  const ratio = load1 / cores;
  if (ratio >= 1.5) return 'danger';
  if (ratio >= 1.0) return 'warning';
  return 'ink';
}

function toneClass(tone: SparkTone) {
  if (tone === 'danger') return 'text-[color:var(--color-error)]';
  if (tone === 'warning') return 'text-[color:var(--color-warning)]';
  return 'text-ink';
}

function toneFill(tone: SparkTone) {
  if (tone === 'danger') return 'bg-[color:var(--color-error)]';
  if (tone === 'warning') return 'bg-[color:var(--color-warning)]';
  return 'bg-ink/70';
}

/** Compact sparkline: fixed domain from zero for absolute pressure, area for util, line for load. */
function MiniSpark({
  values,
  label,
  variant = 'area',
  domainMax,
  tone = 'ink',
}: {
  values: Array<number | null | undefined>;
  label: string;
  variant?: 'area' | 'line';
  /** When set, y-scale is [0, domainMax] so absolute level is readable (not just local delta). */
  domainMax?: number | null;
  tone?: SparkTone;
}) {
  const points = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const width = 120;
  const height = 36;
  const padY = 2;

  if (points.length < 2) {
    return (
      <div
        className="flex h-9 items-center text-[11px] text-ink-faint"
        aria-label={label}
      >
        —
      </div>
    );
  }

  const dataMax = Math.max(...points);
  const top = Math.max(domainMax && domainMax > 0 ? domainMax : dataMax, dataMax, Number.EPSILON);
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - padY - (Math.min(value, top) / top) * (height - padY * 2);
    return { x, y };
  });
  const line = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-9 w-full ${toneClass(tone)}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {variant === 'area' ? (
        <path d={area} fill="currentColor" fillOpacity="0.12" stroke="none" />
      ) : null}
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last.x} cy={last.y} r="2" fill="currentColor" />
    </svg>
  );
}

function MetricTile({
  label,
  primary,
  secondary,
  ratio,
  tone,
  values,
  sparkVariant = 'area',
  domainMax,
  empty,
}: {
  label: string;
  primary: string;
  secondary?: string;
  /** 0–1 for progress bar fill. */
  ratio?: number | null;
  tone?: SparkTone;
  values: Array<number | null | undefined>;
  sparkVariant?: 'area' | 'line';
  domainMax?: number | null;
  empty: string;
}) {
  const hasPrimary = primary.trim().length > 0 && primary !== '—';
  const resolvedTone = tone ?? utilizationTone(ratio ?? null);
  return (
    <div className="min-w-0 space-y-2 border-l border-border/70 pl-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="text-[11px] text-ink-muted">{label}</div>
          <div
            className={`truncate text-sm font-medium tabular-nums ${toneClass(resolvedTone)}`}
          >
            {hasPrimary ? primary : empty}
          </div>
          {secondary ? (
            <div className="truncate text-[10px] tabular-nums text-ink-faint">{secondary}</div>
          ) : null}
        </div>
        <div className="w-[7.5rem] shrink-0 pt-0.5">
          <MiniSpark
            label={label}
            values={values}
            variant={sparkVariant}
            domainMax={domainMax}
            tone={resolvedTone}
          />
        </div>
      </div>
      {ratio != null && Number.isFinite(ratio) ? (
        <div className="h-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${toneFill(resolvedTone)}`}
            style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function NodeExpandPanel({
  snapshot,
  labels,
  locale,
}: {
  snapshot: CloudNodeCapacity | undefined;
  locale: string;
  labels: {
    identity: string;
    metrics: string;
    load: string;
    loadWindow: string;
    memory: string;
    disk: string;
    used: string;
    available: string;
    ofTotal: string;
    machineModel: string;
    cpuModel: string;
    gpuModel: string;
    hostname: string;
    address: string;
    unreported: string;
    noSamples: string;
    observed: string;
    cores: (n: string) => string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  };
}) {
  const host = snapshot?.host ?? null;
  const cpuSlot = slotOf(snapshot, 'cpu');
  const memoryTotal = slotOf(snapshot, 'memory')?.amount ?? null;
  const diskTotal = slotOf(snapshot, 'ephemeral_storage')?.amount ?? null;
  const formatBytes = (amount: number) => formatCapacity(amount, 'byte', labels.cores);
  const cpuCores =
    cpuSlot?.unit === 'milli_cpu' && cpuSlot.amount > 0 ? cpuSlot.amount / 1000 : null;

  const memoryUsed =
    memoryTotal != null && host?.memoryAvailableBytes != null
      ? Math.max(0, memoryTotal - host.memoryAvailableBytes)
      : null;
  const diskUsed =
    diskTotal != null && host?.diskAvailableBytes != null
      ? Math.max(0, diskTotal - host.diskAvailableBytes)
      : null;
  const memoryRatio =
    memoryTotal != null && memoryTotal > 0 && memoryUsed != null
      ? memoryUsed / memoryTotal
      : null;
  const diskRatio =
    diskTotal != null && diskTotal > 0 && diskUsed != null ? diskUsed / diskTotal : null;

  const samples = host?.samples ?? [];
  const memorySeries = samples.map((sample) =>
    memoryTotal == null || sample.memoryAvailableBytes == null
      ? null
      : Math.max(0, memoryTotal - sample.memoryAvailableBytes),
  );
  const diskSeries = samples.map((sample) =>
    diskTotal == null || sample.diskAvailableBytes == null
      ? null
      : Math.max(0, diskTotal - sample.diskAvailableBytes),
  );
  const loadSeries = samples.map((sample) => sample.load1);

  const identityBits = [
    host?.machineModel?.trim(),
    host?.operatingSystem?.trim(),
    host?.architecture?.trim(),
    host?.cpuModel?.trim(),
    host?.gpuModels?.length ? host.gpuModels.join(' · ') : null,
  ].filter(Boolean) as string[];

  const networkBits = [
    host?.hostname?.trim(),
    host?.addresses?.length ? host.addresses.join(', ') : null,
  ].filter(Boolean) as string[];

  const observed = host?.observedAt
    ? formatObservedAt(host.observedAt, locale, {
        justNow: labels.justNow,
        minutesAgo: labels.minutesAgo,
        hoursAgo: labels.hoursAgo,
        daysAgo: labels.daysAgo,
      })
    : null;

  const loadPrimary =
    host?.load1 == null ? '—' : host.load1.toFixed(2);
  const loadSecondary =
    host?.load1 == null
      ? undefined
      : fill(labels.loadWindow, {
          five: host.load5?.toFixed(2) ?? '—',
          fifteen: host.load15?.toFixed(2) ?? '—',
          cores: cpuCores != null ? labels.cores(String(cpuCores)) : labels.unreported,
        });

  return (
    <div className="space-y-3 p-3">
      <section className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className="text-xs text-ink-faint">
            {labels.identity}
          </h4>
          {observed ? (
            <time
              className="text-[11px] tabular-nums text-ink-muted"
              dateTime={host?.observedAt ?? undefined}
              title={observed.absolute}
            >
              {labels.observed} {observed.relative}
            </time>
          ) : null}
        </div>
        <p className="text-sm text-ink">
          {identityBits.length ? identityBits.join(' · ') : labels.unreported}
        </p>
        {networkBits.length ? (
          <p className="truncate font-mono text-[11px] text-ink-muted">{networkBits.join(' · ')}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h4 className="text-xs text-ink-faint">
          {labels.metrics}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MetricTile
            label={labels.memory}
            primary={
              memoryUsed != null && memoryTotal != null
                ? fill(labels.ofTotal, {
                    used: formatBytes(memoryUsed),
                    total: formatBytes(memoryTotal),
                  })
                : '—'
            }
            secondary={
              memoryRatio != null
                ? `${Math.round(memoryRatio * 100)}% · ${labels.available} ${
                    host?.memoryAvailableBytes != null
                      ? formatBytes(host.memoryAvailableBytes)
                      : '—'
                  }`
                : undefined
            }
            ratio={memoryRatio}
            values={memorySeries}
            domainMax={memoryTotal}
            empty={labels.unreported}
          />
          <MetricTile
            label={labels.disk}
            primary={
              diskUsed != null && diskTotal != null
                ? fill(labels.ofTotal, {
                    used: formatBytes(diskUsed),
                    total: formatBytes(diskTotal),
                  })
                : '—'
            }
            secondary={
              diskRatio != null
                ? `${Math.round(diskRatio * 100)}% · ${labels.available} ${
                    host?.diskAvailableBytes != null
                      ? formatBytes(host.diskAvailableBytes)
                      : '—'
                  }`
                : undefined
            }
            ratio={diskRatio}
            values={diskSeries}
            domainMax={diskTotal}
            empty={labels.unreported}
          />
          <MetricTile
            label={labels.load}
            primary={loadPrimary}
            secondary={loadSecondary}
            ratio={
              cpuCores != null && host?.load1 != null
                ? Math.min(1, host.load1 / Math.max(cpuCores, Number.EPSILON))
                : null
            }
            tone={loadTone(host?.load1 ?? null, cpuCores)}
            values={loadSeries}
            sparkVariant="line"
            domainMax={
              cpuCores != null
                ? Math.max(
                    cpuCores,
                    ...loadSeries.filter((value): value is number => value != null),
                    1,
                  )
                : null
            }
            empty={labels.unreported}
          />
        </div>
        {samples.length < 2 ? (
          <p className="text-[11px] text-ink-faint">{labels.noSamples}</p>
        ) : null}
      </section>
    </div>
  );
}

function formatObservedAt(
  value: string,
  locale: string,
  labels: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
  },
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { relative: value, absolute: value };
  const deltaSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  let relative: string;
  if (deltaSec < 45) relative = labels.justNow;
  else if (deltaSec < 3600) {
    relative = fill(labels.minutesAgo, { n: Math.max(1, Math.floor(deltaSec / 60)) });
  } else if (deltaSec < 86400) {
    relative = fill(labels.hoursAgo, { n: Math.floor(deltaSec / 3600) });
  } else {
    relative = fill(labels.daysAgo, { n: Math.floor(deltaSec / 86400) });
  }
  const absolute = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return { relative, absolute };
}

function stateLabel(state: string, labels: Record<string, string>) {
  return labels[state] ?? state;
}

function DetailSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs text-ink-faint" title={hint}>
        {title}
      </h3>
      {hint ? <p className="text-[11px] leading-4 text-ink-faint">{hint}</p> : null}
      {children}
    </section>
  );
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

const CAPABILITY_GROUPS = [
  { id: 'features', keys: ['features'] },
  { id: 'units', keys: ['unit_classes', 'unitClasses'] },
  { id: 'network', keys: ['network_modes', 'networkModes'] },
  { id: 'isolation', keys: ['isolation_levels', 'isolationLevels'] },
  { id: 'resources', keys: ['resource_controls', 'resourceControls'] },
  { id: 'mounts', keys: ['mount_kinds', 'mountKinds'] },
  { id: 'health', keys: ['health_check_kinds', 'healthCheckKinds'] },
  { id: 'media', keys: ['artifact_media_types', 'artifactMediaTypes'] },
] as const;

function capabilityGroups(value: unknown): { id: string; items: string[] }[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return CAPABILITY_GROUPS.flatMap((group) => {
    const key = group.keys.find((candidate) => candidate in record);
    if (!key) return [];
    const items = stringList(record[key]);
    return items.length ? [{ id: group.id, items }] : [];
  });
}

function NodeDetail({
  node,
  host,
  snapshot,
  poolName,
  labels,
}: {
  node: CloudNode;
  host: CloudNodeHostObservation | null;
  snapshot: CloudNodeCapacity | undefined;
  poolName: string | null;
  labels: {
    ready: string;
    draining: string;
    offline: string;
    pending: string;
    revoked: string;
    online: string;
    offlineAvailability: string;
    identity: string;
    machineModel: string;
    cpuModel: string;
    gpuModel: string;
    network: string;
    hostname: string;
    address: string;
    copy: string;
    copied: string;
    placement: string;
    pool: string;
    none: string;
    provider: string;
    version: string;
    capacity: string;
    capacityHint: string;
    cpu: string;
    memory: string;
    disk: string;
    gpu: string;
    unreported: string;
    cores: (n: string) => string;
    capabilities: string;
    cap: Record<string, string>;
  };
}) {
  const system = [host?.operatingSystem?.trim(), host?.architecture?.trim()].filter(Boolean);
  const addresses = listedAddresses(host?.addresses)
    ? [
        ...(host?.addresses ?? []).filter((address) => address.includes('.') && !address.includes(':')),
        ...(host?.addresses ?? []).filter((address) => address.includes(':')),
      ]
    : [];
  const capacityRows = (['cpu', 'memory', 'ephemeral_storage', 'accelerator'] as const).map(
    (kind) => {
      const slot = slotOf(snapshot, kind);
      const label =
        kind === 'cpu'
          ? labels.cpu
          : kind === 'memory'
            ? labels.memory
            : kind === 'ephemeral_storage'
              ? labels.disk
              : labels.gpu;
      const value = !snapshot
        ? labels.unreported
        : slot
          ? formatCapacity(slot.amount, slot.unit, labels.cores)
          : kind === 'accelerator'
            ? labels.none
            : labels.unreported;
      return { key: kind, label, value };
    },
  );
  const groups = capabilityGroups(node.capabilities);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        <Badge
          tone={
            node.state === 'ready'
              ? 'success'
              : node.state === 'draining'
                ? 'warn'
                : node.state === 'revoked'
                  ? 'danger'
                  : 'neutral'
          }
        >
          {stateLabel(node.state, {
            ready: labels.ready,
            draining: labels.draining,
            offline: labels.offline,
            pending: labels.pending,
            revoked: labels.revoked,
          })}
        </Badge>
        <Badge tone={statusTone(node.availability === 'offline' ? 'offline' : 'ready')}>
          {node.availability === 'offline' ? labels.offlineAvailability : labels.online}
        </Badge>
      </div>

      <DetailSection title={labels.identity}>
        <p className="text-sm text-ink">
          {host?.machineModel?.trim() || labels.unreported}
        </p>
        <p className="text-[11px] text-ink-muted">
          {system.length ? system.join(' · ') : labels.unreported}
        </p>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-muted">{labels.cpuModel}</dt>
          <dd>{host?.cpuModel?.trim() || labels.unreported}</dd>
          <dt className="text-ink-muted">{labels.gpuModel}</dt>
          <dd>{reportedGpu(host?.gpuModels, labels.none, labels.unreported)}</dd>
        </dl>
      </DetailSection>

      <DetailSection title={labels.network}>
        <dl className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-ink-muted">{labels.hostname}</dt>
          <dd className="truncate font-mono text-[12px]">
            {host?.hostname?.trim() || labels.unreported}
          </dd>
          <dt className="self-start pt-1 text-ink-muted">{labels.address}</dt>
          <dd className="space-y-1">
            {addresses.length ? (
              addresses.map((address) => (
                <div key={address} className="flex items-center gap-1">
                  <span className="min-w-0 break-all font-mono text-[12px]">{address}</span>
                  <CopyButton
                    value={address}
                    label={labels.copy}
                    copiedLabel={labels.copied}
                    className="!h-6 shrink-0 !px-1.5 !text-[11px]"
                  />
                </div>
              ))
            ) : (
              labels.unreported
            )}
          </dd>
        </dl>
      </DetailSection>

      <DetailSection title={labels.placement}>
        <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-muted">{labels.pool}</dt>
          <dd>{poolName ?? labels.none}</dd>
          <dt className="text-ink-muted">{labels.provider}</dt>
          <dd>{node.runtimeProviderId}</dd>
          <dt className="text-ink-muted">{labels.version}</dt>
          <dd className="font-mono text-[12px]">{node.agentVersion}</dd>
        </dl>
      </DetailSection>

      <DetailSection title={labels.capacity} hint={labels.capacityHint}>
        <div className="grid grid-cols-2 gap-2">
          {capacityRows.map((row) => (
            <div key={row.key} className="rounded-md border border-border/70 px-3 py-2">
              <div className="text-[11px] text-ink-muted">{row.label}</div>
              <div className="text-sm font-medium tabular-nums text-ink">{row.value}</div>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title={labels.capabilities}>
        {groups.length ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="space-y-1.5">
                {groups.length > 1 ? (
                  <div className="text-[11px] text-ink-muted">{labels.cap[group.id]}</div>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] text-ink"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{labels.unreported}</p>
        )}
      </DetailSection>
    </div>
  );
}

function availabilityLabel(availability: string, labels: Record<string, string>) {
  return labels[availability] ?? availability;
}

function toIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function FleetPage() {
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [nodes, setNodes] = useState<CloudNode[]>([]);
  const [pools, setPools] = useState<CloudNodePool[]>([]);
  const [capacities, setCapacities] = useState<CloudNodeCapacity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sshTarget, setSshTarget] = useState<{ name: string; host: string } | null>(null);
  const [sshAccount, setSshAccount] = useState<string | null>(null);
  const [sshAccountFailed, setSshAccountFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drainTarget, setDrainTarget] = useState<CloudNode | null>(null);
  const [removeTarget, setRemoveTarget] = useState<CloudNode | null>(null);
  const [readyTarget, setReadyTarget] = useState<CloudNode | null>(null);
  const [maintainTarget, setMaintainTarget] = useState<CloudNode | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollName, setEnrollName] = useState('');
  const [enrollHours, setEnrollHours] = useState('12');
  const [issuedScript, setIssuedScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(FLEET_SSH_BRIDGE_HTTP)
      .then((response) => response.json())
      .then((body: { user?: string }) => {
        if (cancelled) return;
        const account = body.user?.trim();
        if (account) setSshAccount(account);
        else setSshAccountFailed(true);
      })
      .catch(() => {
        if (!cancelled) setSshAccountFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextNodes, nextPools, nextCapacities] = await Promise.all([
        listCloudNodes(),
        listCloudNodePools(),
        listCloudNodeCapacities().catch(() => [] as CloudNodeCapacity[]),
      ]);
      setNodes(nextNodes);
      setPools(nextPools);
      setCapacities(nextCapacities);
    } catch (err) {
      setNodes([]);
      setPools([]);
      setCapacities([]);
      setError(err instanceof ApiRequestError ? err.message : tRef.current('fleet.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Soft-refresh capacities while a row is expanded so charts stay live.
  useEffect(() => {
    if (!expandedId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await listCloudNodeCapacities();
        if (!cancelled) setCapacities(next);
      } catch {
        /* keep last good snapshot */
      }
    };
    const id = window.setInterval(() => {
      void tick();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [expandedId]);

  const poolParam = searchParams.get('pool');
  const pool =
    poolParam && pools.some((item) => item.name === poolParam) ? poolParam : 'all';
  const selectedPool = pools.find((item) => item.name === pool) ?? null;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const memberIds = selectedPool ? new Set(selectedPool.memberNodeIds) : null;
    return nodes.filter((node) => {
      if (memberIds && !memberIds.has(node.id)) return false;
      if (!needle) return true;
      return (
        node.name.toLowerCase().includes(needle) ||
        node.id.toLowerCase().includes(needle) ||
        node.state.toLowerCase().includes(needle) ||
        node.runtimeProviderId.toLowerCase().includes(needle)
      );
    });
  }, [nodes, q, selectedPool]);

  const capacityById = useMemo(() => {
    const map = new Map<string, CloudNodeCapacity>();
    for (const snapshot of capacities) map.set(snapshot.nodeId, snapshot);
    return map;
  }, [capacities]);

  const selected = nodes.find((node) => node.id === selectedId) ?? null;
  const selectedPoolForNode = selected
    ? pools.find((item) => item.memberNodeIds.includes(selected.id)) ?? null
    : null;

  function writePool(next: string) {
    const params = new URLSearchParams(searchParams);
    if (!next || next === 'all') params.delete('pool');
    else params.set('pool', next);
    params.delete('role');
    setSearchParams(params, { replace: true });
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : t('fleet.loadFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell title={t('nav.fleet')} description={t('nav.fleetDesc')}>
      {error && !/^(GET|POST|PUT|PATCH|DELETE) \//.test(error) ? (
        <p className="text-sm text-danger">{error}</p>
      ) : null}
      {pools.length > 0 ? (
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink">{t('fleet.pools')}</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {pools.map((item) => {
              const active = pool === item.name;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onClick={() => writePool(active ? 'all' : item.name)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      writePool(active ? 'all' : item.name);
                    }
                  }}
                  className={
                    active
                      ? 'rounded-md border border-ink p-3 text-left'
                      : 'rounded-md border border-border/70 p-3 text-left'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{item.name}</span>
                    <span className="text-xs text-ink-muted">
                      {fill(t('fleet.pool.members'), { n: item.memberNodeIds.length })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {fill(t('fleet.pool.version'), { n: item.aggregateVersion })}
                  </p>
                  {item.maintenance && !item.maintenance.cancelledAt ? (
                    <p className="mt-1 flex items-center justify-between gap-2 text-xs text-ink">
                      <span>
                        {item.maintenance.status} · {item.maintenance.reason}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation();
                          const window = item.maintenance;
                          if (!window) return;
                          void run(() =>
                            cancelCloudMaintenance({
                              nodePoolId: item.id,
                              expectedVersion: item.aggregateVersion,
                              maintenanceGeneration: window.generation,
                            }),
                          );
                        }}
                      >
                        {t('fleet.action.cancelMaintenance')}
                      </Button>
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
      </section>
      ) : null}

      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('fleet.search')}
        filters={
          <SearchSelect
            size="sm"
            searchable={pools.length > 8}
            allowClear={false}
            className="w-48"
            aria-label={t('fleet.filter.pool')}
            value={pool}
            onChange={(value) => writePool(value || 'all')}
            options={[
              { value: 'all', label: t('fleet.filter.allPools') },
              ...pools.map((item) => ({ value: item.name, label: item.name })),
            ]}
          />
        }
        primaryAction={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEnrollName('');
              setEnrollHours('12');
              setIssuedScript(null);
              setCopied(false);
              setEnrollOpen(true);
            }}
          >
            <IconPlus />
            {t('fleet.addNode')}
          </Button>
        }
      />

      <I18nDataTable
        rows={rows}
        rowKey={(node) => node.id}
        onRefresh={reload}
        columns={[
          {
            id: 'name',
            header: t('fleet.col.name'),
            sortable: true,
            getSortValue: (node) => node.name,
            cell: (node) => (
              <div className="min-w-[10rem]">
                <button
                  type="button"
                  className="text-left font-medium text-ink underline-offset-2 hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(node.id);
                  }}
                >
                  {node.name}
                </button>
                <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                  {node.id.slice(0, 8)}
                </p>
              </div>
            ),
          },
          {
            id: 'host',
            header: t('fleet.col.host'),
            cell: (node) => {
              const host = capacityById.get(node.id)?.host;
              return (
                <div className="max-w-[18rem] text-[11px] leading-4">
                  <div className="truncate text-ink">
                    {host?.machineModel?.trim() || t('fleet.capacity.unreported')}
                  </div>
                  <div className="truncate text-ink-muted">
                    {hostIdentityLine(host) || t('fleet.capacity.unreported')}
                  </div>
                  <div className="truncate font-mono text-ink-muted">
                    {listedAddresses(host?.addresses) || t('fleet.capacity.unreported')}
                  </div>
                </div>
              );
            },
          },
          {
            id: 'state',
            header: t('fleet.col.state'),
            sortable: true,
            getSortValue: (node) => node.state,
            cell: (node) => (
              <Badge
                tone={
                  node.state === 'ready'
                    ? 'success'
                    : node.state === 'draining'
                      ? 'warn'
                      : node.state === 'revoked'
                        ? 'danger'
                        : 'neutral'
                }
              >
                {stateLabel(node.state, {
                  ready: t('fleet.status.ready'),
                  draining: t('fleet.status.draining'),
                  offline: t('fleet.status.offline'),
                  pending: t('fleet.status.pending'),
                  revoked: t('fleet.status.revoked'),
                })}
              </Badge>
            ),
          },
          {
            id: 'availability',
            header: t('fleet.col.availability'),
            cell: (node) => (
              <Badge tone={statusTone(node.availability === 'offline' ? 'offline' : 'ready')}>
                {availabilityLabel(node.availability, {
                  online: t('fleet.availability.online'),
                  offline: t('fleet.availability.offline'),
                })}
              </Badge>
            ),
          },
          {
            id: 'provider',
            header: t('fleet.col.provider'),
            cell: (node) => (
              <div className="text-[11px] leading-4">
                <div className="text-ink">{node.runtimeProviderId}</div>
                <div className="font-mono text-ink-muted">{node.agentVersion}</div>
              </div>
            ),
          },
          {
            id: 'capacity',
            header: t('fleet.col.config'),
            cell: (node) => (
              <CapacityConfig
                snapshot={capacityById.get(node.id)}
                labels={{
                  cpu: t('fleet.capacity.cpu'),
                  memory: t('fleet.capacity.memory'),
                  disk: t('fleet.capacity.disk'),
                  gpu: t('fleet.capacity.gpu'),
                  none: t('fleet.capacity.none'),
                  unreported: t('fleet.capacity.unreported'),
                  cores: (n) => fill(t('fleet.capacity.cores'), { n }),
                  hint: t('fleet.capacity.hint'),
                }}
              />
            ),
          },
          {
            id: 'ssh',
            header: t('fleet.action.ssh'),
            cell: (node) => {
              const observed = capacityById.get(node.id)?.host;
              const gate = planFleetNodeSsh({
                state: node.state,
                hostname: observed?.hostname,
                addresses: observed?.addresses,
              });
              const reason: FleetNodeSshRefusal | null = gate.ok ? null : gate.reason;
              return (
                <div className="flex flex-col items-start gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    disabled={reason != null}
                    data-fleet-ssh-reason={reason ?? undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!gate.ok) return;
                      setSshTarget({ name: node.name, host: gate.host });
                    }}
                  >
                    <IconTerminal />
                    {t('fleet.action.ssh')}
                  </Button>
                  {reason ? (
                    <p className="max-w-[12rem] text-[11px] leading-4 text-ink-muted">
                      {reason === 'revoked' ? t('fleet.ssh.revoked') : t('fleet.ssh.noAddress')}
                    </p>
                  ) : null}
                </div>
              );
            },
          },
          {
            id: 'observed',
            header: t('fleet.col.observed'),
            sortable: true,
            getSortValue: (node) => node.lastObservedAt,
            cell: (node) => {
              const observed = formatObservedAt(node.lastObservedAt, locale, {
                justNow: t('fleet.observed.justNow'),
                minutesAgo: t('fleet.observed.minutesAgo'),
                hoursAgo: t('fleet.observed.hoursAgo'),
                daysAgo: t('fleet.observed.daysAgo'),
              });
              return (
                <time
                  className="tabular-nums text-[11px] text-ink"
                  dateTime={node.lastObservedAt}
                  title={observed.absolute}
                >
                  {observed.relative}
                </time>
              );
            },
          },
        ]}
        defaultPagination={{ page: 1, pageSize: 10 }}
        pageSizeOptions={[10, 20, 50]}
        expandedRowKey={expandedId}
        onExpandedRowChange={setExpandedId}
        renderExpanded={(node) => (
          <NodeExpandPanel
            snapshot={capacityById.get(node.id)}
            locale={locale}
            labels={{
              identity: t('fleet.expand.identity'),
              metrics: t('fleet.expand.metrics'),
              load: t('fleet.expand.load'),
              loadWindow: t('fleet.expand.loadWindow'),
              memory: t('fleet.expand.memory'),
              disk: t('fleet.expand.disk'),
              used: t('fleet.expand.used'),
              available: t('fleet.expand.available'),
              ofTotal: t('fleet.expand.ofTotal'),
              machineModel: t('fleet.col.machineModel'),
              cpuModel: t('fleet.col.cpuModel'),
              gpuModel: t('fleet.col.gpuModel'),
              hostname: t('fleet.col.hostname'),
              address: t('fleet.col.address'),
              unreported: t('fleet.capacity.unreported'),
              noSamples: t('fleet.expand.noSamples'),
              observed: t('fleet.expand.observed'),
              cores: (n) => fill(t('fleet.capacity.cores'), { n }),
              justNow: t('fleet.observed.justNow'),
              minutesAgo: t('fleet.observed.minutesAgo'),
              hoursAgo: t('fleet.observed.hoursAgo'),
              daysAgo: t('fleet.observed.daysAgo'),
            }}
          />
        )}
        rowActions={(node) => (
          <ListRowActions>
            <ListRowAction
              iconOnly
              icon={<IconSettings />}
              aria-label={t('fleet.action.manage')}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedId(node.id);
              }}
            />
          </ListRowActions>
        )}
        empty={
          <ConsoleEmptyState
            variant={q.trim() ? 'no-match' : 'no-data'}
            title={
              loading
                ? t('fleet.loading')
                : error
                  ? t('fleet.loadFailed')
                  : t('fleet.emptyNodes')
            }
            description={t('admin.empty.description')}
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={
              q.trim()
                ? () => setQ('')
                : () => {
                    writePool('all');
                  }
            }
          />
        }
      />

      {sshTarget ? (
        <FleetSshWindow
          key={`${sshTarget.name}@${sshTarget.host}`}
          name={sshTarget.name}
          host={sshTarget.host}
          user={sshAccount}
          accountFailed={sshAccountFailed}
          onClose={() => setSshTarget(null)}
        />
      ) : null}

      <ConsoleDrawer
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        title={selected?.name ?? t('nav.fleet')}
        description={selected?.id}
        footer={
          selected ? (
            <div className="space-y-2">
              {!selectedPoolForNode ? (
                <p className="text-[11px] leading-4 text-ink-muted">
                  {t('fleet.maintenance.notInPool')}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
              {selected.state === 'draining' ? (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => setReadyTarget(selected)}
                >
                  {t('fleet.action.ready')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={busy || selected.state === 'revoked'}
                  onClick={() => setDrainTarget(selected)}
                >
                  {t('fleet.action.drain')}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={busy || !selectedPoolForNode}
                onClick={() => {
                  setStartsAt('');
                  setEndsAt('');
                  setReason('');
                  setMaintainTarget(selected);
                }}
              >
                {t('fleet.action.maintenance')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => setRemoveTarget(selected)}
              >
                {t('fleet.action.remove')}
              </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <NodeDetail
            node={selected}
            host={capacityById.get(selected.id)?.host ?? null}
            snapshot={capacityById.get(selected.id)}
            poolName={selectedPoolForNode?.name ?? null}
            labels={{
              ready: t('fleet.status.ready'),
              draining: t('fleet.status.draining'),
              offline: t('fleet.status.offline'),
              pending: t('fleet.status.pending'),
              revoked: t('fleet.status.revoked'),
              online: t('fleet.availability.online'),
              offlineAvailability: t('fleet.availability.offline'),
              identity: t('fleet.expand.identity'),
              machineModel: t('fleet.col.machineModel'),
              cpuModel: t('fleet.col.cpuModel'),
              gpuModel: t('fleet.col.gpuModel'),
              network: t('fleet.detail.network'),
              hostname: t('fleet.col.hostname'),
              address: t('fleet.col.address'),
              copy: t('fleet.detail.copy'),
              copied: t('fleet.detail.copied'),
              placement: t('fleet.detail.placement'),
              pool: t('fleet.col.pool'),
              none: t('fleet.detail.none'),
              provider: t('fleet.col.provider'),
              version: t('fleet.detail.agentVersion'),
              capacity: t('fleet.expand.capacity'),
              capacityHint: t('fleet.capacity.hint'),
              cpu: t('fleet.capacity.cpu'),
              memory: t('fleet.capacity.memory'),
              disk: t('fleet.capacity.disk'),
              gpu: t('fleet.capacity.gpu'),
              unreported: t('fleet.capacity.unreported'),
              cores: (n) => fill(t('fleet.capacity.cores'), { n }),
              capabilities: t('fleet.detail.capabilities'),
              cap: {
                features: t('fleet.detail.cap.features'),
                units: t('fleet.detail.cap.units'),
                network: t('fleet.detail.cap.network'),
                isolation: t('fleet.detail.cap.isolation'),
                resources: t('fleet.detail.cap.resources'),
                mounts: t('fleet.detail.cap.mounts'),
                health: t('fleet.detail.cap.health'),
                media: t('fleet.detail.cap.media'),
              },
            }}
          />
        ) : null}
      </ConsoleDrawer>

      <ConsoleConfirmDialog
        open={drainTarget != null}
        onOpenChange={(open) => {
          if (!open) setDrainTarget(null);
        }}
        tone="danger"
        title={
          drainTarget
            ? fill(t('fleet.drain.title'), { node: drainTarget.name })
            : t('fleet.action.drain')
        }
        description={t('fleet.drain.body')}
        confirmLabel={t('fleet.action.drain')}
        cancelLabel={t('fleet.action.cancel')}
        loading={busy}
        onConfirm={() => {
          if (!drainTarget) return;
          const target = drainTarget;
          setDrainTarget(null);
          void run(() => drainCloudNode(target.id, target.aggregateVersion));
        }}
      />

      <ConsoleConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        tone="danger"
        title={
          removeTarget
            ? fill(t('fleet.remove.title'), { node: removeTarget.name })
            : t('fleet.action.remove')
        }
        description={t('fleet.remove.body')}
        confirmLabel={t('fleet.action.remove')}
        cancelLabel={t('fleet.action.cancel')}
        loading={busy}
        onConfirm={() => {
          if (!removeTarget) return;
          const target = removeTarget;
          setRemoveTarget(null);
          setSelectedId(null);
          void run(() => removeCloudNode(target.id, target.aggregateVersion));
        }}
      />

      <ConsoleConfirmDialog
        open={readyTarget != null}
        onOpenChange={(open) => {
          if (!open) setReadyTarget(null);
        }}
        tone="default"
        title={
          readyTarget
            ? fill(t('fleet.cancelDrain.title'), { node: readyTarget.name })
            : t('fleet.action.ready')
        }
        description={t('fleet.cancelDrain.body')}
        confirmLabel={t('fleet.action.ready')}
        cancelLabel={t('fleet.action.cancel')}
        loading={busy}
        onConfirm={() => {
          if (!readyTarget) return;
          const target = readyTarget;
          setReadyTarget(null);
          void run(() => readyCloudNode(target.id, target.aggregateVersion));
        }}
      />

      <ConsoleDialog
        open={maintainTarget != null}
        onOpenChange={(open) => {
          if (!open) setMaintainTarget(null);
        }}
        title={t('fleet.maintenance.title')}
        description={selectedPoolForNode?.name}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setMaintainTarget(null)}
            >
              {t('fleet.action.cancel')}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={busy || !reason.trim() || !startsAt || !endsAt}
              onClick={() => {
                if (!maintainTarget || !selectedPoolForNode) return;
                const start = toIso(startsAt);
                const end = toIso(endsAt);
                if (!start || !end) {
                  setError(t('fleet.maintenance.invalidTime'));
                  return;
                }
                const poolId = selectedPoolForNode.id;
                const version = selectedPoolForNode.aggregateVersion;
                const nodeId = maintainTarget.id;
                const note = reason.trim();
                setMaintainTarget(null);
                void run(() =>
                  scheduleCloudMaintenance({
                    nodePoolId: poolId,
                    expectedVersion: version,
                    targetNodeIds: [nodeId],
                    startsAt: start,
                    endsAt: end,
                    reason: note,
                  }),
                );
              }}
            >
              {t('fleet.maintenance.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span>{t('fleet.maintenance.starts')}</span>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span>{t('fleet.maintenance.ends')}</span>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span>{t('fleet.maintenance.reason')}</span>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        </div>
      </ConsoleDialog>

      <ConsoleDialog
        open={enrollOpen}
        onOpenChange={(open) => {
          if (!open) setEnrollOpen(false);
        }}
        title={t('fleet.addNode.title')}
        description={t('fleet.addNode.body')}
        footer={
          issuedScript ? (
            <Button type="button" size="sm" onClick={() => setEnrollOpen(false)}>
              {t('fleet.action.cancel')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEnrollOpen(false)}
              >
                {t('fleet.action.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || !enrollName.trim()}
                onClick={() => {
                  const hours = Number(enrollHours);
                  const expiresAt = new Date(
                    Date.now() + Math.min(hours, 23) * 60 * 60 * 1000,
                  ).toISOString();
                  void run(async () => {
                    const token = generateEnrollmentToken();
                    const issued = await issueCloudEnrollmentToken({
                      name: enrollName.trim(),
                      token,
                      expiresAt,
                    });
                    setIssuedScript(issued.installScript);
                  });
                }}
              >
                {t('fleet.addNode.submit')}
              </Button>
            </div>
          )
        }
      >
        {issuedScript ? (
          <div className="space-y-2 text-sm">
            <p className="text-ink-muted">{t('fleet.addNode.scriptHint')}</p>
            <p className="font-medium">{t('fleet.addNode.script')}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded border border-line bg-canvas p-2 font-mono text-[11px]">
              {issuedScript}
            </pre>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={t('fleet.addNode.copy')}
              onClick={() => {
                void navigator.clipboard.writeText(issuedScript).then(() => setCopied(true));
              }}
            >
              <IconCopy />
              {copied ? t('fleet.addNode.copied') : t('fleet.addNode.copy')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <label className="block space-y-1">
              <span>{t('fleet.addNode.name')}</span>
              <Input
                value={enrollName}
                onChange={(event) => setEnrollName(event.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span>{t('fleet.addNode.lifetime')}</span>
              <SearchSelect
                size="sm"
                searchable={false}
                allowClear={false}
                aria-label={t('fleet.addNode.lifetime')}
                value={enrollHours}
                onChange={(value) => setEnrollHours(value || '12')}
                options={['1', '8', '12', '23'].map((hours) => ({
                  value: hours,
                  label: fill(t('fleet.addNode.hours'), { n: hours }),
                }))}
              />
            </label>
          </div>
        )}
      </ConsoleDialog>
    </AdminPageShell>
  );
}
