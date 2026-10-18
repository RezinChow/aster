import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { setLocale } from '@/prefs/store';
import {
  AssetFileBrowser,
  AssetFileView,
  AssetMarkdown,
  assetDirectory,
  assetFileTree,
  assetMarkdownBlocks,
  canPreviewAssetFile,
  isMarkdownPath,
} from '@/pages/assets/shared/AssetDocument';

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

describe('asset document view', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test('readme is prose and does not keep raw html or a dark code plate', async () => {
    setLocale('zh');
    const markdown = [
      '# 标题',
      '',
      '见 [文档](https://example.com/docs) 与 [坏链](javascript:alert(1))。',
      '',
      '<script>alert(1)</script>',
      '',
      '- 一项',
      '',
      '```ts',
      'const n = 1',
      '```',
    ].join('\n');
    const blocks = assetMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'list',
      'code',
    ]);
    const view = await mount(<AssetMarkdown markdown={markdown} />);
    const html = view.host.innerHTML;
    await settle(() => view.host.textContent.includes('标题'));
    expect(view.host.textContent).toContain('标题');
    await settle(() => view.host.textContent.includes('一项'));
    expect(view.host.textContent).toContain('一项');
    await settle(() => view.host.textContent.includes('const n = 1'));
    expect(view.host.textContent).toContain('const n = 1');
    expect(view.host.querySelector('a')?.getAttribute('href')).toBe('https://example.com/docs');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('bg-[#171717]');
    expect(html).not.toContain('MarkdownEditor');
    view.unmount();
  });

  test('the current directory hides nested files until the folder is opened', async () => {
    setLocale('zh');
    const files = [
      { path: 'SKILL.md', size: 32 },
      { path: 'references/guide.md', size: 12 },
      { path: 'README.md', size: 8 },
      { path: 'weights/model-2.safetensors', size: 10 },
      { path: 'weights/model-10.safetensors', size: 10 },
    ];
    const tree = assetFileTree(files);
    expect(tree.map((node) => node.name)).toEqual(['references', 'weights', 'README.md', 'SKILL.md']);
    const references = tree[0];
    if (references?.kind !== 'dir') throw new Error('missing references folder');
    expect(references.children.map((node) => node.name)).toEqual(['guide.md']);
    expect(assetDirectory(files, '').map((entry) => entry.name)).toEqual([
      'references',
      'weights',
      'README.md',
      'SKILL.md',
    ]);
    expect(assetDirectory(files, 'weights').map((entry) => entry.name)).toEqual([
      'model-2.safetensors',
      'model-10.safetensors',
    ]);
    expect(canPreviewAssetFile('README.md', 8)).toBe(true);
    expect(canPreviewAssetFile('model.safetensors', 8)).toBe(false);
    expect(canPreviewAssetFile('tokenizer.model', 8)).toBe(false);
    expect(canPreviewAssetFile('README.md', 256 * 1024 + 1)).toBe(false);

    function Harness() {
      const [selected, setSelected] = useState('');
      return (
        <AssetFileBrowser
          files={[
            { path: 'SKILL.md', size: 32 },
            { path: 'references/guide.md', size: 12 },
          ]}
          rootLabel="acme/skill"
          selected={selected}
          onSelect={setSelected}
          loading={false}
          text={null}
          emptyLabel="该文件无法预览"
        />
      );
    }

    const view = await mount(<Harness />);
    await settle(() => view.host.textContent.includes('references'));
    expect(view.host.textContent).toContain('references');
    await settle(() => view.host.textContent.includes('SKILL.md'));
    expect(view.host.textContent).toContain('SKILL.md');
    await settle(() => view.host.textContent.includes('2 项'));
    expect(view.host.textContent).toContain('2 项');
    expect(view.host.textContent).not.toContain('guide.md');

    const folder = [...view.host.querySelectorAll('button')].find((node) =>
      (node.textContent ?? '').includes('references'),
    );
    if (!(folder instanceof HTMLElement)) throw new Error('missing folder');
    await act(async () => {
      folder.click();
    });
    await settle(() => view.host.textContent.includes('guide.md'));
    expect(view.host.textContent).toContain('guide.md');
    expect(view.host.textContent).not.toContain('references/guide.md');

    const root = [...view.host.querySelectorAll('button')].find((node) => node.textContent === 'acme/skill');
    if (!(root instanceof HTMLElement)) throw new Error('missing root crumb');
    await act(async () => {
      root.click();
    });
    expect(view.host.textContent).not.toContain('guide.md');

    const skill = [...view.host.querySelectorAll('button')].find((node) =>
      (node.textContent ?? '').includes('SKILL.md'),
    );
    if (!(skill instanceof HTMLElement)) throw new Error('missing skill file');
    await act(async () => {
      skill.click();
    });
    await settle(() => view.host.textContent.includes('acme/skill'));
    expect(view.host.textContent).toContain('acme/skill');
    await settle(() => view.host.textContent.includes('SKILL.md'));
    expect(view.host.textContent).toContain('SKILL.md');
    await settle(() => view.host.textContent.includes('32 B'));
    expect(view.host.textContent).toContain('32 B');
    await settle(() => view.host.textContent.includes('该文件无法预览'));
    expect(view.host.textContent).toContain('该文件无法预览');
    expect(view.host.textContent).not.toContain('2 项');
    expect(view.host.textContent).not.toContain('guide.md');
    expect(view.host.querySelector('[data-a3s-office]')).toBeNull();
    expect(view.host.querySelector('[role="treeitem"]')).toBeNull();

    const back = [...view.host.querySelectorAll('button')].find((node) => node.textContent === 'acme/skill');
    if (!(back instanceof HTMLElement)) throw new Error('missing root crumb');
    await act(async () => {
      back.click();
    });
    await settle(() => view.host.textContent.includes('2 项'));
    expect(view.host.textContent).toContain('2 项');
    expect(view.host.textContent).not.toContain('该文件无法预览');
    view.unmount();
  });

  test('json stays source and markdown is the preview path', () => {
    expect(isMarkdownPath('mcp.json')).toBe(false);
    expect(isMarkdownPath('SKILL.md')).toBe(true);
    expect(canPreviewAssetFile('mcp.json', 20)).toBe(true);
  });

  test('a weight file shows a notice and is not rendered as source', async () => {
    setLocale('zh');
    const view = await mount(
      <AssetFileBrowser
        files={[{ path: 'model.safetensors', size: 1900 }]}
        selected="model.safetensors"
        onSelect={() => undefined}
        loading={false}
        text={null}
        emptyLabel="该文件无法在页面中预览，请下载查看"
      />,
    );
    await settle(() => view.host.textContent.includes('该文件无法在页面中预览，请下载查看'));
    expect(view.host.textContent).toContain('该文件无法在页面中预览，请下载查看');
    await settle(() => view.host.textContent.includes('1.9 KB'));
    expect(view.host.textContent).toContain('1.9 KB');
    expect(view.host.querySelector('[data-a3s-office]')).toBeNull();
    expect(view.host.querySelector('table')).toBeNull();
    view.unmount();
  });

  test('json source shows line numbers', async () => {
    setLocale('zh');
    const view = await mount(<AssetFileView chrome={false} path="mcp.json" text={'{\n  "ok": true\n}'} />);
    expect(view.host.textContent).not.toContain('mcp.json');
    await settle(() => view.host.textContent.includes('"ok": true'));
    expect(view.host.textContent).toContain('"ok": true');
    await settle(() => view.host.textContent.includes('1'));
    expect(view.host.textContent).toContain('1');
    expect(view.host.textContent).not.toContain('阅读');
    expect(view.host.querySelector('[data-a3s-office]')).toBeNull();
    view.unmount();
  });
});
