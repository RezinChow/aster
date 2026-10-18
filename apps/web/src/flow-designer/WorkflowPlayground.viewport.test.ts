import { describe, expect, test } from 'bun:test';
import { visibleFlowBounds } from './WorkflowPlayground.viewport';

describe('visibleFlowBounds', () => {
  test('frames every node and ignores a zero measurement', () => {
    expect(
      visibleFlowBounds([
        {
          position: { x: 80, y: 160 },
          measured: { width: 0, height: 0 },
          initialWidth: 240,
          initialHeight: 126,
        },
        {
          position: { x: 800, y: 160 },
          initialWidth: 240,
          initialHeight: 126,
        },
      ]),
    ).toEqual({ x: 80, y: 160, width: 960, height: 126 });
  });

  test('waits while a visible node has no size', () => {
    expect(
      visibleFlowBounds([
        { position: { x: 0, y: 0 }, initialWidth: 240, initialHeight: 126 },
        { position: { x: 400, y: 0 } },
      ]),
    ).toBeUndefined();
  });
});
