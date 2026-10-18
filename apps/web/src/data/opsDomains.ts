/**
 * Product-domain load cards for Ops (/ops).
 * Live where APIs exist; otherwise fail-closed / fixture — never fake healthy.
 */

import { listCloudNodes } from '@/lib/fleetApi';
import {
  listInferenceDeployments,
  listInferenceRoutes,
} from '@/lib/inferenceApi';
import { listCloudFunctions } from '@/lib/functionsApi';
import { listCloudDurableCells } from '@/lib/cloudApi';
import { listTokenUsage } from '@/lib/usageApi';
import { searchLogs } from '@/lib/logsApi';
import { flows } from '@/data/mock';
import type { OpsHealth } from '@/data/opsSpine';

export type OpsDomainId =
  | 'fleet'
  | 'inference'
  | 'functions'
  | 'cells'
  | 'workflows'
  | 'usage'
  | 'events'
  | 'bus'
  | 'queue';

export type OpsDomainCard = {
  id: OpsDomainId;
  status: OpsHealth | 'unwired' | 'fixture';
  titleKey: string;
  href: string;
  detail: string;
  metrics: Array<{ label: string; value: string }>;
};

export type OpsDomainsSnapshot = {
  at: string;
  domains: OpsDomainCard[];
};

export type OpsDomainScope = {
  projectId: string;
  envId: string;
};

async function loadFleet(): Promise<OpsDomainCard> {
  try {
    const nodes = await listCloudNodes();
    const list = Array.isArray(nodes) ? nodes : [];
    const ready = list.filter((n) => {
      const s = String(n.state ?? '').toLowerCase();
      const a = String(n.availability ?? '').toLowerCase();
      return s.includes('ready') || a.includes('ready') || a === 'available';
    }).length;
    return {
      id: 'fleet',
      status: list.length === 0 ? 'degraded' : ready > 0 ? 'healthy' : 'degraded',
      titleKey: 'ops.domain.fleet',
      href: '/admin/fleet',
      detail: `${ready}/${list.length} ready`,
      metrics: [
        { label: 'nodes', value: String(list.length) },
        { label: 'ready', value: String(ready) },
      ],
    };
  } catch (err) {
    return {
      id: 'fleet',
      status: 'unwired',
      titleKey: 'ops.domain.fleet',
      href: '/admin/fleet',
      detail: err instanceof Error ? err.message : 'Fleet API unavailable',
      metrics: [],
    };
  }
}

async function loadInference(scope: OpsDomainScope | null): Promise<OpsDomainCard> {
  if (!scope?.projectId || !scope?.envId) {
    return {
      id: 'inference',
      status: 'unwired',
      titleKey: 'ops.domain.inference',
      href: '/admin/assets/models',
      detail: 'Select a project and env',
      metrics: [],
    };
  }
  try {
    const [deps, routes] = await Promise.all([
      listInferenceDeployments(scope.projectId, scope.envId),
      listInferenceRoutes(scope.projectId, scope.envId),
    ]);
    const depList = Array.isArray(deps) ? deps : [];
    const routeItems = routes?.items ?? [];
    const ready = depList.reduce((s, d) => s + (d.readyReplicas ?? 0), 0);
    const wanted = depList.reduce((s, d) => s + (d.replicas ?? 0), 0);
    return {
      id: 'inference',
      status:
        depList.length === 0 && routeItems.length === 0
          ? 'degraded'
          : 'healthy',
      titleKey: 'ops.domain.inference',
      href: '/admin/assets/models',
      detail: `${depList.length} deployments · ${routeItems.length} routes`,
      metrics: [
        { label: 'deployments', value: String(depList.length) },
        { label: 'ready/replicas', value: `${ready}/${wanted}` },
        { label: 'routes', value: String(routeItems.length) },
      ],
    };
  } catch (err) {
    return {
      id: 'inference',
      status: 'unwired',
      titleKey: 'ops.domain.inference',
      href: '/admin/assets/models',
      detail: err instanceof Error ? err.message : 'Inference API unavailable',
      metrics: [],
    };
  }
}

async function loadFunctions(): Promise<OpsDomainCard> {
  try {
    const assets = await listCloudFunctions();
    const list = Array.isArray(assets) ? assets : [];
    const active = list.filter((a) => a.state === 'active' || a.state === 'published').length;
    return {
      id: 'functions',
      status: list.length === 0 ? 'degraded' : 'healthy',
      titleKey: 'ops.domain.functions',
      href: '/admin/functions',
      detail: `${list.length} assets`,
      metrics: [
        { label: 'assets', value: String(list.length) },
        { label: 'active', value: String(active) },
      ],
    };
  } catch (err) {
    return {
      id: 'functions',
      status: 'unwired',
      titleKey: 'ops.domain.functions',
      href: '/admin/functions',
      detail: err instanceof Error ? err.message : 'Cloud Functions API unavailable',
      metrics: [],
    };
  }
}

async function loadCells(scope: OpsDomainScope | null): Promise<OpsDomainCard> {
  if (!scope?.projectId || !scope?.envId) {
    return {
      id: 'cells',
      status: 'unwired',
      titleKey: 'ops.domain.cells',
      href: '/admin/cells',
      detail: 'Select a project and env',
      metrics: [],
    };
  }
  try {
    const list = await listCloudDurableCells(scope.projectId, scope.envId);
    const running = list.filter((c) =>
      String(c.desiredState).toLowerCase().includes('run'),
    ).length;
    return {
      id: 'cells',
      status: list.length === 0 ? 'degraded' : 'healthy',
      titleKey: 'ops.domain.cells',
      href: '/admin/cells',
      detail: `${list.length} cells`,
      metrics: [
        { label: 'cells', value: String(list.length) },
        { label: 'running*', value: String(running) },
      ],
    };
  } catch (err) {
    return {
      id: 'cells',
      status: 'unwired',
      titleKey: 'ops.domain.cells',
      href: '/admin/cells',
      detail: err instanceof Error ? err.message : 'Durable cells API unavailable',
      metrics: [],
    };
  }
}

function loadWorkflows(): OpsDomainCard {
  const list = flows;
    const running = list.filter((f) => f.status === 'running').length;
  return {
    id: 'workflows',
    status: 'fixture',
    titleKey: 'ops.domain.workflows',
    href: '/admin/workflows',
    detail: `${list.length} flows`,
    metrics: [
      { label: 'flows', value: String(list.length) },
      { label: 'running*', value: String(running) },
    ],
  };
}

async function loadUsage(scope: OpsDomainScope | null): Promise<OpsDomainCard> {
  if (!scope?.projectId || !scope?.envId) {
    return {
      id: 'usage',
      status: 'unwired',
      titleKey: 'ops.domain.usage',
      href: '/admin/usage',
      detail: 'Select a project and env',
      metrics: [],
    };
  }
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const page = await listTokenUsage({
      projectId: scope.projectId,
      environmentId: scope.envId,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const tokens = page.rollups.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    return {
      id: 'usage',
      status: 'healthy',
      titleKey: 'ops.domain.usage',
      href: '/admin/usage',
      detail: `${page.rollups.length} rows · 30d`,
      metrics: [
        { label: 'rows', value: String(page.rollups.length) },
        { label: 'tokens', value: String(tokens) },
      ],
    };
  } catch (err) {
    return {
      id: 'usage',
      status: 'unwired',
      titleKey: 'ops.domain.usage',
      href: '/admin/usage',
      detail: err instanceof Error ? err.message : 'Usage API unavailable',
      metrics: [],
    };
  }
}

async function loadEvents(): Promise<OpsDomainCard> {
  try {
    const to = Date.now();
    const from = to - 60 * 60 * 1000;
    const page = await searchLogs({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      limit: 1,
    });
    const total = page.counts?.all ?? 0;
    return {
      id: 'events',
      status: 'healthy',
      titleKey: 'ops.domain.events',
      href: '/admin/logs',
      detail: `${total} in last hour`,
      metrics: [
        { label: 'errors', value: String(page.counts?.error ?? 0) },
        { label: 'warns', value: String(page.counts?.warn ?? 0) },
      ],
    };
  } catch (err) {
    return {
      id: 'events',
      status: 'unwired',
      titleKey: 'ops.domain.events',
      href: '/admin/logs',
      detail: err instanceof Error ? err.message : 'Logs API unavailable',
      metrics: [],
    };
  }
}

const NATS_MONITOR = (
  import.meta.env.PUBLIC_A3S_CLOUD_NATS_MONITOR ?? 'http://127.0.0.1:8220'
).replace(/\/$/, '');

const CLOUD_API = (
  import.meta.env.PUBLIC_A3S_CLOUD_API_ORIGIN ?? 'http://127.0.0.1:18080'
).replace(/\/$/, '');

/** Global event bus — Cloud NATS JetStream (monitor :8220). */
async function loadBus(): Promise<OpsDomainCard> {
  try {
    const started = performance.now();
    const res = await fetch(`${NATS_MONITOR}/healthz`, {
      signal: AbortSignal.timeout(2000),
    });
    const ms = Math.round(performance.now() - started);
    if (!res.ok) {
      return {
        id: 'bus',
        status: 'down',
        titleKey: 'ops.domain.bus',
        href: '/admin/bus',
        detail: `monitor HTTP ${res.status}`,
        metrics: [{ label: 'latency', value: `${ms}ms` }],
      };
    }
    const text = (await res.text()).trim().toLowerCase();
    const ok = text.includes('ok');
    return {
      id: 'bus',
      status: ok ? 'healthy' : 'degraded',
      titleKey: 'ops.domain.bus',
      href: '/admin/bus',
      detail: ok ? `JetStream · ${NATS_MONITOR}` : text.slice(0, 80),
      metrics: [
        { label: 'monitor', value: ':8220' },
        { label: 'latency', value: `${ms}ms` },
      ],
    };
  } catch (err) {
    return {
      id: 'bus',
      status: 'unwired',
      titleKey: 'ops.domain.bus',
      href: '/admin/bus',
      detail: err instanceof Error ? err.message : 'NATS monitor unreachable',
      metrics: [],
    };
  }
}

/** Product message queues — Cloud API when ready, else unwired. */
async function loadQueue(): Promise<OpsDomainCard> {
  try {
    const res = await fetch(`${CLOUD_API}/api/v1/queues`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        id: 'queue',
        status: 'degraded',
        titleKey: 'ops.domain.queue',
        href: '/admin/queues',
        detail: `Cloud HTTP ${res.status}`,
        metrics: [],
      };
    }
    if (!res.ok) {
      return {
        id: 'queue',
        status: res.status === 404 ? 'unwired' : 'down',
        titleKey: 'ops.domain.queue',
        href: '/admin/queues',
        detail: `Cloud HTTP ${res.status}`,
        metrics: [],
      };
    }
    const body = (await res.json()) as {
      data?: { queues?: unknown[]; items?: unknown[] };
      queues?: unknown[];
      items?: unknown[];
    };
    const list =
      body.data?.queues ??
      body.data?.items ??
      body.queues ??
      body.items ??
      [];
    const n = Array.isArray(list) ? list.length : 0;
    return {
      id: 'queue',
      status: 'healthy',
      titleKey: 'ops.domain.queue',
      href: '/admin/queues',
      detail: `${n} queues`,
      metrics: [{ label: 'queues', value: String(n) }],
    };
  } catch (err) {
    return {
      id: 'queue',
      status: 'unwired',
      titleKey: 'ops.domain.queue',
      href: '/admin/queues',
      detail: err instanceof Error ? err.message : 'Queue API unavailable',
      metrics: [],
    };
  }
}

export async function loadOpsDomainsSnapshot(
  scope: OpsDomainScope | null,
): Promise<OpsDomainsSnapshot> {
  const [fleet, inference, functions, cells, usage, events, bus, queue] =
    await Promise.all([
      loadFleet(),
      loadInference(scope),
      loadFunctions(),
      loadCells(scope),
      loadUsage(scope),
      loadEvents(),
      loadBus(),
      loadQueue(),
    ]);
  return {
    at: new Date().toISOString(),
    domains: [
      fleet,
      inference,
      functions,
      cells,
      loadWorkflows(),
      usage,
      events,
      bus,
      queue,
    ],
  };
}
