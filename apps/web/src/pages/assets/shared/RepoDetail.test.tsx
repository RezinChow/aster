import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import type { Connector } from '@/lib/connectorHubApi';
import type { Skill } from '@/lib/skillHubApi';
import { setLocale } from '@/prefs/store';
import { ConnectorDetail } from '@/pages/assets/connectors/ConnectorDetailPage';
import { SkillDetail } from '@/pages/assets/skills/SkillHubDetailPage';

const formElement = (globalThis.window as Window & { HTMLFormElement?: unknown }).HTMLFormElement;
if (formElement && typeof globalThis.HTMLFormElement === 'undefined') {
  Object.defineProperty(globalThis, 'HTMLFormElement', {
    value: formElement,
    configurable: true,
    writable: true,
  });
}

async function settle(probe: () => boolean, rounds = 12): Promise<void> {
  // 满载下的轮询等待：全局串行满跑时 KaTeX/异步块会拖慢首帧，
  // 即时断言在负载下非确定性落空——轮到内容出现为止。
  for (let i = 0; i < rounds && !probe(); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mount(node: ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(node);
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

function shell(node: ReactNode) {
  return (
    <ConsoleToastProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </ConsoleToastProvider>
  );
}

const skill: Skill = {
  slug: 'pdf',
  name: 'PDF',
  description: 'Read PDF files',
  category: 'productivity',
  tags: ['docs'],
  author: 'acme',
  version: '1.2.0',
  color: '#64748B',
  featured: true,
  enabled: true,
  fileCount: 1,
  size: 40,
  installs: 12,
  updatedAt: Date.UTC(2026, 9, 4),
  license: 'MIT',
  homepage: 'https://example.com/pdf',
  position: 0,
  digest: 'sha256:abc123',
  files: [{ path: 'SKILL.md', size: 12 }],
  readme: '---\nname: PDF\n---\n# PDF body',
  createdAt: 1,
};

const connector: Connector = {
  slug: 'github',
  name: 'GitHub',
  description: 'Issues and pulls',
  category: 'code',
  tags: ['scm'],
  provider: 'GitHub',
  color: '#24292f',
  featured: false,
  enabled: true,
  transport: 'stdio',
  deployment: 'local',
  toolCount: 1,
  installs: 4,
  updatedAt: Date.UTC(2026, 9, 4),
  license: 'MIT',
  homepage: 'https://github.com',
  position: 0,
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  config: [
    {
      key: 'GITHUB_PERSONAL_ACCESS_TOKEN',
      description: 'token',
      required: true,
      secret: true,
    },
  ],
  tools: [{ name: 'list_issues', description: 'List issues' }],
  readme: '# GitHub connector',
  mcpConfig: { mcpServers: { github: { command: 'npx' } } },
  createdAt: 1,
};

async function click(host: HTMLElement, selector: string) {
  const node = host.querySelector(selector);
  if (!(node instanceof HTMLElement)) throw new Error(`missing ${selector}`);
  await act(async () => {
    node.click();
  });
}

/** Radix tabs change value on mousedown, which `HTMLElement.click()` does not send. */
async function press(node: HTMLElement) {
  await act(async () => {
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, cancelable: true }));
    node.click();
  });
}

describe('repository detail', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.replaceChildren();
  });

  test('a skill code page shows the package, the readme, and about together', async () => {
    setLocale('zh');
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: { path: 'SKILL.md', size: 12, text: '# PDF body' },
          request_id: 't',
          timestamp: '0',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    const view = await mount(
      shell(<SkillDetail skill={skill} onChange={() => undefined} backTo="/admin/assets/skills" />),
    );
    const text = view.host.textContent ?? '';
    expect(text).toContain('acme');
    expect(text).toContain('PDF');
    expect(text).toContain('已启用');
    expect(text).toContain('精选');
    expect(text).toContain('关于');
    expect(text).toContain('Read PDF files');
    expect(text).toContain('https://example.com/pdf');
    expect(text).toContain('docs');
    expect(text).toContain('1.2.0');
    expect(view.host.querySelector('[data-ui="repo.readme"]')?.textContent).toContain('SKILL.md');
    expect(text).toContain('SKILL.md');

    await click(view.host, '[data-ui="repo.code"] > button');
    const menu = view.host.querySelector('[data-ui="repo.code"]');
    expect(menu?.textContent).toContain('下载 ZIP');
    expect(menu?.textContent).toContain('pdf');
    expect(menu?.textContent).toContain('abc123');

    const file = [...view.host.querySelectorAll('button')].find((node) =>
      (node.textContent ?? '').includes('SKILL.md'),
    );
    if (!(file instanceof HTMLElement)) throw new Error('missing SKILL.md');
    await act(async () => {
      file.click();
    });
    expect(view.host.querySelector('[data-ui="repo.readme"]')).toBeNull();
    await settle(() => view.host.textContent.includes('SKILL.md'));
    expect(view.host.textContent).toContain('SKILL.md');

    const settings = [...view.host.querySelectorAll('button')].find(
      (node) => node.textContent === '设置',
    );
    if (!(settings instanceof HTMLElement)) throw new Error('missing settings');
    await press(settings);
    await settle(() => view.host.textContent.includes('对成员可见'));
    expect(view.host.textContent).toContain('对成员可见');
    expect(view.host.querySelector('[role="switch"]')).toBeTruthy();

    const danger = [...view.host.querySelectorAll('[role="tab"]')].find((node) =>
      (node.textContent ?? '').includes('危险'),
    );
    if (!(danger instanceof HTMLElement)) throw new Error('missing danger');
    await press(danger);
    await settle(() => view.host.textContent.includes('删除技能及其技能包'));
    expect(view.host.textContent).toContain('删除技能及其技能包');
    view.unmount();
  });

  test('a connector code page keeps tools and the server snippet off the readme', async () => {
    setLocale('zh');
    const view = await mount(
      shell(
        <ConnectorDetail
          connector={connector}
          onChange={() => undefined}
          backTo="/admin/assets/connectors"
        />,
      ),
    );
    const text = view.host.textContent ?? '';
    expect(text).toContain('GitHub');
    expect(text).toContain('Issues and pulls');
    expect(text).toContain('README.md');
    expect(text).toContain('mcp.json');
    expect(text).not.toContain('slack');
    expect(view.host.querySelector('[data-ui="repo.about"]')?.textContent).toContain('stdio');

    await click(view.host, '[data-ui="repo.code"] > button');
    const menu = view.host.querySelector('[data-ui="repo.code"]');
    expect(menu?.textContent).toContain('npx -y @modelcontextprotocol/server-github');
    expect(menu?.textContent).toContain('mcpServers');

    const readmeFile = [...view.host.querySelectorAll('button')].find((node) =>
      (node.textContent ?? '').includes('README.md'),
    );
    if (!(readmeFile instanceof HTMLElement)) throw new Error('missing README.md');
    await act(async () => {
      readmeFile.click();
    });
    expect(view.host.querySelector('[data-ui="repo.readme"]')).toBeNull();

    const tools = [...view.host.querySelectorAll('[role="tab"]')].find((node) =>
      (node.textContent ?? '').includes('工具'),
    );
    if (!(tools instanceof HTMLElement)) throw new Error('missing tools');
    await press(tools);
    await settle(() => view.host.textContent.includes('list_issues'));
    expect(view.host.textContent).toContain('list_issues');
    expect(view.host.textContent).not.toContain('slack');

    const config = [...view.host.querySelectorAll('[role="tab"]')].find(
      (node) => node.textContent === '服务配置',
    );
    if (!(config instanceof HTMLElement)) throw new Error('missing config');
    await press(config);
    await settle(() => view.host.textContent.includes('GITHUB_PERSONAL_ACCESS_TOKEN'));
    expect(view.host.textContent).toContain('GITHUB_PERSONAL_ACCESS_TOKEN');
    await settle(() => view.host.textContent.includes('必填'));
    expect(view.host.textContent).toContain('必填');
    await settle(() => view.host.textContent.includes('密钥'));
    expect(view.host.textContent).toContain('密钥');
    view.unmount();
  });
});
