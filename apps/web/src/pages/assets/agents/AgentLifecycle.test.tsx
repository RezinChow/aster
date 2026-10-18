import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { AgentDetailPage } from './AgentDetailPage';
import { AgentHubPage } from './AgentHubPage';

type StoredAgent = {
  slug: string;
  name: string;
  description: string;
  prompt: string;
  emoji: string;
  category: string;
  tags: string[];
  color: string;
  featured: boolean;
  enabled: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
};

const agents: StoredAgent[] = [];

const envelope = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({ code: 0, message: 'ok', data, request_id: 'test', timestamp: '0' }),
    { status, headers: { 'content-type': 'application/json' } },
  );

function card(agent: StoredAgent) {
  return {
    slug: agent.slug,
    name: agent.name,
    description: agent.description,
    category: agent.category,
    tags: agent.tags,
    color: agent.color,
    featured: agent.featured,
    enabled: agent.enabled,
    emoji: agent.emoji,
    updatedAt: agent.updatedAt,
  };
}

function full(agent: StoredAgent) {
  return { ...card(agent), prompt: agent.prompt, position: agent.position, createdAt: agent.createdAt };
}

function facets() {
  const categories = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const agent of agents) {
    categories.set(agent.category, (categories.get(agent.category) ?? 0) + 1);
    for (const tag of agent.tags) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  const counts = (map: Map<string, number>) =>
    [...map.entries()].map(([value, count]) => ({ value, count }));
  return { total: agents.length, categories: counts(categories), tags: counts(tags) };
}

async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw, 'http://console.local');
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const path = url.pathname.replace(/^\/v1\/api\/admin/, '');
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;

  if (method === 'GET' && path === '/assets/agents/facets') return envelope(facets());
  if (method === 'GET' && path === '/assets/agents') {
    const status = url.searchParams.get('status');
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const items = agents.filter((agent) => {
      if (status === 'enabled' && !agent.enabled) return false;
      if (status === 'disabled' && agent.enabled) return false;
      if (q && !`${agent.name}\n${agent.slug}\n${agent.prompt}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return envelope({ items: items.map(card), total: items.length, page: 1, pageSize: 50 });
  }

  const slug = decodeURIComponent(path.replace(/^\/assets\/agents\//, ''));
  const statusPath = slug.endsWith('/status');
  const key = statusPath ? slug.slice(0, -'/status'.length) : slug;
  const found = agents.find((agent) => agent.slug === key);

  if (method === 'POST' && path === '/assets/agents/cases/acp-cloud') {
    const now = Date.now();
    const created: StoredAgent = {
      slug: 'acp-cloud',
      name: 'ACP 云端智能体',
      description: 'ACP protocolVersion 1',
      prompt: '记住同一 sessionId',
      emoji: '云',
      category: 'code',
      tags: ['acp'],
      color: '#2563EB',
      featured: true,
      enabled: true,
      position: 0,
      createdAt: now,
      updatedAt: now,
    };
    agents.push(created);
    return envelope({ ...full(created), protocol: 'acp', archiveDigest: 'sha256:abc' }, 200);
  }

  if (method === 'POST' && path === '/assets/agents') {
    const now = Date.now();
    const created: StoredAgent = {
      slug: String(body?.slug ?? ''),
      name: String(body?.name ?? ''),
      description: String(body?.description ?? ''),
      prompt: String(body?.prompt ?? ''),
      emoji: String(body?.emoji ?? ''),
      category: String(body?.category ?? 'other'),
      tags: Array.isArray(body?.tags) ? body.tags.map(String) : [],
      color: String(body?.color ?? '#2563EB'),
      featured: Boolean(body?.featured),
      enabled: true,
      position: Number(body?.position ?? 0),
      createdAt: now,
      updatedAt: now,
    };
    agents.push(created);
    return envelope(full(created), 201);
  }
  if (!found) return envelope(null, 404);
  if (method === 'GET') return envelope(full(found));
  if (method === 'PUT' && statusPath) {
    found.enabled = Boolean(body?.enabled);
    found.updatedAt = Date.now();
    return envelope(full(found));
  }
  if (method === 'PUT') {
    found.name = String(body?.name ?? found.name);
    found.description = String(body?.description ?? '');
    found.prompt = String(body?.prompt ?? '');
    found.emoji = String(body?.emoji ?? '');
    found.category = String(body?.category ?? found.category);
    found.tags = Array.isArray(body?.tags) ? body.tags.map(String) : [];
    found.color = String(body?.color ?? found.color);
    found.featured = Boolean(body?.featured);
    found.position = Number(body?.position ?? 0);
    found.updatedAt = Date.now();
    return envelope(full(found));
  }
  if (method === 'DELETE') {
    const index = agents.findIndex((agent) => agent.slug === key);
    agents.splice(index, 1);
    return envelope({ ok: true });
  }
  return envelope(null, 404);
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  const propsKey = Object.keys(element).find((name) => name.startsWith('__reactProps'));
  const props = propsKey
    ? (element as unknown as Record<string, { onChange?: (event: { target: EventTarget; currentTarget: EventTarget }) => void }>)[propsKey]
    : undefined;
  props?.onChange?.({ target: element, currentTarget: element });
}

function buttonNamed(name: string, root: ParentNode = document): HTMLButtonElement {
  const button = [...root.querySelectorAll('button')].find(
    (node) => node.textContent?.includes(name) && !node.hasAttribute('disabled'),
  );
  if (!(button instanceof HTMLButtonElement)) {
    const labels = [...document.querySelectorAll('button')].map((node) => node.textContent?.trim());
    throw new Error(`missing button ${name}: ${labels.join(' | ')}`);
  }
  return button;
}

async function settle(host: HTMLElement, text: string) {
  for (let i = 0; i < 40 && !host.textContent?.includes(text) && !document.body.textContent?.includes(text); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
}

describe('agent page lifecycle', () => {
  const mounted: Array<{ root: Root; host: HTMLElement }> = [];
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    agents.splice(0);
    for (const view of mounted.splice(0)) {
      act(() => view.root.unmount());
      view.host.remove();
    }
    document.body.innerHTML = '';
  });

  test('creates, edits, disables, and deletes an agent from the console pages', async () => {
    globalThis.fetch = handle as typeof fetch;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(
        <ConsoleToastProvider>
          <MemoryRouter initialEntries={['/admin/assets/agents']}>
            <Routes>
              <Route path="/admin/assets/agents" element={<AgentHubPage />} />
              <Route path="/admin/assets/agents/:slug" element={<AgentDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ConsoleToastProvider>,
      );
    });
    await settle(host, '还没有智能体');
    expect(document.body.textContent).toContain('智能体');
    expect(document.body.querySelector('select')).toBeNull();

    await act(async () => {
      buttonNamed('新建智能体').click();
    });
    await settle(host, 'writer');
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    const name = dialog?.querySelector('input');
    const slug = dialog?.querySelector('input[placeholder="writer"]');
    const prompt = dialog?.querySelector('textarea');
    expect(name).toBeInstanceOf(HTMLInputElement);
    expect(slug).toBeInstanceOf(HTMLInputElement);
    expect(prompt).toBeInstanceOf(HTMLTextAreaElement);
    await act(async () => {
      setNativeValue(name as HTMLInputElement, '文档助手');
      setNativeValue(slug as HTMLInputElement, 'writer');
      setNativeValue(prompt as HTMLTextAreaElement, '用简洁中文写');
    });
    await act(async () => {
      buttonNamed('创建').click();
    });
    await settle(host, '用简洁中文写');
    expect(document.body.textContent).toContain('文档助手');
    expect(agents.map((agent) => agent.slug)).toEqual(['writer']);

    await act(async () => {
      buttonNamed('编辑').click();
    });
    const editor = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const editedName = editor?.querySelector('input');
    expect(editedName).toBeInstanceOf(HTMLInputElement);
    await act(async () => {
      setNativeValue(editedName as HTMLInputElement, '文档助手改');
    });
    await act(async () => {
      buttonNamed('保存').click();
    });
    await settle(host, '文档助手改');
    expect(agents[0]?.name).toBe('文档助手改');
    expect(agents[0]?.prompt).toBe('用简洁中文写');

    const settings = buttonNamed('设置');
    await act(async () => {
      settings.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      settings.click();
    });
    const toggle = document.querySelector('[role="switch"]');
    expect(toggle).toBeTruthy();
    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle(host, '已停用');
    expect(agents[0]?.enabled).toBe(false);

    await act(async () => {
      buttonNamed('危险操作').click();
    });
    await act(async () => {
      buttonNamed('删除').click();
    });
    const confirm = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    const typed = confirm?.querySelector('input');
    expect(typed).toBeInstanceOf(HTMLInputElement);
    await act(async () => {
      setNativeValue(typed as HTMLInputElement, 'writer');
    });
    await act(async () => {
      buttonNamed('删除', confirm ?? document).click();
    });
    await settle(host, '还没有智能体');
    expect(agents).toHaveLength(0);
    expect(document.body.textContent).toContain('还没有智能体');
  });

  test('registers the ACP cloud agent case into the catalog', async () => {
    globalThis.fetch = handle as typeof fetch;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(
        <ConsoleToastProvider>
          <MemoryRouter initialEntries={['/admin/assets/agents']}>
            <Routes>
              <Route path="/admin/assets/agents" element={<AgentHubPage />} />
            </Routes>
          </MemoryRouter>
        </ConsoleToastProvider>,
      );
    });
    await settle(host, 'ACP 云端智能体');
    await act(async () => {
      buttonNamed('ACP 云端智能体').click();
    });
    await settle(host, '登记案例');
    expect(document.body.textContent).toContain('下载 .aix');

    await act(async () => {
      buttonNamed('登记案例').click();
    });
    await settle(host, 'ACP 云端智能体');
    expect(agents.map((agent) => agent.slug)).toEqual(['acp-cloud']);
    expect(agents[0]?.tags).toEqual(['acp']);
    expect(agents[0]?.prompt).toContain('sessionId');
  });
});
