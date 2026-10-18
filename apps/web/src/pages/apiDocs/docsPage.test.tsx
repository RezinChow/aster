import '../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '@/App';
import { setLocale } from '@/prefs/store';

const originalFetch = globalThis.fetch;

function spec(path: string, operationId: string, summary: string) {
  return {
    openapi: '3.0.3',
    paths: {
      [path]: {
        get: {
          operationId,
          summary,
          responses: { '200': { description: 'ok' } },
        },
      },
    },
  };
}

function installFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(href, 'http://localhost');
    if (url.pathname === '/v1/api/admin/docs/openapi.json') {
      const body = {
        openapi: '3.0.3',
        paths: {
          '/v1/api/org/members': {
            get: {
              operationId: 'listMembers',
              summary: '列出成员',
              responses: { '200': { description: 'ok' } },
            },
          },
          '/v1/api/admin/suppliers': {
            get: {
              operationId: 'listSuppliers',
              summary: '列出供应商',
              responses: { '200': { description: 'ok' } },
            },
          },
        },
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.pathname === '/cloud-openapi/openapi.json') {
      return new Response(
        JSON.stringify(spec('/projects', 'listProjects', '列出项目')),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response('missing', { status: 404 });
  }) as typeof fetch;
}

async function settle(host: HTMLElement, needle: string) {
  for (let i = 0; i < 30; i += 1) {
    if ((host.textContent ?? '').includes(needle)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mount(path: string) {
  installFetch();
  setLocale('zh');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    );
  });
  return {
    host,
    text: () => host.textContent ?? '',
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function currentSource(host: HTMLElement): string {
  return host.querySelector('[aria-label="文档来源"] [aria-current="page"]')?.textContent ?? '';
}

describe('unified /docs route', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    setLocale('zh');
  });

  test('the page switches platform, control plane, and data plane', async () => {
    const view = await mount('/docs');
    await settle(view.host, '列出成员');
    expect(currentSource(view.host)).toBe('平台');
    expect(view.host.querySelector('[aria-label="文档来源"]')?.textContent ?? '').not.toContain('前台接口');
    expect(view.host.querySelector('[aria-label="接口范围"]')?.textContent ?? '').toContain('前台接口');
    expect(view.text()).toContain('列出成员');
    expect(view.text()).toContain('前台接口');
    expect(view.text()).toContain('/v1/api/org/members');

    const back = [...view.host.querySelectorAll('button')].find((node) => node.textContent === '后台接口');
    expect(back?.getAttribute('aria-checked')).toBe('false');
    await act(async () => {
      back!.click();
    });
    await settle(view.host, '列出供应商');
    expect(view.host.querySelector('[aria-label="接口范围"] [aria-checked="true"]')?.textContent).toBe('后台接口');
    expect(view.text()).toContain('/v1/api/admin/suppliers');
    expect(view.text()).not.toContain('列出成员');

    const cloud = [...view.host.querySelectorAll('button')].find((node) => node.textContent === '控制面');
    expect(cloud).toBeTruthy();
    await act(async () => {
      cloud!.click();
    });
    await settle(view.host, '列出项目');
    expect(currentSource(view.host)).toBe('控制面');
    expect(view.text()).toContain('/projects');
    expect(view.text()).not.toContain('前台接口');
    expect(view.text()).toContain('本页是控制面契约');

    const work = [...view.host.querySelectorAll('button')].find((node) => node.textContent === '数据面');
    expect(work).toBeTruthy();
    await act(async () => {
      work!.click();
    });
    await settle(view.host, '列出已开通模型');
    expect(currentSource(view.host)).toBe('数据面');
    expect(view.text()).toContain('/v1/api/services/models');
    expect(view.text()).toContain('本页为 Work Gateway 数据面');
    expect(view.text()).not.toContain('登录管理后台');
    view.unmount();
  });

  test('old cloud and work docs urls open the same page', async () => {
    const cloud = await mount('/admin/cloud/docs/missingOp');
    await settle(cloud.host, '列出项目');
    expect(currentSource(cloud.host)).toBe('控制面');
    expect(cloud.text()).toContain('/projects');
    cloud.unmount();

    const work = await mount('/admin/developer/docs/listModels');
    await settle(work.host, '列出已开通模型');
    expect(currentSource(work.host)).toBe('数据面');
    expect(work.text()).toContain('/v1/api/services/models');
    expect(work.text()).not.toContain('登录管理后台');
    work.unmount();
  });
});
