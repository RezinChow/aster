/**
 * L1 Usage ledger — prefers Runtime bus projection, then Gateway /v1/api/usage,
 * then local Console attributions. Gateway pull is a fallback, not the bus.
 */

import {
  gatewayAbsoluteUrl,
  LOCAL_GATEWAY_DEV_KEY,
  probeGatewayHealth,
} from '@/lib/workConnect';
import { isApiEnvelope } from '@/lib/apiEnvelope';
import { gatewayRelativePathForSku } from '@/data/servicePath';
import type { ListingKind } from '@/data/marketplace';

export type UsageKind = 'model' | 'tool' | 'api' | 'feed';

export type UsageRecord = {
  id: string;
  at: string;
  orgId: string;
  projectId: string;
  envId: string;
  credentialPrefix: string;
  sku: string;
  listingKind: UsageKind;
  units: number;
  unitPriceUsd: number;
  amountUsd: number;
  route: string;
  requestId: string;
  status: 'ok' | 'denied' | 'error';
  detail?: string;
  durationMs?: number;
  fromGateway?: boolean;
  fromBus?: boolean;
};

const ledger: UsageRecord[] = [];
let gatewayCache: UsageRecord[] = [];
let busCache: UsageRecord[] = [];
let gatewayFetchedAt = 0;
let busFetchedAt = 0;

const RUNTIME_ORIGIN = (
  import.meta.env.PUBLIC_A3S_RUNTIME_ORIGIN ?? 'http://127.0.0.1:8787'
).replace(/\/$/, '');

export function listUsageRecords(limit = 50): UsageRecord[] {
  const merged = [...busCache, ...gatewayCache, ...ledger];
  const seen = new Set<string>();
  const out: UsageRecord[] = [];
  for (const row of merged.sort((a, b) => b.at.localeCompare(a.at))) {
    const key = row.requestId || row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function recordUsage(
  input: Omit<UsageRecord, 'id' | 'at' | 'amountUsd'> & { amountUsd?: number },
): UsageRecord {
  const amountUsd =
    input.amountUsd ??
    Number((input.units * input.unitPriceUsd).toFixed(6));
  const row: UsageRecord = {
    ...input,
    id: `usage_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    amountUsd,
  };
  ledger.unshift(row);
  return row;
}

export function usageTotals(): {
  calls: number;
  amountUsd: number;
  bySku: Record<string, number>;
} {
  const rows = listUsageRecords(500);
  const bySku: Record<string, number> = {};
  let amountUsd = 0;
  for (const row of rows) {
    if (row.status !== 'ok') continue;
    amountUsd += row.amountUsd;
    bySku[row.sku] = (bySku[row.sku] ?? 0) + row.units;
  }
  return {
    calls: rows.filter((r) => r.status === 'ok').length,
    amountUsd: Number(amountUsd.toFixed(6)),
    bySku,
  };
}

type GatewayUsageRow = {
  id: string;
  at: string;
  request_id: string;
  sku: string;
  listing_kind: string;
  credential_prefix: string;
  units: number;
  unit_price_usd?: number;
  amount_usd?: number;
  status: string;
  detail?: string;
  route?: string;
  org_id?: string;
  project_id?: string;
  env_id?: string;
  duration_ms?: number;
};

type BusEnvelope = {
  id: string;
  event_key: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

function mapGatewayUsageRow(row: GatewayUsageRow): UsageRecord {
  const status: UsageRecord['status'] =
    row.status === 'ok' ? 'ok' : row.status === 'denied' ? 'denied' : 'error';
  const kind = (['model', 'tool', 'api', 'feed'] as const).includes(
    row.listing_kind as UsageKind,
  )
    ? (row.listing_kind as UsageKind)
    : 'api';
  const unitPriceUsd = Number(row.unit_price_usd ?? 0);
  const units = Number(row.units ?? 0);
  const amountUsd =
    row.amount_usd !== undefined
      ? Number(row.amount_usd)
      : Number((units * unitPriceUsd).toFixed(6));
  return {
    id: row.id,
    at: row.at,
    orgId: row.org_id?.trim() || 'org_demo',
    projectId: row.project_id?.trim() || 'proj_demo',
    envId: row.env_id?.trim() || 'env_demo',
    credentialPrefix: row.credential_prefix,
    sku: row.sku,
    listingKind: kind,
    units,
    unitPriceUsd,
    amountUsd,
    route:
      row.route?.trim() ||
      `/v1${gatewayRelativePathForSku(row.sku, kind as ListingKind)}`,
    requestId: row.request_id,
    status,
    detail: row.detail,
    ...(typeof row.duration_ms === 'number' && Number.isFinite(row.duration_ms)
      ? { durationMs: Math.max(0, Math.round(row.duration_ms)) }
      : {}),
    fromGateway: true,
  };
}

export function mapBusEnvelope(env: BusEnvelope): UsageRecord | null {
  if (
    env.event_key !== 'usage.recorded' &&
    env.event_key !== 'invoke.completed' &&
    env.event_key !== 'invoke.failed'
  ) {
    return null;
  }
  const p = env.payload;
  const statusRaw = String(p.status ?? 'ok');
  const status: UsageRecord['status'] =
    statusRaw === 'ok' ? 'ok' : statusRaw === 'denied' ? 'denied' : 'error';
  const kindRaw = String(p.listing_kind ?? 'api');
  const kind = (['model', 'tool', 'api', 'feed'] as const).includes(
    kindRaw as UsageKind,
  )
    ? (kindRaw as UsageKind)
    : 'api';
  return {
    id: String(p.usage_id ?? env.id),
    at: env.occurred_at,
    orgId: String(p.org_id ?? 'org_local'),
    projectId: String(p.project_id ?? 'proj_local'),
    envId: String(p.env_id ?? 'env_local'),
    credentialPrefix: 'bus',
    sku: String(p.sku ?? ''),
    listingKind: kind,
    units: Number(p.units ?? 0),
    unitPriceUsd: 0,
    amountUsd: Number(p.amount_usd ?? 0),
    route: String(p.route ?? ''),
    requestId: String(p.request_id ?? env.id),
    status,
    fromBus: true,
    ...(typeof p.duration_ms === 'number'
      ? { durationMs: Math.max(0, Math.round(p.duration_ms as number)) }
      : {}),
  };
}

/** Prefer Runtime bus projection — no Gateway ACL required. */
export async function refreshUsageFromBus(): Promise<number> {
  const now = Date.now();
  if (now - busFetchedAt < 2000 && busCache.length > 0) {
    return busCache.length;
  }
  try {
    const res = await fetch(`${RUNTIME_ORIGIN}/v1/api/events/recent`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    const payload = (await res.json()) as unknown;
    if (!res.ok || !isApiEnvelope(payload) || payload.code !== 0) {
      return busCache.length;
    }
    const data = payload.data as { items?: BusEnvelope[] } | null;
    const items = Array.isArray(data?.items) ? data.items : [];
    busCache = items
      .map(mapBusEnvelope)
      .filter((row): row is UsageRecord => row !== null);
    busFetchedAt = now;
    return busCache.length;
  } catch {
    return busCache.length;
  }
}

export async function refreshUsageFromGateway(
  capabilityKey = LOCAL_GATEWAY_DEV_KEY,
): Promise<number> {
  await refreshUsageFromBus();
  const now = Date.now();
  if (now - gatewayFetchedAt < 2000 && gatewayCache.length > 0) {
    return Math.max(gatewayCache.length, busCache.length);
  }
  const up = await probeGatewayHealth();
  if (!up) {
    gatewayCache = [];
    gatewayFetchedAt = now;
    return busCache.length;
  }
  try {
    const res = await fetch(gatewayAbsoluteUrl('/api/usage'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${capabilityKey}`,
      },
      signal: AbortSignal.timeout(4000),
    });
    const payload = (await res.json()) as unknown;
    if (!res.ok || !isApiEnvelope(payload) || payload.code !== 0) {
      return Math.max(gatewayCache.length, busCache.length);
    }
    const data = payload.data as
      | { items?: GatewayUsageRow[]; data?: GatewayUsageRow[] }
      | GatewayUsageRow[]
      | null;
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : [];
    gatewayCache = rows.map(mapGatewayUsageRow);
    gatewayFetchedAt = now;
    return Math.max(gatewayCache.length, busCache.length);
  } catch {
    return Math.max(gatewayCache.length, busCache.length);
  }
}
