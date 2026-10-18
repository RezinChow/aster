import { describe, expect, test } from 'bun:test';
import { summarizeDesiredCatalog } from './desiredCatalog';

describe('desiredCatalog', () => {
  test('summarizes empty and non-empty catalogs without inventing services', () => {
    expect(summarizeDesiredCatalog([])).toBe('desired catalog empty');
    expect(
      summarizeDesiredCatalog([
        {
          service: 'a3s-auth',
          instanceId: 'a1',
          host: '127.0.0.1',
          port: 7641,
        },
        {
          service: 'a3s-api',
          instanceId: 'a2',
          host: '127.0.0.1',
          port: 8080,
        },
      ]),
    ).toBe('desired 2: a3s-auth, a3s-api');
  });
});
