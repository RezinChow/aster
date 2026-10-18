/**
 * Ops topology — live hops first, ownership from CONTROL-PLANE-BOUNDARY.
 * Console reaches Cloud directly (/cloud-api) and a3s-api directly (/api).
 * Gateway is only the data plane: Work /v1 → Runtime, and /v2 → the API OCI
 * registry (not the Cloud publication registry).
 * a3s-auth proves humans. a3s-billing is the only invoice authority.
 * The usage node is metering showback, not a second bill. Never invent a healthy hop.
 */

import type { OpsSpineSnapshot, OpsHealth } from '@/data/opsSpine';
import type { OpsDomainCard, OpsDomainsSnapshot } from '@/data/opsDomains';

export type OpsTopoStatus = OpsHealth | 'unwired' | 'fixture';

export type OpsTopoNodeId =
  | 'work'
  | 'console'
  | 'gateway'
  | 'runtime'
  | 'registry'
  | 'api'
  | 'cloud'
  | 'auth'
  | 'billing'
  | 'middleware'
  | 'fleet'
  | 'inference'
  | 'functions'
  | 'cells'
  | 'workflows'
  | 'usage'
  | 'events'
  | 'bus'
  | 'queue';

export type OpsTopoPlane =
  | 'management'
  | 'data'
  | 'runtime'
  | 'extension'
  | 'control'
  | 'product'
  | 'shared';

export type OpsTopoNode = {
  id: OpsTopoNodeId;
  plane: OpsTopoPlane;
  /** Synthetic clients are always present; health mirrors downstream. */
  synthetic?: boolean;
  titleKey: string;
  roleKey?: string;
  status: OpsTopoStatus;
  latencyMs: number | null;
  detail: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
};

export type OpsTopoEdge = {
  id: string;
  from: OpsTopoNodeId;
  to: OpsTopoNodeId;
  label: string;
  /** Edge health = destination status (fail-closed propagation). */
  status: OpsTopoStatus;
};

export type OpsTopology = {
  at: string;
  nodes: OpsTopoNode[];
  edges: OpsTopoEdge[];
};

function spineOf(snap: OpsSpineSnapshot | null, id: OpsSpineSnapshot['services'][number]['id']) {
  return snap?.services.find((s) => s.id === id) ?? null;
}

function domainOf(snap: OpsDomainsSnapshot | null, id: OpsDomainCard['id']) {
  return snap?.domains.find((d) => d.id === id) ?? null;
}

function worst(
  a: OpsTopoStatus,
  b: OpsTopoStatus,
): OpsTopoStatus {
  const rank: Record<OpsTopoStatus, number> = {
    healthy: 0,
    unknown: 1,
    fixture: 2,
    degraded: 3,
    unwired: 4,
    down: 5,
  };
  return rank[a] >= rank[b] ? a : b;
}

function edgeStatus(to: OpsTopoStatus, from: OpsTopoStatus): OpsTopoStatus {
  // Path is only as healthy as the hop it lands on; upstream down also breaks the edge.
  if (from === 'down') return 'down';
  return to;
}

export function buildOpsTopology(
  spine: OpsSpineSnapshot | null,
  domains: OpsDomainsSnapshot | null,
): OpsTopology {
  const gw = spineOf(spine, 'gateway');
  const rt = spineOf(spine, 'runtime');
  const registry = spineOf(spine, 'registry');
  const api = spineOf(spine, 'api');
  const cloud = spineOf(spine, 'cloud');
  const auth = spineOf(spine, 'auth');
  const billing = spineOf(spine, 'billing');
  const fleet = domainOf(domains, 'fleet');
  const inference = domainOf(domains, 'inference');
  const functions = domainOf(domains, 'functions');
  const cells = domainOf(domains, 'cells');
  const usage = domainOf(domains, 'usage');
  const events = domainOf(domains, 'events');
  const bus = domainOf(domains, 'bus');
  const queue = domainOf(domains, 'queue');

  const gwStatus: OpsTopoStatus = gw?.status ?? 'unknown';
  const rtStatus: OpsTopoStatus = rt?.status ?? 'unknown';
  const registryStatus: OpsTopoStatus = registry?.status ?? 'unknown';
  const apiStatus: OpsTopoStatus = api?.status ?? 'unknown';
  const cloudStatus: OpsTopoStatus = cloud?.status ?? 'unknown';
  const authStatus: OpsTopoStatus = auth?.status ?? 'unknown';
  const billingStatus: OpsTopoStatus = billing?.status ?? 'unknown';
  // a3s-api does not answer /health unless the shared compose is up.
  const middlewareStatus: OpsTopoStatus = apiStatus;

  const nodes: OpsTopoNode[] = [
    {
      id: 'work',
      plane: 'data',
      synthetic: true,
      titleKey: 'ops.topo.node.work',
      roleKey: 'ops.topo.node.workRole',
      status: worst(gwStatus, rtStatus),
      latencyMs: null,
      detail: '/v1',
      href: '/admin/marketplace',
      metrics: [],
    },
    {
      id: 'console',
      plane: 'management',
      synthetic: true,
      titleKey: 'ops.topo.node.console',
      roleKey: 'ops.topo.node.consoleRole',
      status: worst(cloudStatus, apiStatus),
      latencyMs: null,
      detail: '/cloud-api · /api',
      href: '/',
      metrics: [],
    },
    {
      id: 'gateway',
      plane: 'data',
      titleKey: 'ops.spine.gateway',
      roleKey: 'ops.spine.gatewayRole',
      status: gwStatus,
      latencyMs: gw?.latencyMs ?? null,
      detail: gw?.detail ?? '—',
      href: gw?.href ?? '/admin/gateway',
      metrics: [],
    },
    {
      id: 'runtime',
      plane: 'runtime',
      titleKey: 'ops.spine.runtime',
      roleKey: 'ops.spine.runtimeRole',
      status: rtStatus,
      latencyMs: rt?.latencyMs ?? null,
      detail: rt?.detail ?? '—',
      href: rt?.href ?? '/admin/topology',
      metrics: spine
        ? [
            {
              label: 'usage rows',
              value: String(spine.usage.length),
            },
          ]
        : [],
    },
    {
      id: 'registry',
      plane: 'data',
      titleKey: 'ops.spine.registry',
      roleKey: 'ops.spine.registryRole',
      status: registryStatus,
      latencyMs: registry?.latencyMs ?? null,
      detail: registry?.detail ?? '—',
      href: registry?.href ?? '/admin/topology',
      metrics: [],
    },
    {
      id: 'api',
      plane: 'extension',
      titleKey: 'ops.spine.api',
      roleKey: 'ops.spine.apiRole',
      status: apiStatus,
      latencyMs: api?.latencyMs ?? null,
      detail: api?.detail ?? '—',
      href: api?.href ?? '/admin/settings/system',
      metrics: [],
    },
    {
      id: 'cloud',
      plane: 'control',
      titleKey: 'ops.spine.cloud',
      roleKey: 'ops.spine.cloudRole',
      status: cloudStatus,
      latencyMs: cloud?.latencyMs ?? null,
      detail: cloud?.detail ?? '—',
      href: cloud?.href ?? '/docs?source=cloud',
      metrics: [],
    },
    {
      id: 'auth',
      plane: 'extension',
      titleKey: 'ops.spine.auth',
      roleKey: 'ops.spine.authRole',
      status: authStatus,
      latencyMs: auth?.latencyMs ?? null,
      detail: auth?.detail ?? '—',
      href: auth?.href ?? '/admin/settings/system',
      metrics: [],
    },
    {
      id: 'billing',
      plane: 'product',
      titleKey: 'ops.spine.billing',
      roleKey: 'ops.spine.billingRole',
      status: billingStatus,
      latencyMs: billing?.latencyMs ?? null,
      detail: billing?.detail ?? '—',
      href: billing?.href ?? '/admin/usage',
      metrics: [],
    },
    {
      id: 'middleware',
      plane: 'shared',
      titleKey: 'ops.topo.node.middleware',
      roleKey: 'ops.topo.node.middlewareRole',
      status: middlewareStatus,
      latencyMs: null,
      detail: 'a3s-postgres · a3s-redis · a3s-nats',
      href: '/admin/topology',
      metrics: [],
    },
  ];

  const domainNodes: Array<[OpsTopoNodeId, OpsDomainCard | null, OpsTopoPlane]> = [
    ['fleet', fleet, 'runtime'],
    ['inference', inference, 'product'],
    ['functions', functions, 'product'],
    ['cells', cells, 'product'],
    // /workflows is still Console fixture — omit until a live hop exists.
    ['usage', usage, 'product'],
    ['events', events, 'product'],
    ['bus', bus, 'control'],
    ['queue', queue, 'control'],
  ];

  for (const [id, card, plane] of domainNodes) {
    nodes.push({
      id,
      plane,
      titleKey: card?.titleKey ?? `ops.domain.${id}`,
      roleKey:
        id === 'functions' ? 'ops.domain.functionsHint' : undefined,
      status: card?.status ?? 'unknown',
      latencyMs: null,
      detail: card?.detail ?? '—',
      href: card?.href ?? `/${id}`,
      metrics: card?.metrics ?? [],
    });
  }

  const edges: OpsTopoEdge[] = [
    {
      id: 'work-gateway',
      from: 'work',
      to: 'gateway',
      label: '/v1',
      status: edgeStatus(gwStatus, 'healthy'),
    },
    {
      id: 'console-cloud',
      from: 'console',
      to: 'cloud',
      label: '/cloud-api',
      status: edgeStatus(cloudStatus, 'healthy'),
    },
    {
      id: 'console-api',
      from: 'console',
      to: 'api',
      label: '/v1/api',
      status: edgeStatus(apiStatus, 'healthy'),
    },
    {
      id: 'gateway-registry',
      from: 'gateway',
      to: 'registry',
      label: '/v2',
      status: edgeStatus(registryStatus, gwStatus),
    },
    {
      id: 'gateway-runtime',
      from: 'gateway',
      to: 'runtime',
      label: '/v1/api',
      status: edgeStatus(rtStatus, gwStatus),
    },
    {
      id: 'cloud-gateway',
      from: 'cloud',
      to: 'gateway',
      label: 'snapshot',
      status: edgeStatus(gwStatus, cloudStatus),
    },
    {
      id: 'cloud-fleet',
      from: 'cloud',
      to: 'fleet',
      label: 'claims',
      status: edgeStatus(fleet?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'fleet-runtime',
      from: 'fleet',
      to: 'runtime',
      label: 'converge',
      status: edgeStatus(rtStatus, fleet?.status ?? 'unknown'),
    },
    {
      id: 'cloud-inference',
      from: 'cloud',
      to: 'inference',
      label: 'profile',
      status: edgeStatus(inference?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'cloud-functions',
      from: 'cloud',
      to: 'functions',
      label: 'profile',
      status: edgeStatus(functions?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'cloud-cells',
      from: 'cloud',
      to: 'cells',
      label: 'profile',
      status: edgeStatus(cells?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'gateway-usage',
      from: 'gateway',
      to: 'usage',
      label: 'meter',
      status: edgeStatus(usage?.status ?? 'unknown', gwStatus),
    },
    {
      id: 'cloud-usage',
      from: 'cloud',
      to: 'usage',
      label: 'showback',
      status: edgeStatus(usage?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'api-auth',
      from: 'api',
      to: 'auth',
      label: 'proof',
      status: edgeStatus(authStatus, apiStatus),
    },
    {
      id: 'cloud-auth',
      from: 'cloud',
      to: 'auth',
      label: 'OIDC',
      status: edgeStatus(authStatus, cloudStatus),
    },
    {
      id: 'api-billing',
      from: 'api',
      to: 'billing',
      label: 'export',
      status: edgeStatus(billingStatus, apiStatus),
    },
    {
      id: 'api-middleware',
      from: 'api',
      to: 'middleware',
      label: 'shared',
      status: edgeStatus(middlewareStatus, apiStatus),
    },
    {
      id: 'cloud-middleware',
      from: 'cloud',
      to: 'middleware',
      label: 'shared',
      status: edgeStatus(middlewareStatus, cloudStatus),
    },
    {
      id: 'auth-middleware',
      from: 'auth',
      to: 'middleware',
      label: 'shared',
      status: edgeStatus(middlewareStatus, authStatus),
    },
    {
      id: 'billing-middleware',
      from: 'billing',
      to: 'middleware',
      label: 'shared',
      status: edgeStatus(middlewareStatus, billingStatus),
    },
    // Data plane access logs (request_id) — same Events sink as api process logs.
    {
      id: 'runtime-events',
      from: 'runtime',
      to: 'events',
      label: 'access log',
      status: edgeStatus(events?.status ?? 'unknown', rtStatus),
    },
    // a3s-api process logs (ClickHouse) — extension plane, not Cloud.
    {
      id: 'api-events',
      from: 'api',
      to: 'events',
      label: '/logs',
      status: edgeStatus(events?.status ?? 'unknown', apiStatus),
    },
    // Global event bus (NATS JetStream) — Cloud-owned; Runtime publishes L1.
    {
      id: 'cloud-bus',
      from: 'cloud',
      to: 'bus',
      label: 'JetStream',
      status: edgeStatus(bus?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'runtime-bus',
      from: 'runtime',
      to: 'bus',
      label: 'L1 publish',
      status: edgeStatus(bus?.status ?? 'unknown', rtStatus),
    },
    // Product message queues on the same NATS cluster.
    {
      id: 'cloud-queue',
      from: 'cloud',
      to: 'queue',
      label: 'owns',
      status: edgeStatus(queue?.status ?? 'unknown', cloudStatus),
    },
    {
      id: 'runtime-queue',
      from: 'runtime',
      to: 'queue',
      label: 'vault / ingest',
      status: edgeStatus(queue?.status ?? 'unknown', rtStatus),
    },
    // Workflows Console page is still fixture — no live Cloud hop.
    // api → bus intentionally omitted (local config NATS ≠ global bus).
  ];

  return {
    at: spine?.at ?? domains?.at ?? new Date().toISOString(),
    nodes,
    edges,
  };
}

export function getTopoNode(
  topo: OpsTopology,
  id: OpsTopoNodeId,
): OpsTopoNode | undefined {
  return topo.nodes.find((n) => n.id === id);
}
