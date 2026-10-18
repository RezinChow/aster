import { describe, expect, test } from 'bun:test';
import { buildOpsTopology } from './opsTopology';
import type { OpsSpineServiceId, OpsSpineSnapshot } from './opsSpine';
import type { OpsDomainsSnapshot } from './opsDomains';

const emptyDomains: OpsDomainsSnapshot = {
  at: '2026-09-20T00:00:00.000Z',
  domains: [
    {
      id: 'fleet',
      status: 'healthy',
      titleKey: 'ops.domain.fleet',
      href: '/fleet',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'inference',
      status: 'healthy',
      titleKey: 'ops.domain.inference',
      href: '/inference',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'functions',
      status: 'healthy',
      titleKey: 'ops.domain.functions',
      href: '/functions',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'cells',
      status: 'healthy',
      titleKey: 'ops.domain.cells',
      href: '/cells',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'workflows',
      status: 'fixture',
      titleKey: 'ops.domain.workflows',
      href: '/workflows',
      detail: 'fixture',
      metrics: [],
    },
    {
      id: 'usage',
      status: 'healthy',
      titleKey: 'ops.domain.usage',
      href: '/usage',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'events',
      status: 'healthy',
      titleKey: 'ops.domain.events',
      href: '/events',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'bus',
      status: 'healthy',
      titleKey: 'ops.domain.bus',
      href: '/bus',
      detail: 'ok',
      metrics: [],
    },
    {
      id: 'queue',
      status: 'healthy',
      titleKey: 'ops.domain.queue',
      href: '/queues',
      detail: 'ok',
      metrics: [],
    },
  ],
};

function spine(
  overrides: Partial<
    Record<OpsSpineServiceId, 'healthy' | 'down' | 'degraded'>
  >,
): OpsSpineSnapshot {
  const status = (id: OpsSpineServiceId) => overrides[id] ?? 'healthy';
  const card = (
    id: OpsSpineServiceId,
    latencyMs: number,
    detail: string,
    href: string,
  ) => ({ id, status: status(id), latencyMs, detail, href });
  return {
    at: '2026-09-20T00:00:00.000Z',
    usage: [],
    services: [
      card('gateway', 12, 'gw', '/gateway'),
      card('runtime', 8, 'rt', '/topology'),
      card('registry', 4, 'reg', '/topology'),
      card('api', 5, 'api', '/settings/system'),
      card('cloud', 20, 'cloud', '/cloud/docs'),
      card('auth', 6, 'auth', '/settings/system'),
      card('billing', 7, 'billing', '/usage'),
    ],
  };
}

describe('opsTopology', () => {
  test('models data-plane chain Work → Gateway → Runtime', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    const ids = topo.edges.map((e) => e.id);
    expect(ids).toContain('work-gateway');
    expect(ids).toContain('gateway-runtime');
    expect(topo.edges.find((e) => e.id === 'gateway-runtime')?.label).toBe(
      '/v1/api',
    );
  });

  test('edge to runtime is down when runtime probe is down', () => {
    const topo = buildOpsTopology(spine({ runtime: 'down' }), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'gateway-runtime')?.status).toBe(
      'down',
    );
    expect(topo.nodes.find((n) => n.id === 'runtime')?.status).toBe('down');
  });

  test('gateway down fails the data plane and leaves management on Cloud', () => {
    const topo = buildOpsTopology(spine({ gateway: 'down' }), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'work-gateway')?.status).toBe('down');
    expect(topo.edges.find((e) => e.id === 'gateway-runtime')?.status).toBe(
      'down',
    );
    expect(topo.edges.find((e) => e.id === 'cloud-gateway')?.status).toBe(
      'down',
    );
    expect(topo.edges.some((e) => e.id === 'console-gateway')).toBe(false);
    expect(topo.edges.some((e) => e.id === 'gateway-api')).toBe(false);
    expect(topo.edges.find((e) => e.id === 'console-api')?.status).toBe(
      'healthy',
    );
    expect(topo.edges.find((e) => e.id === 'console-cloud')?.status).toBe(
      'healthy',
    );
  });

  test('product profiles stay on Cloud and do not attach to Runtime', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.some((e) => e.from === 'runtime' && e.to === 'functions')).toBe(
      false,
    );
    expect(topo.edges.find((e) => e.id === 'cloud-functions')?.label).toBe(
      'profile',
    );
    expect(topo.nodes.find((n) => n.id === 'fleet')?.plane).toBe('runtime');
    expect(topo.edges.find((e) => e.id === 'fleet-runtime')?.label).toBe(
      'converge',
    );
  });

  test('Console reaches Cloud and a3s-api directly; Gateway stays on the data plane', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'console-cloud')).toMatchObject({
      from: 'console',
      to: 'cloud',
      label: '/cloud-api',
    });
    expect(topo.edges.find((e) => e.id === 'console-api')).toMatchObject({
      from: 'console',
      to: 'api',
      label: '/v1/api',
    });
    expect(topo.edges.find((e) => e.id === 'gateway-registry')).toMatchObject({
      from: 'gateway',
      to: 'registry',
      label: '/v2',
    });
    expect(topo.edges.some((e) => e.id === 'console-gateway')).toBe(false);
    expect(topo.edges.some((e) => e.id === 'gateway-api')).toBe(false);
    expect(topo.edges.some((e) => e.id === 'gateway-auth')).toBe(false);
    expect(topo.edges.find((e) => e.id === 'cloud-gateway')?.label).toBe(
      'snapshot',
    );
    expect(topo.edges.some((e) => e.id === 'api-cloud')).toBe(false);
  });

  test('usage: Gateway meters, Cloud holds the ledger; workflows omitted', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'gateway-usage')).toMatchObject({
      from: 'gateway',
      to: 'usage',
      label: 'meter',
    });
    expect(topo.edges.find((e) => e.id === 'cloud-usage')).toMatchObject({
      from: 'cloud',
      to: 'usage',
      label: 'showback',
    });
    expect(topo.edges.some((e) => e.from === 'billing' && e.to === 'usage')).toBe(
      false,
    );
    expect(topo.edges.some((e) => e.id === 'runtime-usage')).toBe(false);
    expect(topo.edges.some((e) => e.id === 'api-usage')).toBe(false);
    expect(topo.nodes.some((n) => n.id === 'workflows')).toBe(false);
    expect(topo.edges.some((e) => e.to === 'workflows')).toBe(false);
  });

  test('events: Runtime access logs + api process logs both sink to events', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'runtime-events')).toMatchObject({
      from: 'runtime',
      to: 'events',
      label: 'access log',
    });
    expect(topo.edges.find((e) => e.id === 'api-events')).toMatchObject({
      from: 'api',
      to: 'events',
      label: '/logs',
    });
  });

  test('gateway down fails the meter edge; runtime down fails the access log', () => {
    const topo = buildOpsTopology(
      spine({ gateway: 'down', runtime: 'down' }),
      emptyDomains,
    );
    expect(topo.edges.find((e) => e.id === 'gateway-usage')?.status).toBe(
      'down',
    );
    expect(topo.edges.find((e) => e.id === 'runtime-events')?.status).toBe(
      'down',
    );
  });

  test('NATS bus and queue are Cloud-owned; Runtime publishes L1 to bus', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'cloud-bus')).toMatchObject({
      from: 'cloud',
      to: 'bus',
      label: 'JetStream',
    });
    expect(topo.edges.find((e) => e.id === 'runtime-bus')).toMatchObject({
      from: 'runtime',
      to: 'bus',
      label: 'L1 publish',
    });
    expect(topo.edges.find((e) => e.id === 'cloud-queue')).toMatchObject({
      from: 'cloud',
      to: 'queue',
      label: 'owns',
    });
    expect(topo.edges.find((e) => e.id === 'runtime-queue')).toMatchObject({
      from: 'runtime',
      to: 'queue',
      label: 'vault / ingest',
    });
    expect(topo.edges.some((e) => e.from === 'api' && e.to === 'bus')).toBe(
      false,
    );
  });

  test('durable cells are a Cloud profile, not an api read-through', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'cloud-cells')).toMatchObject({
      from: 'cloud',
      to: 'cells',
      label: 'profile',
    });
    expect(topo.nodes.find((n) => n.id === 'cells')?.href).toBe('/cells');
  });

  test('auth proves humans, billing invoices, middleware is shared once', () => {
    const topo = buildOpsTopology(spine({}), emptyDomains);
    expect(topo.edges.find((e) => e.id === 'api-auth')).toMatchObject({
      from: 'api',
      to: 'auth',
      label: 'proof',
    });
    expect(topo.edges.find((e) => e.id === 'cloud-auth')).toMatchObject({
      from: 'cloud',
      to: 'auth',
      label: 'OIDC',
    });
    expect(topo.edges.find((e) => e.id === 'api-billing')).toMatchObject({
      from: 'api',
      to: 'billing',
      label: 'export',
    });
    expect(topo.nodes.find((n) => n.id === 'middleware')?.detail).toContain(
      'a3s-postgres',
    );
    for (const id of [
      'api-middleware',
      'cloud-middleware',
      'auth-middleware',
      'billing-middleware',
    ]) {
      expect(topo.edges.find((e) => e.id === id)?.label).toBe('shared');
    }
    expect(topo.edges.some((e) => e.id === 'gateway-auth')).toBe(false);
    expect(topo.edges.find((e) => e.id === 'console-api')?.label).toBe('/v1/api');
  });
});
