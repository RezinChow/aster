import './secondaryBack.dom';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'bun:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { AppShell } from '@/shell/AppShell';

const shellCss = readFileSync(
  new URL('../styles/shell.css', import.meta.url),
  'utf8',
);
const designerCss = readFileSync(
  new URL('../flow-designer/host.css', import.meta.url),
  'utf8',
);

function ruleBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(
    new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`),
  );
  if (!match?.[1]) throw new Error(`missing rule ${selector}`);
  return match[1];
}

const DESIGNER_PATH = '/admin/assets/models/Qwen/Qwen3-8B';

const SECONDARY_PATHS = [
  DESIGNER_PATH,
  '/admin/assets/agents/writer',
  '/admin/assets/connectors/github',
  '/admin/assets/plugins/a3s/review',
  '/admin/assets/skills/pdf-tools',
  '/admin/workflows/flow_8f2a',
  '/admin/channels/new',
  '/admin/channels/ch_1',
  '/admin/suppliers/sup_1',
  '/admin/marketplace/providers/new',
  '/admin/marketplace/providers/prov_1',
  '/admin/marketplace/listings/list_1',
];

const PRIMARY_PATHS = [
  '/admin/workflows',
  '/admin/workflows/',
  '/admin/channels',
  '/admin/marketplace/entitled',
  '/admin/settings/system',
  '/admin/assets/models',
  '/admin/assets/agents',
  '/admin/assets/connectors',
  '/admin/assets/plugins',
  '/admin/assets/applets',
  '/admin/assets/skills',
];

async function mountShell(path: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(
      <ConsoleToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<div data-testid="page-body">page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ConsoleToastProvider>,
    );
  });
  for (let i = 0; i < 30 && !host.querySelector('[data-testid="page-body"]'); i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  return {
    host,
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function contentClassList(host: HTMLElement): DOMTokenList {
  const content = host.querySelector('.os-application__content');
  if (!(content instanceof HTMLElement)) throw new Error('missing content');
  return content.classList;
}

describe('secondary shell layout', () => {
  const mounted: Array<{ unmount: () => void }> = [];

  afterEach(() => {
    for (const view of mounted.splice(0)) view.unmount();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  test('secondary routes drop the shell header and use the designer full-height class', async () => {
    const designer = await mountShell(DESIGNER_PATH);
    mounted.push(designer);
    const designerContent = designer.host.querySelector('.os-application__content');
    if (!(designerContent instanceof HTMLElement)) {
      throw new Error('missing designer content');
    }
    const fullHeightClass = [...designerContent.classList].find((name) =>
      name.startsWith('os-application__content--'),
    );
    expect(fullHeightClass).toBe('os-application__content--canvas');

    for (const path of SECONDARY_PATHS) {
      const view = path === DESIGNER_PATH ? designer : await mountShell(path);
      if (view !== designer) mounted.push(view);
      const classes = contentClassList(view.host);
      expect({
        path,
        context: view.host.querySelectorAll('.os-shell-context').length,
        breadcrumb: view.host.querySelectorAll('.os-breadcrumb').length,
        fullHeight: classes.contains(fullHeightClass ?? ''),
        scroll: classes.contains('os-application__content--scroll'),
        activity: view.host.querySelectorAll('.os-activity-bar').length,
        sidebar: view.host.querySelectorAll('.os-sidebar').length,
        body: view.host.querySelector('[data-testid="page-body"]')?.textContent,
      }).toEqual({
        path,
        context: 0,
        breadcrumb: 0,
        fullHeight: true,
        scroll: true,
        activity: 1,
        sidebar: 1,
        body: 'page',
      });
    }
  });

  test('primary landings keep the shell header and the padded document column', async () => {
    for (const path of PRIMARY_PATHS) {
      const view = await mountShell(path);
      mounted.push(view);
      const classes = contentClassList(view.host);
      expect({
        path,
        context: view.host.querySelectorAll('.os-shell-context').length,
        breadcrumb: view.host.querySelectorAll('.os-breadcrumb').length,
        canvas: classes.contains('os-application__content--canvas'),
        scroll: classes.contains('os-application__content--scroll'),
        activity: view.host.querySelectorAll('.os-activity-bar').length,
        sidebar: view.host.querySelectorAll('.os-sidebar').length,
      }).toEqual({
        path,
        context: 1,
        breadcrumb: 1,
        canvas: false,
        scroll: false,
        activity: 1,
        sidebar: 1,
      });
      if (path === '/admin/assets/applets') {
        const labels = [...view.host.querySelectorAll('.os-sidebar__nav-text')].map((node) => node.textContent);
        expect(labels).toContain('小程序');
        expect(labels).toContain('插件');
        expect(view.host.querySelector('a[href="/admin/assets/applets"]')?.getAttribute('aria-current')).toBe('page');
      }
    }
  });

  test('full-height canvas fills the column and document pages scroll inside it', () => {
    const canvas = ruleBlock(shellCss, '.os-application__content--canvas');
    expect(canvas).toMatch(/display:\s*flex/);
    expect(canvas).toMatch(/flex-direction:\s*column/);
    expect(canvas).toMatch(/padding:\s*0/);
    expect(canvas).toMatch(/min-height:\s*0/);
    expect(canvas).toMatch(/overflow:\s*hidden/);

    const scrollport = ruleBlock(
      shellCss,
      '.os-application__content--canvas.os-application__content--scroll',
    );
    expect(scrollport).toMatch(/overflow:\s*(auto|scroll)/);
    expect(scrollport).not.toMatch(/overflow:\s*hidden/);
    expect(scrollport).toMatch(/padding-top:\s*1rem/);
    expect(scrollport).toMatch(/padding-bottom:\s*0/);

    const page = ruleBlock(
      shellCss,
      '.os-application__content--canvas.os-application__content--scroll .os-keepalive,\n.os-application__content--canvas.os-application__content--scroll .os-keepalive__pane:not([hidden])',
    );
    expect(page).toMatch(/overflow:\s*visible/);
    expect(page).not.toMatch(/overflow:\s*hidden/);

    const designer = ruleBlock(designerCss, '.a3s-flow-designer');
    expect(designer).toMatch(/inset:\s*0/);

    const designerHeader = ruleBlock(
      designerCss,
      '.a3s-flow-designer .a3s-workflow-header',
    );
    expect(designerHeader).toMatch(/background:\s*var\(--color-bg-elevated\)/);
    expect(designerHeader).toMatch(/padding-top:\s*1rem/);
  });
});
