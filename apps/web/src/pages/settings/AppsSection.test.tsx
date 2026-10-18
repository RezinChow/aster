import '../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { setLocale } from '@/prefs/store';
import { AppsSection } from '@/pages/settings/AppsSection';
import type { AppRelease } from '@/lib/appReleaseApi';

// fetch mock 的跨文件还原槽：bun 串行复用全局，未还原会污染后续文件。
const originalFetchRef = { current: globalThis.fetch };

const desktop: AppRelease[] = [
  {
    id: 'mac',
    channel: 'desktop',
    platform: 'macos',
    version: '1.2.3',
    notes: '修复登录',
    file_name: 'ToWork.dmg',
    size_bytes: 1048576,
    status: 'published',
    created_at: '2026-10-01T08:30:00Z',
    published_at: '2026-10-01T09:00:00Z',
  },
  {
    id: 'win',
    channel: 'desktop',
    platform: 'windows',
    version: '1.2.0',
    notes: '',
    file_name: 'ToWork.exe',
    size_bytes: 2048,
    status: 'draft',
    created_at: '2026-09-01T08:30:00Z',
    published_at: null,
  },
];

const mobile: AppRelease[] = [
  {
    id: 'ios',
    channel: 'mobile',
    platform: 'ios',
    version: '2.0.0',
    notes: '',
    file_name: 'app.ipa',
    size_bytes: 100,
    status: 'draft',
    created_at: '2026-08-01T00:00:00Z',
    published_at: null,
  },
];

function envelope(data: unknown) {
  return JSON.stringify({ code: 0, message: 'ok', data });
}

function installFetch(options?: { fail?: boolean; empty?: boolean }) {
  const calls: string[] = [];
  originalFetchRef.current = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (options?.fail) return new Response('nope', { status: 500 });
    const channel = new URL(url, 'http://localhost').searchParams.get('channel');
    const data = options?.empty ? [] : channel === 'mobile' ? mobile : desktop;
    return new Response(envelope(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

async function mount(node: ReactNode = <AppsSection />) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<ConsoleToastProvider>{node}</ConsoleToastProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function button(scope: ParentNode, label: string) {
  return [...scope.querySelectorAll('button')].find((node) =>
    (node.textContent ?? '').includes(label),
  );
}

async function click(target: Element | undefined) {
  if (!(target instanceof HTMLElement)) throw new Error('missing control');
  await act(async () => {
    // Radix TabsTrigger 在 mousedown 上激活（非 click）——补派发。
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    target.click();
    // 频道切换触发的 refetch 链路（credential → fetch → envelope 解包）需要
    // 数个宏任务轮 settling；与 mount 的初次装载同链但多一跳。
    for (let i = 0; i < 3; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function setSearch(host: HTMLElement, value: string) {
  const input = host.querySelector('input[aria-label="搜索版本或文件"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('missing search');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  const propsKey = Object.keys(input).find((name) => name.startsWith('__reactProps'));
  if (!propsKey) throw new Error('search input has no react props');
  const props = (
    input as unknown as Record<string, { onChange?: (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => void }>
  )[propsKey];
  await act(async () => {
    props?.onChange?.({ target: input, currentTarget: input });
  });
}

describe('settings apps', () => {
  afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetchRef.current;
  });

  test('desktop releases show channel tabs, platform filters, status, and one upload action', async () => {
    setLocale('zh');
    installFetch();
    const view = await mount();
    const text = view.host.textContent ?? '';
    expect(text).toContain('桌面应用');
    expect(text).toContain('移动应用');
    expect(text).toContain('全部');
    expect(text).toContain('macOS');
    expect(text).toContain('Windows');
    expect(text).toContain('Linux');
    expect(text).toContain('1.2.3');
    expect(text).toContain('修复登录');
    expect(text).toContain('ToWork.dmg');
    expect(text).toContain('已发布');
    expect(text).toContain('草稿');
    expect(view.host.querySelector('.os-settings-apps__channels')).toBeNull();
    const channelList = view.host.querySelector('.os-apps-channel-tabs');
    expect(channelList).toBeTruthy();
    expect(channelList?.querySelectorAll('.os-apps-channel-tab').length).toBe(2);
    const filled = [...view.host.querySelectorAll('button')].filter((node) =>
      node.className.includes('bg-neutral-900'),
    );
    expect(filled.map((node) => node.textContent)).toEqual(['上传版本']);
    view.unmount();
  });

  test('mobile tab lists that channel and keeps the search', async () => {
    setLocale('zh');
    installFetch();
    const view = await mount();
    await click(button(view.host, '移动应用'));
    expect(view.host.textContent).toContain('2.0.0');
    expect(view.host.textContent).toContain('iOS');
    expect(view.host.textContent).not.toContain('1.2.3');
    await setSearch(view.host, '2.0.0');
    await click(view.host.querySelector('button[aria-label="刷新"]') ?? undefined);
    const input = view.host.querySelector('input[aria-label="搜索版本或文件"]');
    expect(input instanceof HTMLInputElement ? input.value : '').toBe('2.0.0');
    expect(view.host.textContent).toContain('2.0.0');
    view.unmount();
  });

  test('a search miss is a no-match state and published rows confirm withdraw', async () => {
    setLocale('zh');
    installFetch();
    const view = await mount();
    await setSearch(view.host, '不存在的包');
    expect(view.host.textContent).toContain('没有匹配的版本');
    expect(view.host.textContent).not.toContain('1.2.3');
    await click(button(view.host, '清除筛选'));
    expect(view.host.textContent).toContain('1.2.3');

    const published = [...view.host.querySelectorAll('tr')].find((row) =>
      (row.textContent ?? '').includes('1.2.3'),
    );
    await click(published?.querySelector('button[aria-label="更多操作"]') ?? undefined);
    const menu = document.body.textContent ?? '';
    expect(menu).toContain('下载');
    expect(menu).toContain('撤回');
    expect(menu).not.toContain('删除');
    await click(button(document.body, '撤回'));
    expect(document.body.textContent).toContain('撤回 1.2.3？');
    const filled = [...document.body.querySelectorAll('button')].filter((node) =>
      node.className.includes('bg-neutral-900'),
    );
    expect(filled.every((node) => node.textContent !== '撤回')).toBe(true);
    view.unmount();
  });

  test('an empty channel and a failed load do not pretend there are no versions', async () => {
    setLocale('zh');
    installFetch({ empty: true });
    const empty = await mount();
    expect(empty.host.textContent).toContain('暂无版本');
    expect(empty.host.querySelector('[data-empty-variant="no-data"]')).toBeTruthy();
    empty.unmount();

    installFetch({ fail: true });
    const failed = await mount();
    expect(failed.host.textContent).not.toContain('暂无版本');
    expect(button(failed.host, '重试') ?? button(document.body, '重试')).toBeTruthy();
    failed.unmount();
  });
});
