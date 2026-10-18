import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { PluginHubPage } from './PluginHubPage';

const envelope = (data: unknown) =>
  JSON.stringify({
    code: 0,
    message: 'ok',
    data,
    request_id: 'test',
    timestamp: '0',
  });

describe('plugin hub', () => {
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

  test('lists packages with the connector hub chrome and no native select', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes('/facets')
        ? { total: 1, surfaces: [{ value: 'ui', count: 1 }] }
        : {
            items: [
              {
                publisher: 'a3s',
                name: 'review',
                title: '审查',
                version: '1.0.0',
                description: '审查 Word 文档',
                surfaces: ['skill', 'ui'],
                enabled: true,
                featured: true,
                installs: 0,
                color: '#6E5CE6',
                updatedAt: 1_700_000_000_000,
                createdAt: 1_700_000_000_000,
                logoUrl: '/v1/api/admin/assets/plugins/a3s/review/logo?v=abc123def456',
                coverUrl: '/v1/api/admin/assets/plugins/a3s/review/cover?v=abc123def456',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          };
      return new Response(envelope(data), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(
        <ConsoleToastProvider>
          <MemoryRouter initialEntries={['/admin/assets/plugins']}>
            <PluginHubPage />
          </MemoryRouter>
        </ConsoleToastProvider>,
      );
    });
    for (let i = 0; i < 20 && !host.textContent?.includes('review'); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }

    expect(host.textContent).toContain('插件');
    expect(host.textContent).toContain('a3s');
    expect(host.textContent).toContain('review');
    expect(host.textContent).toContain('精选');
    expect(host.textContent).toContain('1.0.0');
    expect(host.textContent).toContain('技能');
    expect(host.textContent).toContain('界面');
    expect(host.querySelector('select')).toBeNull();
    expect(host.querySelector('a[href*="/admin/assets/plugins/a3s/review"]')).toBeTruthy();
    const logo = host.querySelector('img');
    expect(logo?.getAttribute('src')).toContain('/assets/plugins/a3s/review/logo?v=');
  });
});
