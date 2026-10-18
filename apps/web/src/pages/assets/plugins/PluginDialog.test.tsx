import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { setLocale } from '@/prefs/store';
import { PluginDialog } from './PluginDialog';

const envelope = (data: unknown) =>
  JSON.stringify({
    code: 0,
    message: 'ok',
    data,
    request_id: 'test',
    timestamp: '0',
  });

describe('package registration form', () => {
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

  async function open(scope: 'org' | 'member', name: string) {
    setLocale('zh');
    const bodies: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/namespaces/current')) {
        return new Response(envelope({ name }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (init?.body) bodies.push(String(init.body));
      return new Response(envelope({ publisher: name, name: 'notes' }), {
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
          <MemoryRouter>
            <PluginDialog open namespaceScope={scope} onOpenChange={() => undefined} onSaved={() => undefined} />
          </MemoryRouter>
        </ConsoleToastProvider>,
      );
    });
    let publisher: HTMLInputElement | null = null;
    for (let i = 0; i < 30 && publisher?.value !== name; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      publisher = [...document.querySelectorAll('input')].find((input) => input.value === name) ?? null;
    }
    return { host: document.body, publisher, bodies };
  }

  test('the official publisher is a3s and stays public', async () => {
    const { host, publisher } = await open('org', 'a3s');
    expect(publisher?.value).toBe('a3s');
    expect(publisher?.disabled).toBe(true);
    expect(host.textContent).toContain('公开');
    expect(host.textContent).not.toContain('仅命名空间');
    expect(host.querySelector('select')).toBeNull();
  });

  test('an organization form locks the claimed namespace', async () => {
    const { host, publisher } = await open('org', 'acme');
    expect(publisher?.value).toBe('acme');
    expect(publisher?.disabled).toBe(true);
    const visibility = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('公开'));
    await act(async () => {
      visibility?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.textContent).toContain('仅命名空间');
    expect(host.querySelector('select')).toBeNull();
  });

  test('a personal form locks the member namespace', async () => {
    const { host, publisher } = await open('member', 'ada');
    expect(publisher?.value).toBe('ada');
    expect(publisher?.disabled).toBe(true);
    expect(host.querySelector('select')).toBeNull();
  });
});
