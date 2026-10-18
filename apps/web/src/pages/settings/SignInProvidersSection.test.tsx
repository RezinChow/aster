import '../secondaryBack.dom';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import type { CatalogGroup, FieldSchema } from '@/lib/configApi';
import { setLocale } from '@/prefs/store';
import { SignInProvidersSection } from './SignInProvidersSection';

const text = { type: 'text', max_len: 128 } as const;
const field = (name: string, label: string, extra: Partial<FieldSchema> = {}): FieldSchema => ({
  name,
  label,
  schema: text,
  ...extra,
});

const GROUPS: CatalogGroup[] = [
  {
    id: 'login',
    label: '授权登录',
    items: [
      {
        key: 'auth.wechat',
        namespace: 'a3s',
        label: '微信',
        description: '',
        sensitive: true,
        value: {
          enabled: true,
          app_id: 'wx0123456789abcdef',
          app_secret: '••••abcd',
          callback_domain: 'a3s.example.com',
        },
        schema: {
          type: 'object',
          fields: [
            field('enabled', '启用', { schema: { type: 'boolean' } }),
            field('app_id', 'AppID', { required_when: 'enabled' }),
            field('app_secret', 'AppSecret', { required_when: 'enabled', schema: { type: 'secret', max_len: 128 } }),
            field('callback_domain', '授权回调域', { required_when: 'enabled' }),
          ],
        },
      },
      {
        key: 'auth.feishu',
        namespace: 'a3s',
        label: '飞书',
        description: '',
        sensitive: true,
        value: { enabled: false, app_id: '', app_secret: '', callback_domain: '' },
        schema: {
          type: 'object',
          fields: [
            field('enabled', '启用', { schema: { type: 'boolean' } }),
            field('app_id', 'App ID', { required_when: 'enabled' }),
            field('app_secret', 'App Secret', { required_when: 'enabled', schema: { type: 'secret', max_len: 128 } }),
            field('callback_domain', '授权回调域', { required_when: 'enabled' }),
            field('tenant_key', '限定租户'),
          ],
        },
      },
    ],
  },
];

let originalFetch: typeof fetch;
let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  setLocale('zh');
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: 0, message: 'ok', data: GROUPS }), {
      headers: { 'Content-Type': 'application/json' },
    });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
});

async function mount(path = '/admin/settings/sign-in') {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <ConsoleToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <SignInProvidersSection />
        </MemoryRouter>
      </ConsoleToastProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return host;
}

async function click(target: Element | undefined) {
  if (!(target instanceof HTMLElement)) throw new Error('missing control');
  await act(async () => {
    target.click();
  });
}

const button = (scope: ParentNode, label: string) =>
  [...scope.querySelectorAll('button')].find((node) => (node.textContent ?? '').includes(label));

describe('授权登录', () => {
  test('lists every provider with its status, not only WeChat', async () => {
    const page = await mount();
    const copy = page.textContent ?? '';
    for (const name of ['微信', '飞书']) expect(copy).toContain(name);
    expect(copy).toContain('已启用 1/2');
    expect(copy).not.toContain('第三方登录');
  });

  test('a provider opens its setup steps, credentials and callback URL', async () => {
    const page = await mount();
    await click(button(page, '飞书'));
    const copy = page.textContent ?? '';
    expect(copy).toContain('在飞书开放平台创建应用');
    expect(copy).toContain('App ID');
    expect(copy).toContain('限定租户');
    expect(copy).toContain('测试授权');
    expect(page.querySelector('a[href="https://open.feishu.cn/app"]')).not.toBeNull();
  });

  test('deep links straight to a provider and returns to the list', async () => {
    const page = await mount('/admin/settings/sign-in?provider=wechat');
    expect(page.textContent).toContain('https://a3s.example.com/api/auth/wechat/callback');
    await click(button(page, '授权登录'));
    expect(page.textContent).toContain('已启用 1/2');
  });
});
