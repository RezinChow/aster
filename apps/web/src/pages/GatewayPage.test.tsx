import './gateway.dom';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { translate } from '@/i18n/messages';
import type { GatewayStandard, GatewaySurface } from '@/lib/gatewayApi';
import { setLocale } from '@/prefs/store';
import { GATEWAY_POLL_MS, GatewayPage, formatUptime, healthOf, parseMatchers } from './GatewayPage';

const t = (key: Parameters<typeof translate>[1]) => translate('zh', key);

const service = (
  extra: { health?: { healthy: number; total: number } | null; healthPath?: string | null } = {},
) => ({
  health: null,
  healthPath: '/health',
  ...extra,
});

const standard = (
  id: string,
  method: string,
  path: string,
  coverage: GatewayStandard['coverage'],
): GatewayStandard => ({
  id,
  routes: [{ method, path }],
  coverage,
});

function liveCatalog(totalRequests: number): GatewaySurface {
  return {
    source: 'gateway/gateway.acl',
    mode: 'standalone',
    entrypoints: [{ name: 'web', address: '0.0.0.0:8080' }],
    model: [
      standard('openai.models', 'GET', '/v1/models', 'mounted'),
      standard('openai.chat', 'POST', '/v1/chat/completions', 'mounted'),
      standard('anthropic.messages', 'POST', '/v1/messages', 'absent'),
    ],
    api: [standard('api', 'POST', '/v1/service', 'absent')],
    mcp: [standard('mcp', 'POST', '/v1/mcp', 'absent')],
    platform: [
      {
        name: 'api-admin',
        matches: [{ kind: 'prefix', value: '/v1/api/admin' }],
        target: 'a3s-api',
        priority: 110,
        middlewares: ['api-cors', 'api-auth'],
        requests: totalRequests,
        errors: 2,
        avgLatencyMs: 2,
        health: { healthy: 1, total: 1 },
        healthPath: '/health',
      },
      {
        name: 'runtime',
        matches: [{ kind: 'prefix', value: '/v1/api' }],
        target: 'a3s-runtime',
        priority: 50,
        middlewares: ['runtime-cors'],
        requests: 0,
        errors: 0,
        avgLatencyMs: null,
        health: { healthy: 0, total: 1 },
        healthPath: '/health',
      },
    ],
    live: {
      reachable: true,
      observedAt: '2026-10-03T00:00:00Z',
      endpoint: 'http://127.0.0.1:9090/api/gateway',
      error: null,
      state: 'Running',
      uptimeSecs: 3_720,
      activeConnections: 3,
      totalRequests,
      errorResponses: 2,
    },
  };
}

let originalFetch: typeof fetch;
let root: Root | null = null;
let host: HTMLElement | null = null;
let calls = 0;
let respond: () => GatewaySurface = () => liveCatalog(30);

beforeEach(() => {
  setLocale('zh');
  calls = 0;
  respond = () => liveCatalog(30);
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ code: 0, message: 'ok', data: respond() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<GatewayPage />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return host;
}

describe('网关 page', () => {
  test('lists standards by plane without published models', async () => {
    const page = await mount();
    const copy = page.textContent ?? '';
    expect(copy).toContain('运行中');
    expect(copy).toContain('1 小时 2 分');
    expect(copy).toContain('2 / 5');
    expect(copy).toContain('对话');
    expect(copy).toContain('POST');
    expect(copy).toContain('/v1/chat/completions');
    expect(copy).toContain('/v1/service');
    expect(copy).toContain('/v1/mcp');
    expect(copy).not.toContain('qwen3-8b');
    expect(copy).not.toContain('已发布模型');
    expect(copy).toContain('a3s-api');
    expect(copy).toContain('/v1/api/admin/*');
    expect(copy).toContain('已挂载');
    expect(copy).toContain('未挂载');
    expect(copy).not.toContain('模型供应商');
    expect(copy).toContain('实时');
  });

  test('a platform route expands its middlewares in place', async () => {
    const page = await mount();
    const row = [...page.querySelectorAll('tr')].find((node) =>
      (node.textContent ?? '').includes('api-admin'),
    );
    expect(page.textContent ?? '').not.toContain('api-cors');
    await act(async () => {
      (row as HTMLElement).click();
    });
    expect(page.textContent ?? '').toContain('中间件');
    expect(page.textContent ?? '').toContain('api-cors');
    expect(page.textContent ?? '').toContain('api-auth');
    expect(page.querySelector('[role="dialog"]')).toBeNull();
    expect(page.querySelector('tr.is-expanded')).not.toBeNull();
    await act(async () => {
      (row as HTMLElement).click();
    });
    expect(page.textContent ?? '').not.toContain('api-cors');
  });

  test('polls the gateway and pauses while the tab is hidden', async () => {
    const page = await mount();
    expect(calls).toBe(1);
    respond = () => liveCatalog(31);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, GATEWAY_POLL_MS + 50));
    });
    expect(calls).toBe(2);
    expect(page.textContent).toContain('31 · 2 · 3');

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, GATEWAY_POLL_MS + 50));
    });
    expect(calls).toBe(2);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  }, GATEWAY_POLL_MS * 3);

  test('an unreachable node API is called out instead of passing config off as live', async () => {
    respond = () => ({
      ...liveCatalog(0),
      live: {
        reachable: false,
        observedAt: '2026-10-03T00:00:00Z',
        endpoint: 'http://127.0.0.1:9090/api/gateway',
        error: 'node API at http://127.0.0.1:9090/api/gateway unreachable',
        state: null,
        uptimeSecs: null,
        activeConnections: null,
        totalRequests: null,
        errorResponses: null,
      },
    });
    const page = await mount();
    const copy = page.textContent ?? '';
    expect(copy).not.toContain('无法连接网关节点 API');
    expect(copy).not.toContain('下表是标准目录和已挂上的路径');
    expect(copy).toContain('未连接');
    expect(copy).not.toContain('健康 1/1');
    expect(copy).not.toContain('http://');
  });
});

describe('gateway helpers', () => {
  test('health ranks problems first and needs the live probe', () => {
    const reachable = liveCatalog(0).live!;
    expect(healthOf(service({ health: { healthy: 0, total: 2 } }), reachable).tone).toBe('danger');
    expect(healthOf(service({ health: { healthy: 1, total: 2 } }), reachable).tone).toBe('warn');
    expect(healthOf(service({ health: { healthy: 2, total: 2 } }), reachable).tone).toBe('success');
    expect(healthOf(service({ health: { healthy: 1, total: 1 } }), null).label).toBe('gateway.health.unknown');
  });

  test('route rules read as paths, falling back to the raw rule', () => {
    expect(parseMatchers('PathPrefix(`/api`)')).toEqual([{ kind: 'prefix', value: '/api' }]);
    expect(parseMatchers('Path(`/v1/models`, `/v1/messages`)')).toEqual([
      { kind: 'exact', value: '/v1/models' },
      { kind: 'exact', value: '/v1/messages' },
    ]);
    expect(parseMatchers('Host(`a.example`) && PathPrefix(`/x`)')).toEqual([
      { kind: 'host', value: 'a.example' },
      { kind: 'prefix', value: '/x' },
    ]);
    expect(parseMatchers('Method(`GET`)')).toEqual([{ kind: 'raw', value: 'Method(`GET`)' }]);
  });

  test('uptime reads in the largest two units', () => {
    expect(formatUptime(42, t)).toBe('42 秒');
    expect(formatUptime(125, t)).toBe('2 分钟');
    expect(formatUptime(90_000, t)).toBe('1 天 1 小时');
  });
});
