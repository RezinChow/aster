import './secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { createChannelPartner } from '@/data/channelPartners';
import { createCodePackage } from '@/data/codePackages';
import { createKnowledgeBase } from '@/data/knowledgeBases';
import { WorkflowPlaygroundHeader } from '@/flow-designer/WorkflowPlaygroundChrome';
import { workflowPlaygroundCopy } from '@/flow-designer/WorkflowPlayground.copy';
import { setLocale, type Locale } from '@/prefs/store';
import { ChannelDetailPage } from '@/pages/ChannelDetailPage';
import { CodePackageDetailPage } from '@/pages/codePackages/CodePackageDetailPage';
import { KnowledgeBaseDetailPage } from '@/pages/KnowledgeBaseDetailPage';
import { MarketplaceAddProviderPage } from '@/pages/MarketplaceAddProviderPage';
import { SupplierDetailPage } from '@/pages/SupplierDetailPage';
import { WorkflowPlaygroundExamples } from '@/flow-designer/WorkflowPlaygroundExamples';
import type { WorkflowExampleDefinition } from '@/flow-designer/WorkflowPlayground.examples';

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
    clickBack() {
      const control = [...host.querySelectorAll('a,button')].find((item) =>
        (item.textContent ?? '').includes('←'),
      );
      if (!(control instanceof HTMLElement)) {
        throw new Error('missing back control');
      }
      act(() => {
        control.click();
      });
    },
    unmount() {
      act(() => root.unmount());
      host.remove();
    },
  };
}

const noop = () => undefined;

function header(backHref: string) {
  const copy = workflowPlaygroundCopy.zh;
  return (
    <MemoryRouter>
      <WorkflowPlaygroundHeader
        backHref={backHref}
        copy={copy}
        extensionsOpen={false}
        fileLabel="workflow.json"
        issueCount={0}
        languageHref=""
        locale="zh"
        logoSrc=""
        onExport={noop}
        onOpenDocument={noop}
        onOpenExtensions={noop}
        onReset={noop}
        onRunToggle={noop}
        onValidate={noop}
        onVersionChange={noop}
        running={false}
        saveState="saved"
        showExtensions={false}
        version="1"
        versions={['1']}
        workflowName="租户入驻工作流"
      />
    </MemoryRouter>
  );
}

function expectSharedBack(host: HTMLElement, locale: Locale, target?: string) {
  const controls = [...host.querySelectorAll('a,button')].filter((item) =>
    /^\s*←/.test(item.textContent ?? ''),
  );
  expect(controls).toHaveLength(1);
  const label = (controls[0]?.textContent ?? '').replace(/\s+/g, ' ').trim();
  expect(label).toBe(locale === 'zh' ? '← 返回' : '← Back');
  expect(label).not.toContain(locale === 'zh' ? '返回列表' : 'Back to list');
  if (target) {
    expect(controls[0]?.getAttribute('href')).toBe(target);
  } else {
    expect(controls[0]?.tagName).toBe('BUTTON');
  }
}

describe('secondary page back control', () => {
  const mounted: Array<{ unmount: () => void }> = [];

  afterEach(() => {
    for (const view of mounted.splice(0)) view.unmount();
    setLocale('zh');
  });

  test('product detail shell uses the shared back control in zh and en', async () => {
    for (const locale of ['zh', 'en'] as const) {
      await act(async () => {
        setLocale(locale);
      });
      const view = await mount(
        <MemoryRouter>
          <AdminPageShell title="商品" backTo="/admin/market/applets">
            <p>detail</p>
          </AdminPageShell>
        </MemoryRouter>,
      );
      expectSharedBack(view.host, locale, '/admin/market/applets');
      view.unmount();
    }
  });

  test('channel detail returns to the channel list with the same control', async () => {
    const created = createChannelPartner({
      name: '华北渠道',
      customerId: '',
      legalName: '华北渠道有限公司',
      logoUrl: '',
      website: 'https://partner.example',
      region: '',
      nationwide: false,
      territories: [],
      province: 'bj',
      city: 'bj',
      county: '',
      level: 'authorized',
      industry: '',
      contactName: '林',
      contactEmail: 'lin@partner.example',
      phone: '',
      notes: '',
      status: 'active',
    });
    if (!created.partner) throw new Error(created.issue ?? 'partner');
    const view = await mount(
      <MemoryRouter initialEntries={[`/admin/channels/${created.partner.id}`]}>
        <Routes>
          <Route path="/admin/channels/:id" element={<ChannelDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    mounted.push(view);
    expectSharedBack(view.host, 'zh', '/admin/channels');
  });

  test('workflow designer header leads with the same control', async () => {
    for (const locale of ['zh', 'en'] as const) {
      await act(async () => {
        setLocale(locale);
      });
      const view = await mount(header('/admin/assets/sources/workflows'));
      expectSharedBack(view.host, locale, '/admin/assets/sources/workflows');
      view.unmount();
    }
  });

  test('embedded editors close back to the list with the same control', async () => {
    const kbRecord = createKnowledgeBase({ name: '回退知识库', slug: 'back-kb' });
    const pkgRecord = createCodePackage('applet', {
      name: '回退小程序',
      slug: 'back-applet',
    });
    const closed = { kb: 0, pkg: 0 };
    const kb = await mount(
      <MemoryRouter>
        <KnowledgeBaseDetailPage
          knowledgeBaseId={kbRecord.id}
          onClose={() => { closed.kb += 1; }}
        />
      </MemoryRouter>,
    );
    const pkg = await mount(
      <MemoryRouter>
        <CodePackageDetailPage
          kind="applet"
          packageId={pkgRecord.id}
          onClose={() => { closed.pkg += 1; }}
        />
      </MemoryRouter>,
    );
    mounted.push(kb, pkg);
    for (const view of [kb, pkg]) {
      expectSharedBack(view.host, 'zh');
      view.clickBack();
    }
    expect(closed).toEqual({ kb: 1, pkg: 1 });
  });

  test('flow, supplier, repo, and create shells use the same control', async () => {
    const pages: Array<{ node: ReactNode; target: string; title?: string }> = [
      {
        node: (
          <MemoryRouter initialEntries={['/admin/suppliers/sup_boyue']}>
            <Routes>
              <Route path="/admin/suppliers/:id" element={<SupplierDetailPage />} />
            </Routes>
          </MemoryRouter>
        ),
        target: '/admin/suppliers',
      },
      {
        node: (
          <MemoryRouter>
            <MarketplaceAddProviderPage />
          </MemoryRouter>
        ),
        target: '/admin/marketplace',
      },
    ];
    for (const page of pages) {
      const view = await mount(page.node);
      mounted.push(view);
      expectSharedBack(view.host, 'zh', page.target);
      if (page.title) {
        const heading = view.host.querySelector('h1');
        expect(heading?.textContent ?? '').toContain(page.title);
      }
    }

    const example: WorkflowExampleDefinition = {
      id: 'sample',
      category: 'showcase',
      level: 'starter',
      title: 'Sample',
      description: '',
      outcome: '',
      capabilities: [],
      graph: { nodes: [], edges: [], annotations: [] },
    };
    const library = await mount(
      <MemoryRouter>
        <WorkflowPlaygroundExamples
          examples={[example]}
          homeHref="/"
          languageHref="/en"
          locale="zh"
          logoSrc="/a3s-logo.png"
          version="1"
          versions={['1']}
          exampleHref={() => '/playground?example=sample'}
          versionHref={() => '/'}
          onSelect={noop}
          onVersionChange={noop}
        />
      </MemoryRouter>,
    );
    mounted.push(library);
    expectSharedBack(library.host, 'zh', '/');
  });
});
