/** bun:test — the console suite's runner (bun test). Typed as vitest-shaped:
 *  the assertions used (describe/test/expect/afterEach/beforeEach/vi/jest-useFakeTimers
 *  style) are structurally compatible; exact typing ships with bun-types. */
declare module 'bun:test' {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void | Promise<void>, timeout?: number) => void;
  export const it: typeof test;
  export const expect: any;
  export const beforeEach: (fn: () => void) => void;
  export const afterEach: (fn: () => void) => void;
  export const beforeAll: (fn: () => void | Promise<void>) => void;
  export const afterAll: (fn: () => void | Promise<void>) => void;
  export const vi: any;
  export const jest: any;
  export const mock: (path: string, factory?: () => unknown) => void;
}
