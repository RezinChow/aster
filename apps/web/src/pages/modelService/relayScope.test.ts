import { describe, expect, test } from 'bun:test';
import { scopedRelaySuppliers } from './relayScope';

describe('scopedRelaySuppliers', () => {
  const suppliers = [
    { id: 'a', name: 'Boyue' },
    { id: 'b', name: 'SiliconFlow' },
  ];

  test('matches a partner name without regard to case', () => {
    expect(scopedRelaySuppliers(suppliers, [' boyue ', 'Boyue']).map((row) => row.id)).toEqual(['a']);
  });

  test('matches none when the partner has no shared name', () => {
    expect(scopedRelaySuppliers(suppliers, ['平台自营', 'Platform'])).toEqual([]);
  });

  test('matches none for blank names', () => {
    expect(scopedRelaySuppliers(suppliers, ['', '  '])).toEqual([]);
  });
});
