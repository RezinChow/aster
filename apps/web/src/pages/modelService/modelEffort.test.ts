import { describe, expect, it } from 'bun:test';
import { orderedReasoningEfforts } from './modelEffort';

describe('orderedReasoningEfforts', () => {
  it('keeps known levels in canonical order and drops unknown tokens', () => {
    expect(orderedReasoningEfforts(['max', 'low', 'low', 'turbo'])).toEqual(['low', 'max']);
    expect(orderedReasoningEfforts([])).toEqual([]);
  });
});
