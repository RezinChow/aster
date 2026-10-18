import { mock } from 'bun:test';

mock.module('@/components/OfficeMarkdownEditor', () => ({
  toMarkdownContent: (markdown: string) => ({ type: 'markdown', markdown }),
  OfficeMarkdownEditor: ({ content }: { content: { markdown?: string } }) => {
    const { createElement } = require('react') as typeof import('react');
    return createElement('pre', null, content.markdown ?? '');
  },
}));

import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { setLocale } from '@/prefs/store';
import type { PluginCard } from '@/lib/pluginHubApi';
import { PluginDetail } from './PluginDetailPage';

const digest = `sha256:${'ab'.repeat(32)}`;

const envelope = (data: unknown) =>
  JSON.stringify({
    code: 0,
    message: 'ok',
    data,
    request_id: 'test',
    timestamp: '0',
  });

function card(files?: PluginCard['files']): PluginCard {
  return {
    publisher: 'a3s',
    name: 'review',
    version: '1.0.0',
    category: 'developer',
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
    ...(files ? { files } : {}),
  };
}

describe('plugin detail files', () => {
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

  async function render(plugin: PluginCard): Promise<HTMLElement> {
    setLocale('zh');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(
        <ConsoleToastProvider>
          <MemoryRouter>
            <PluginDetail plugin={plugin} onChange={() => undefined} backTo="/admin/assets/plugins" />
          </MemoryRouter>
        </ConsoleToastProvider>,
      );
    });
    return host;
  }

  test('shows the review package files instead of surface placeholders', async () => {
    const host = await render(
      card([
        { path: 'README.md', size: 24, sha256: digest, text: '# 审查\n\n选择一份文档。\n' },
        {
          path: 'skills/review/SKILL.md',
          size: 28,
          sha256: digest,
          text: '---\nname: review\n---\n',
        },
        { path: 'a3s-use-extension.acl', size: 18, sha256: digest, text: 'id = "a3s/review"\n' },
      ]),
    );
    for (let i = 0; i < 20 && !host.textContent?.includes('选择一份文档'); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(host.textContent).toContain('选择一份文档');
    expect(host.textContent).toContain('精选');
    const images = [...host.querySelectorAll('img')].map((image) => image.getAttribute('src'));
    expect(images.some((src) => src?.includes('/assets/plugins/a3s/review/logo?v='))).toBe(true);
    expect(images.some((src) => src?.includes('/assets/plugins/a3s/review/cover?v='))).toBe(true);
    const root = host.querySelector('nav button');
    expect(root?.textContent).toBe('a3s/review');
    await act(async () => {
      root?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(host.textContent).toContain('a3s-use-extension.acl');
    expect(host.textContent).toContain('skills');
    expect(host.textContent).not.toContain('a3s/review@1.0.0\n技能');
  });

  test('an older generation hides edit and delete', async () => {
    const oldDigest = `sha256:${'cd'.repeat(32)}`;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/generation')) {
        return new Response(
          envelope({
            ...card([{ path: 'README.md', size: 4, sha256: oldDigest, text: 'old' }]),
            version: '0.9.0',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/compare')) {
        return new Response(envelope([{ path: 'README.md', kind: 'changed', diff: '- old\n+ new' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        envelope([
          { version: '1.0.0', digest, updatedAt: 2, note: 'current' },
          { version: '0.9.0', digest: oldDigest, updatedAt: 1, note: 'first' },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }) as typeof fetch;
    const host = await render(card([{ path: 'README.md', size: 4, sha256: digest, text: 'new' }]));
    for (let i = 0; i < 20 && !host.textContent?.includes('first'); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(host.textContent).toContain('发布历史');
    expect(host.textContent).toContain('first');
    expect(host.querySelector('select')).toBeNull();
    const option = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('0.9.0'));
    await act(async () => {
      option?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    for (let i = 0; i < 20 && host.textContent?.includes('编辑'); i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(host.textContent).not.toContain('编辑');
    expect(host.textContent).not.toContain('删除插件包');
  });

  test('an operator package with no files shows an empty browser', async () => {
    const host = await render(card());
    expect(host.textContent).toContain('精选');
    expect(host.textContent).toContain('还没有描述');
    expect(host.textContent).not.toContain('SKILL.md');
    expect(host.textContent).not.toContain('index.html');
  });
});
