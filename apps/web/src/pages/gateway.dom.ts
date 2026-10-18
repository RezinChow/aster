import './secondaryBack.dom';

const root = globalThis as typeof globalThis & {
  ShadowRoot?: unknown;
  window?: { ShadowRoot?: unknown };
};
if (!root.ShadowRoot && root.window?.ShadowRoot) {
  Object.defineProperty(globalThis, 'ShadowRoot', {
    value: root.window.ShadowRoot,
    configurable: true,
    writable: true,
  });
}
