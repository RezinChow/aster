/**
 * Live spine probes for Ops (/ops). Never invent healthy — fail closed.
 */

import { listLocalGatewayServices } from '@/lib/gatewayApi';
import { consoleApiProxyBase } from '@/lib/workConnect';
import {
  gatewayAbsoluteUrl,
  gatewayOrigin,
  LOCAL_GATEWAY_DEV_KEY,
  probeGatewayHealth,
} from '@/lib/workConnect';
import {
  listUsageRecords,
  refreshUsageFromGateway,
  type UsageRecord,
} from '@/data/usageLedger';
import {
  probeDesiredInternalServices,
  summarizeDesiredCatalog,
} from '@/data/desiredCatalog';

export type OpsHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

export type OpsSpineServiceId =
  | 'gateway'
  | 'runtime'
  | 'api'
  | 'cloud'
  | 'auth'
  | 'billing'
  | 'registry';

export type OpsSpineCard = {
  id: OpsSpineServiceId;
  status: OpsHealth;
  latencyMs: number | null;
  detail: string;
  href: string;
};

export type OpsSpineSnapshot = {
  at: string;
  services: OpsSpineCard[];
  usage: UsageRecord[];
};

const RUNTIME_LISTEN = 'http://127.0.0.1:8787';
const AUTH_ORIGIN = 'http://127.0.0.1:7641';
const BILLING_ORIGIN = 'http://127.0.0.1:7651';
const REGISTRY_ORIGIN = 'http://127.0.0.1:50030';
const CLOUD_ORIGIN = (
  import.meta.env.PUBLIC_A3S_CLOUD_API_ORIGIN ?? 'http://127.0.0.1:18080'
).replace(/\/$/, '');

async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; ms: number; body?: unknown }> {
  const started = performance.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(2500),
    });
    const ms = Math.round(performance.now() - started);
    let body: unknown;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text.slice(0, 200);
      }
    }
    return { ok: res.ok, status: res.status, ms, body };
  } catch {
    return { ok: false, status: 0, ms: Math.round(performance.now() - started) };
  }
}

async function probeGateway(): Promise<OpsSpineCard> {
  const up = await probeGatewayHealth(gatewayOrigin());
  if (!up) {
    return {
      id: 'gateway',
      status: 'down',
      latencyMs: null,
        detail: `${gatewayOrigin()} unreachable`,
      href: '/admin/gateway',
    };
  }
  try {
    const catalog = await listLocalGatewayServices();
    const routes = catalog.platform;
    const n = new Set(routes.map((route) => route.target)).size;
    const routers = routes.length;
    const down = routes.filter((route) => route.health && route.health.healthy === 0).length;
    const offline = catalog.live != null && !catalog.live.reachable;
    return {
      id: 'gateway',
      status: n > 0 && !offline && down === 0 ? 'healthy' : 'degraded',
      latencyMs: null,
      detail: offline
        ? `node API ${catalog.live?.error ?? 'unreachable'}`
        : `${n} services${down ? ` (${down} down)` : ''} · ${routers} routers · ${catalog.mode || 'standalone'}`,
      href: '/admin/gateway',
    };
  } catch (err) {
    return {
      id: 'gateway',
      status: 'degraded',
      latencyMs: null,
      detail: err instanceof Error ? err.message : 'Catalog unavailable',
      href: '/admin/gateway',
    };
  }
}

async function probeRuntime(): Promise<OpsSpineCard> {
  const direct = await timedFetch(`${RUNTIME_LISTEN}/health`);
  if (!direct.ok) {
    // Fallback via Gateway /v1/api/health
    const viaGw = await timedFetch(gatewayAbsoluteUrl('/api/health'));
    if (!viaGw.ok) {
      return {
        id: 'runtime',
        status: 'down',
        latencyMs: direct.ms,
        detail: ':8787 unreachable',
        href: '/admin/topology',
      };
    }
    return {
      id: 'runtime',
      status: 'degraded',
      latencyMs: viaGw.ms,
      detail: 'Via Gateway only',
      href: '/admin/topology',
    };
  }
  const data =
    direct.body &&
    typeof direct.body === 'object' &&
    'data' in direct.body
      ? (direct.body as { data?: { service?: string; boyue_vault?: boolean } })
          .data
      : undefined;
  const vault = data?.boyue_vault === true ? 'vault on' : 'vault off';
  return {
    id: 'runtime',
    status: 'healthy',
    latencyMs: direct.ms,
    detail: `${data?.service ?? 'a3s-runtime'} · ${vault}`,
    href: '/admin/topology',
  };
}

async function probeRegistry(): Promise<OpsSpineCard> {
  const res = await timedFetch(`${REGISTRY_ORIGIN}/v2/`);
  // No HTTP status means the browser could not read the registry (CORS or
  // refused). Do not paint that as down.
  if (res.status === 0) {
    return {
      id: 'registry',
      status: 'unknown',
      latencyMs: null,
      detail: ':50030 /v2',
      href: '/admin/topology',
    };
  }
  if (!res.ok && res.status !== 401) {
    return {
      id: 'registry',
      status: 'down',
      latencyMs: res.ms,
      detail: `:50030 /v2 HTTP ${res.status}`,
      href: '/admin/topology',
    };
  }
  return {
    id: 'registry',
    status: 'healthy',
    latencyMs: res.ms,
    detail: ':50030 /v2',
    href: '/admin/topology',
  };
}

async function probeApi(): Promise<OpsSpineCard> {
  const base = consoleApiProxyBase();
  const res = await timedFetch(`${base}/health`);
  if (!res.ok) {
    return {
      id: 'api',
      status: 'down',
      latencyMs: res.ms,
      detail: `${base}/health ${res.status || 'fail'}`,
      href: '/admin/settings/system',
    };
  }
  return {
    id: 'api',
    status: 'healthy',
    latencyMs: res.ms,
    detail: `${base}/health ok`,
    href: '/admin/settings/system',
  };
}

async function probeCloud(): Promise<OpsSpineCard> {
  let health: OpsSpineCard | null = null;
  for (const path of ['/health', '/health/ready', '/v1/health', '/']) {
    const res = await timedFetch(`${CLOUD_ORIGIN}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok || res.status === 401 || res.status === 403) {
      health = {
        id: 'cloud',
        status: res.ok ? 'healthy' : 'degraded',
        latencyMs: res.ms,
        detail: `HTTP ${res.status}`,
        href: '/docs?source=cloud',
      };
      break;
    }
  }
  if (!health) {
    return {
      id: 'cloud',
      status: 'down',
      latencyMs: null,
      detail: 'unreachable',
      href: '/docs?source=cloud',
    };
  }

  // Wave G2: read Cloud desired catalog — never invent healthy entries.
  const catalog = await probeDesiredInternalServices();
  if (catalog.status === 'ok') {
    return {
      ...health,
      detail: `${health.detail} · ${summarizeDesiredCatalog(catalog.services)}`,
      latencyMs: catalog.ms ?? health.latencyMs,
    };
  }
  if (catalog.status === 'unwired') {
    return {
      ...health,
      status: health.status === 'healthy' ? 'degraded' : health.status,
      detail: `${health.detail} · catalog unwired (${catalog.reason})`,
    };
  }
  return {
    ...health,
    status: health.status === 'down' ? 'down' : 'degraded',
    detail: `${health.detail} · catalog ${catalog.reason}`,
  };
}

async function probeProcess(
  id: 'auth' | 'billing',
  origin: string,
  href: string,
): Promise<OpsSpineCard> {
  const res = await timedFetch(`${origin}/health`);
  if (!res.ok) {
    return {
      id,
      status: 'down',
      latencyMs: res.ms,
      detail: `${origin} unreachable`,
      href,
    };
  }
  return {
    id,
    status: 'healthy',
    latencyMs: res.ms,
    detail: `${origin} ok`,
    href,
  };
}

export async function loadOpsSpineSnapshot(): Promise<OpsSpineSnapshot> {
  const [gateway, runtime, api, cloud, auth, billing, registry] =
    await Promise.all([
      probeGateway(),
      probeRuntime(),
      probeApi(),
      probeCloud(),
      probeProcess('auth', AUTH_ORIGIN, '/admin/settings/system'),
      probeProcess('billing', BILLING_ORIGIN, '/admin/usage'),
      probeRegistry(),
    ]);

  try {
    await refreshUsageFromGateway(LOCAL_GATEWAY_DEV_KEY);
  } catch {
    /* keep prior cache */
  }

  return {
    at: new Date().toISOString(),
    services: [gateway, runtime, api, cloud, auth, billing, registry],
    usage: listUsageRecords(25).filter((r) => r.fromGateway || r.route.includes('/v1')),
  };
}

/** Smoke helper for envelope shape on /v1/api/usage. */
export async function fetchRuntimeUsageRaw(
  limit = 20,
): Promise<UsageRecord[]> {
  const up = await probeGatewayHealth();
  if (!up) return [];
  try {
    await refreshUsageFromGateway(LOCAL_GATEWAY_DEV_KEY);
    return listUsageRecords(limit);
  } catch {
    return [];
  }
}
