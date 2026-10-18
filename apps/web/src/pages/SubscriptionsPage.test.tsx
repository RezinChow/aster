import './secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { translate } from '@/i18n/messages';
import { listPlans, updatePlan } from '@/data/subscriptions';
import { setLocale } from '@/prefs/store';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';

// fetch mock 的跨文件还原槽：bun 串行复用全局，未还原会污染后续文件。
const originalFetchRef = { current: globalThis.fetch };

const RAINBOW = [
  'bg-fuchsia',
  'text-fuchsia',
  'bg-cyan',
  'text-cyan',
  'bg-emerald',
  'text-emerald',
  'bg-indigo',
  'text-indigo',
  'bg-violet',
  'text-violet',
  'bg-rose',
  'text-rose',
  'bg-sky',
  'text-sky',
  'from-sky',
  'to-sky',
  'bg-gradient',
];

async function mount(node: ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<ConsoleToastProvider>{node}</ConsoleToastProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    host,
    text: () => host.textContent ?? '',
    html: () => host.innerHTML,
    async click(label: string, rootNode: ParentNode = host) {
      const target = [...rootNode.querySelectorAll('button, a, [role="tab"]')].find(
        (node) => (node.textContent ?? '').includes(label),
      );
      if (!(target instanceof HTMLElement)) {
        throw new Error(`missing control ${label}`);
      }
      await act(async () => {
        // Radix TabsTrigger 在 mousedown 上激活（非 click）——补派发。
        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
        target.click();
      });
    },
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

async function setSearch(host: HTMLElement, value: string) {
  const input = host.querySelector('input[aria-label="搜索名称、对象或能力"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('missing search');
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  const propsKey = Object.keys(input).find((name) =>
    name.startsWith('__reactProps'),
  );
  if (!propsKey) throw new Error('search input has no react props');
  const props = (
    input as unknown as Record<
      string,
      {
        onChange?: (event: {
          target: HTMLInputElement;
          currentTarget: HTMLInputElement;
        }) => void;
      }
    >
  )[propsKey];
  await act(async () => {
    props?.onChange?.({ target: input, currentTarget: input });
  });
}

describe('subscriptions page', () => {
  afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetchRef.current;
  });

  test('the catalog is named 订阅 and scans price instead of four currency columns', async () => {
    setLocale('zh');
    expect(translate('zh', 'nav.subscriptions')).toBe('订阅');
    expect(translate('zh', 'nav.subscriptionsDesc')).toBe('管理平台订阅与定价。');
    expect(translate('en', 'nav.subscriptions')).toBe('Subscriptions');

    const view = mount(<SubscriptionsPage />);
    const page = await view;
    expect(page.text()).toContain('订阅');
    expect(page.text()).toContain('管理平台订阅与定价。');
    expect(page.text()).not.toContain('订阅套餐');
    expect(page.text()).toContain('Team');
    expect(page.text()).toContain('适合多团队协作');
    expect(page.text()).toContain('¥499');
    expect(page.text()).toContain('年付');
    expect(page.text()).toContain('主推');
    expect(page.text()).toContain('Enterprise');
    expect(page.text()).toContain('定制');
    expect(page.text()).not.toContain('人民币 · 月付');
    expect(page.text()).not.toContain('工作流自动化');
    expect(page.text()).not.toContain('没有订阅');
    const tabs = page.host.querySelector('[aria-label="订阅类型"]');
    expect(tabs?.textContent).toContain('全部');
    expect(tabs?.textContent).toContain('在售');
    expect(tabs?.textContent).toContain('定制');
    const filled = [...page.host.querySelectorAll('button, a')].filter((node) =>
      node.className.includes('bg-neutral-900'),
    );
    expect(filled).toHaveLength(0);
    for (const token of RAINBOW) {
      expect(page.html()).not.toContain(token);
    }

    const team = [...page.host.querySelectorAll('tr')].find((row) =>
      (row.textContent ?? '').includes('Team'),
    );
    if (!(team instanceof HTMLElement)) throw new Error('missing Team row');
    await act(async () => {
      team.click();
    });
    const drawer = document.querySelector('.ui-drawer-panel');
    expect(drawer?.textContent).toContain('Team');
    expect(drawer?.textContent).toContain('工作流自动化');
    expect(drawer?.textContent).toContain('人民币 · 月付');
    expect(drawer?.textContent).toContain('¥499');
    expect(drawer?.textContent).toContain('编辑配置');
    const drawerEdit = drawer?.querySelector('button');
    expect(drawerEdit?.className.includes('bg-neutral-900')).toBe(false);

    await page.click('定制', tabs ?? page.host);
    expect(page.text()).toContain('Enterprise');
    expect(page.text()).not.toContain('Builder');
    expect(page.text()).not.toContain('没有匹配结果');

    await setSearch(page.host, '不存在的订阅');
    expect(page.text()).toContain('没有匹配结果');
    expect(page.text()).not.toContain('没有订阅');
    await page.click('清除筛选');
    expect(page.text()).toContain('Builder');
    expect(page.text()).toContain('Enterprise');

    const edit = page.host.querySelector('[aria-label="编辑配置"]');
    if (!(edit instanceof HTMLElement)) throw new Error('missing edit');
    await act(async () => {
      edit.click();
    });
    const dialog = document.querySelector('[role="dialog"]:not(.ui-drawer-panel)');
    expect(dialog?.textContent).toContain('编辑订阅');
    expect(dialog?.textContent).toContain('定价');
    expect(dialog?.textContent).toContain('对象（中文）');
    const save = [...(dialog?.querySelectorAll('button') ?? [])].find((node) =>
      (node.textContent ?? '').includes('保存'),
    );
    expect(save?.className.includes('bg-neutral-900')).toBe(true);

    page.unmount();
  });

  test('refresh reloads the catalog and keeps the current search', async () => {
    setLocale('zh');
    const enterprise = listPlans().find((plan) => plan.id === 'enterprise');
    if (!enterprise) throw new Error('missing enterprise');
    const view = await mount(<SubscriptionsPage />);
    try {
      await setSearch(view.host, 'Enterprise');
      expect(view.text()).toContain('Enterprise');
      expect(view.text()).not.toContain('Builder');
      expect(view.text()).not.toContain('刷新探针对象');

      updatePlan('enterprise', {
        audience: { zh: '刷新探针对象', en: enterprise.audience.en },
        description: enterprise.description,
        features: enterprise.features,
        includes: enterprise.includes,
        unit: enterprise.unit,
        meter: enterprise.meter,
        highlighted: enterprise.highlighted,
        custom: true,
        cny: { monthly: null, annual: null },
        usd: { monthly: null, annual: null },
      });
      expect(view.text()).not.toContain('刷新探针对象');

      const refresh = view.host.querySelector('[aria-label="刷新"]');
      if (!(refresh instanceof HTMLElement)) throw new Error('missing refresh');
      await act(async () => {
        refresh.click();
        await new Promise((resolve) => setTimeout(resolve, 450));
      });
      expect(view.text()).toContain('刷新探针对象');
      expect(view.text()).toContain('Enterprise');
      expect(view.text()).not.toContain('Builder');
    } finally {
      updatePlan('enterprise', {
        audience: enterprise.audience,
        description: enterprise.description,
        features: enterprise.features,
        includes: enterprise.includes,
        unit: enterprise.unit,
        meter: enterprise.meter,
        highlighted: enterprise.highlighted,
        custom: true,
        cny: { monthly: null, annual: null },
        usd: { monthly: null, annual: null },
      });
      view.unmount();
    }
  });
});
