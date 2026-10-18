import './pages/secondaryBack.dom';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { AppRoutes } from '@/App';
import { setLocale } from '@/prefs/store';

// 目录装载走 /identity/*（非 cloud 路由）：无 mock 时 happy-dom 的 fetch
// 直接抛错，目录停在 error，页面壳渲染而内容缺失。最小信封喂齐。
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input), 'http://localhost');
  const envelope = (data: unknown) =>
    new Response(JSON.stringify({ code: 0, message: 'ok', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  if (url.pathname.endsWith('/identity/session')) {
    return envelope({
      user: { id: 'u1', name: 'route', org_id: 'org1' },
      roles: [{ permissions: ['identity.read', 'identity.manage'] }],
      org_id: 'org1',
      homeOrgIsOfficial: true,
    });
  }
  if (url.pathname.endsWith('/identity/orgs')) return envelope([{ id: 'org1', name: 'Route Org' }]);
  // 云凭据（POST）+ 云面项目列表——侧栏的市场/设置目标由 cloud-scope 门控，
  // 无凭据时这些导航项不渲染，重定向用例断言的 active 项不存在。
  if (url.pathname.endsWith('/identity/cloud-credentials')) {
    return envelope({ accessToken: 'ct', organizationId: 'cloud-org', principalId: 'p1', subject: 'route' });
  }
  if (url.pathname.endsWith('/cloud/projects') || /\/organizations\/[^/]+\/projects$/.test(url.pathname)) {
    return envelope([{ id: 'proj1', name: 'Route Project' }]);
  }
  // 目录数据面（成员/部门/职位/角色）一律空数组信封——页面壳与表头照常渲染。
  if (/\/(users|members|departments|positions|roles|admin-roles)(\?|$)/.test(url.pathname) || /\/(users|members|departments|positions|admin-roles)$/.test(url.pathname)) return envelope([]);
  return envelope({});
}) as typeof fetch;

/**
 * Route-tree regression: the console tree MUST mount under /admin. A pathless
 * AppShell wrapper once left every console page at the root while links pointed
 * at /admin/* — everything bounced to /admin.
 */

async function mount(initialPath: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(
      <ConsoleToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppRoutes />
        </MemoryRouter>
      </ConsoleToastProvider>,
    );
  });
  // OrgDirectoryContext 异步装载页面数据（act 外更新警告即其痕迹）——
  // 轮询冲刷到页面内容出现，侧栏壳先行渲染不足以断言页面。
  await act(async () => {
    for (let i = 0; i < 12; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      // 目录就绪标记（Route Org 来自 orgs 信封）出现后再等两轮，
      // 让成员页的 loadDirectoryBundle 五连请求落定——侧栏壳本身
      // 就超过任何长度阈值；目录已缓存时标记首轮即在，侧栏的
      // active 高亮 effect 仍需轮次，故最少三轮。
      if (i >= 2 && (host.textContent ?? '').includes('Route Org')) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));
        break;
      }
    }
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

describe('route tree mounting', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    setLocale('zh');
  });

  test('console pages render at /admin/* (not bounced to the console home)', async () => {
    localStorage.setItem('a3s_user_token', 'a3s_us_route-test');
    setLocale('zh');
    const view = await mount('/admin/team/members');
    // 成员路由现在渲染后台用户页（users.title）；旧「成员」文案已随
    // 页面改版退役——断言对齐当前页面契约标题。
    expect(view.text()).toContain('用户');
    expect(document.title).toBe('A3S OS - 管理后台');
    view.unmount();
  });

  test('renamed routes keep their old bookmarks working', async () => {
    setLocale('zh');
    const cases: Array<[string, string]> = [
      ['/admin/overview/platform', '/admin/platform'],
      ['/admin/enterprise/roles', '/admin/team/roles'],
      ['/admin/roles', '/admin/team/roles'],
      ['/admin/tasks', '/admin/work-orders'],
      ['/admin/agent-runtimes', '/admin/agents'],
      ['/admin/events', '/admin/logs'],
      ['/admin/settings/login', '/admin/settings/sign-in'],
      ['/admin/settings/entries', '/admin/settings/runtime'],
    ];
    for (const [legacy, renamed] of cases) {
      localStorage.setItem('a3s_user_token', 'a3s_us_route-test');
      const view = await mount(legacy);
      await act(async () => {});
      const active = view.host.querySelector('a.os-sidebar__nav-item.active, a.os-sidebar__nav-item.is-current');
      expect(active?.getAttribute('href')).toBe(renamed);
      view.unmount();
    }
  });

  test('retired personal API key urls leave that page', async () => {
    setLocale('zh');
    localStorage.setItem('a3s_user_token', 'a3s_us_route-test');
    const settings = await mount('/admin/settings/api-keys');
    await act(async () => {});
    expect(settings.text()).not.toContain('个人 API Key');
    expect(settings.host.querySelector('a.os-sidebar__nav-item.active, a.os-sidebar__nav-item.is-current')?.getAttribute('href')).toBe(
      '/admin/settings/system',
    );
    settings.unmount();

    const account = await mount('/admin/account/api-keys');
    await act(async () => {});
    expect(account.text()).not.toContain('个人 API Key');
    expect(account.host.querySelector('h1')?.textContent).not.toBe('个人 API Key');
    account.unmount();
  });

  test('member-plane bookmarks land on the console', async () => {
    const view = await mount('/members');
    expect(view.text()).not.toContain('手机号登录');
    view.unmount();
  });
});
