import { describe, expect, test } from 'bun:test';
import { matchesQuery } from './surface';

describe('model service search', () => {
  test('search matches alias and supplier without requiring a full string', () => {
    expect(matchesQuery(' 硅基 ', ['deepseek-v4-flash', '硅基流动', 'openai'])).toBe(true);
    expect(matchesQuery('claude', ['deepseek-v4-flash'])).toBe(false);
    expect(matchesQuery('  ', ['anything'])).toBe(true);
  });
});
