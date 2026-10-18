import { describe, expect, test } from 'bun:test';
import { docsHref, parseDocsSource } from './docsRoute';

describe('docsRoute', () => {
  test('unknown source values stay on the platform contract', () => {
    expect(parseDocsSource(null)).toBe('os');
    expect(parseDocsSource('')).toBe('os');
    expect(parseDocsSource('OS')).toBe('os');
    expect(parseDocsSource('gateway')).toBe('os');
    expect(parseDocsSource('cloud')).toBe('cloud');
    expect(parseDocsSource('work')).toBe('work');
  });

  test('platform links omit the source query', () => {
    expect(docsHref(undefined, 'os')).toBe('/docs');
    expect(docsHref('listMembers', 'os')).toBe('/docs/listMembers');
  });

  test('cloud and work links keep the operation and the source', () => {
    expect(docsHref(undefined, 'cloud')).toBe('/docs?source=cloud');
    expect(docsHref('getProject', 'cloud')).toBe('/docs/getProject?source=cloud');
    expect(docsHref('createChat', 'work')).toBe('/docs/createChat?source=work');
  });
});
