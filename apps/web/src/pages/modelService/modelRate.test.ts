import { describe, expect, it } from 'bun:test';
import { formatMultiplier, formatUsd, parseModelRate, parsePriceMultiplier } from './modelRate';

describe('parseModelRate', () => {
  it('keeps a blank field unpublished and rejects a cache hit above the input price', () => {
    expect(
      parseModelRate({ input: '0.30', cacheRead: '', cacheWrite: '0.375', output: '1.2' }),
    ).toEqual({
      rate: { input: 0.3, cacheRead: null, cacheWrite: 0.375, output: 1.2 },
      errors: {},
    });

    const above = parseModelRate({ input: '0.30', cacheRead: '0.50', cacheWrite: '', output: '1.2' });
    expect(above.errors.cacheRead).toBe('cacheReadAboveInput');

    const negative = parseModelRate({ input: '-1', cacheRead: '', cacheWrite: '', output: 'x' });
    expect(negative.errors.input).toBe('invalid');
    expect(negative.errors.output).toBe('invalid');
  });
});

describe('parsePriceMultiplier', () => {
  it('keeps a coefficient from 0.01 through 1000', () => {
    expect(parsePriceMultiplier('1')).toBe(1);
    expect(parsePriceMultiplier('1.2500')).toBe(1.25);
    expect(parsePriceMultiplier('')).toBe('invalid');
    expect(parsePriceMultiplier('0')).toBe('invalid');
    expect(parsePriceMultiplier('1001')).toBe('invalid');
  });
});

describe('formatMultiplier', () => {
  it('drops trailing zeros', () => {
    expect(formatMultiplier(1)).toBe('1');
    expect(formatMultiplier(1.5)).toBe('1.5');
  });
});

describe('formatUsd', () => {
  it('drops trailing zeros', () => {
    expect(formatUsd(0.3)).toBe('0.3');
    expect(formatUsd(1.2)).toBe('1.2');
  });
});
