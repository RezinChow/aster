import { Window } from '../../../../packages/ui/node_modules/happy-dom';

const happy = new Window({ url: 'http://localhost/' });

const assign = (key: string, value: unknown) => {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
};

assign('window', happy);
assign('document', happy.document);
assign('navigator', happy.navigator);
assign('location', happy.location);
assign('history', happy.history);
assign('HTMLElement', happy.HTMLElement);
assign('Element', happy.Element);
assign('Node', happy.Node);
assign('DocumentFragment', happy.DocumentFragment);
assign('ShadowRoot', happy.ShadowRoot);
assign('MutationObserver', happy.MutationObserver);
// Radix Popper / 数据表的可观测布局依赖；无布局环境下的恒空回调即可。
assign('ResizeObserver', class ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
});
assign('localStorage', happy.localStorage);
assign('sessionStorage', happy.sessionStorage);
assign('getComputedStyle', happy.getComputedStyle.bind(happy));
assign('requestAnimationFrame', (cb: FrameRequestCallback) =>
  happy.setTimeout(() => cb(Date.now()), 0),
);
assign('cancelAnimationFrame', (id: number) => happy.clearTimeout(id as unknown as ReturnType<typeof happy.setTimeout>));
assign('IS_REACT_ACT_ENVIRONMENT', true);

for (const key of [
  'Text',
  'HTMLInputElement',
  'HTMLButtonElement',
  'HTMLDivElement',
  'HTMLAnchorElement',
  // Radix Switch 的 effect 引用 HTMLFormElement 全局（挂表单关联），
  // 缺失即 ReferenceError 崩掉整棵 passive-effect 树。
  'HTMLFormElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'HTMLSpanElement',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
] as const) {
  const value = (happy as unknown as Record<string, unknown>)[key];
  if (value) assign(key, value);
}
