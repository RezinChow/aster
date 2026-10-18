import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { AppletHubPage } from './AppletHubPage';

const envelope = (data: unknown) =>
  JSON.stringify({
    code: 0,
    message: 'ok',
    data,
    request_id: 'test',
    timestamp: '0',
  });

const review = {
  publisher: 'a3s',
  name: 'review',
  title: '法务专家',
  version: '1.2.0',
  category: 'developer',
  description: '审查 Word 合同。',
  surfaces: ['ui', 'agent'],
  enabled: true,
  featured: true,
  installs: 4,
  color: '#111111',
  updatedAt: 1_700_000_000_000,
  createdAt: 1_700_000_000_000,
  logoUrl: '/v1/api/admin/assets/plugins/a3s/review/logo?v=abc',
  coverUrl: null,
};

describe('applet hub', () => {
  const mounted: Array<{ root: Root; host: HTMLElement }> = [];
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const view of mounted.splice(0)) {
      act(() => view.root.unmount());
      view.host.remove();
    }
    document.body.innerHTML = '';
  });

  async function mount() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(
        <ConsoleToastProvider>
          <MemoryRouter initialEntries={['/admin/assets/applets']}>
            <AppletHubPage />
          </MemoryRouter>
        </ConsoleToastProvider>,
      );
    });
    for (let i = 0; i < 20 && !host.textContent?.includes('法务专家') && !host.textContent?.includes('还没有小程序'); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    return host;
  }

  test('lists interface packages with the asset hub chrome', async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      const data = url.includes('/facets')
        ? { total: 1, surfaces: [{ value: 'ui', count: 1 }], categories: [{ value: 'developer', count: 1 }] }
        : { items: [review], total: 1, page: 1, pageSize: 50 };
      return new Response(envelope(data), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const host = await mount();
    expect(host.textContent).toContain('小程序');
    expect(host.textContent).toContain('新建小程序');
    expect(host.textContent).toContain('法务专家');
    expect(host.textContent).toContain('1.2.0');
    expect(host.textContent).toContain('开发工具');
    expect(host.textContent).not.toContain('内置');
    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector('a[href="/admin/assets/applets/a3s/review"]')).toBeTruthy();
    expect(host.querySelector('img')?.getAttribute('src')).toContain('/assets/plugins/a3s/review/logo');
    expect(urls.some((url) => url.includes('surface=ui'))).toBe(true);
    expect(urls.some((url) => url.includes('/facets?surface=ui') || url.includes('/facets?surface=ui'))).toBe(true);
  });

  test('shows the empty catalog when the request fails', async () => {
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;

    const host = await mount();
    expect(host.textContent).not.toContain('请假');
    expect(host.textContent).not.toContain('用印');
    expect(host.textContent).toContain('offline');
  });
});
