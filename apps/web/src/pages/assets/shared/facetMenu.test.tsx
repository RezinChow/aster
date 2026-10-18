import '../../secondaryBack.dom';
import { afterEach, describe, expect, test } from 'bun:test';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FacetSection, visibleFacetOptions, type FacetOption } from './AssetHub';

function options(count: number): FacetOption[] {
  return Array.from({ length: count }, (_, index) => ({
    value: `v${index}`,
    label: `L${index}`,
    count: index,
  }));
}

function optionLabels(host: HTMLElement): string[] {
  return [...host.querySelectorAll('ul button')].map((button) => button.querySelector('span')?.textContent ?? '');
}

describe('facet menu', () => {
  const mounted: Array<{ root: Root; host: HTMLElement }> = [];

  afterEach(() => {
    for (const view of mounted.splice(0)) {
      act(() => view.root.unmount());
      view.host.remove();
    }
    document.body.innerHTML = '';
  });

  test('the drawn rows do not depend on the selected value', () => {
    const rows = options(12);
    expect(visibleFacetOptions(rows, 8, false).map((row) => row.value)).toEqual(
      rows.slice(0, 8).map((row) => row.value),
    );
    expect(visibleFacetOptions(rows, 8, true).map((row) => row.value)).toEqual(rows.map((row) => row.value));
  });

  test('clicking 全部 keeps the same option rows', async () => {
    const rows = options(12);

    function Harness({ initial }: { initial: string }) {
      const [value, setValue] = useState(initial);
      return <FacetSection title="分类" options={rows} value={value} onChange={setValue} />;
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(<Harness initial="v3" />);
    });
    const inside = optionLabels(host);
    expect(inside).toContain('全部');
    expect(inside).toContain('L3');
    expect(inside).not.toContain('L11');

    const all = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('全部'));
    await act(async () => {
      all?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(optionLabels(host)).toEqual(inside);
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain('全部');
  });

  test('a selection past the window stays on screen after 全部', async () => {
    const rows = options(12);

    function Harness() {
      const [value, setValue] = useState('v11');
      return <FacetSection title="分类" options={rows} value={value} onChange={setValue} />;
    }

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    mounted.push({ root, host });
    await act(async () => {
      root.render(<Harness />);
    });
    const open = optionLabels(host);
    expect(open).toContain('L11');

    const all = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes('全部'));
    await act(async () => {
      all?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(optionLabels(host)).toEqual(open);
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toContain('全部');
  });
});
