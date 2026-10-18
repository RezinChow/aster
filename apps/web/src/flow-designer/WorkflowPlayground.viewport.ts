export const ENTRY_FIT_PADDING = 0.2;
export const ENTRY_FIT_DURATION = 280;

type FlowBoundsNode = {
  hidden?: boolean;
  measured?: { width?: number | null; height?: number | null };
  width?: number | null;
  height?: number | null;
  initialWidth?: number | null;
  initialHeight?: number | null;
  position: { x: number; y: number };
  internals?: { positionAbsolute?: { x: number; y: number } };
};

function positiveSize(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** Bounds of every visible node. Missing size waits instead of framing a partial graph. */
export function visibleFlowBounds(
  nodes: Iterable<FlowBoundsNode>,
): { x: number; y: number; width: number; height: number } | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const node of nodes) {
    if (node.hidden) continue;
    const width =
      positiveSize(node.measured?.width) ||
      positiveSize(node.width) ||
      positiveSize(node.initialWidth);
    const height =
      positiveSize(node.measured?.height) ||
      positiveSize(node.height) ||
      positiveSize(node.initialHeight);
    if (width <= 0 || height <= 0) return undefined;
    const position = node.internals?.positionAbsolute ?? node.position;
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
    maxX = Math.max(maxX, position.x + width);
    maxY = Math.max(maxY, position.y + height);
    count += 1;
  }
  if (count === 0) return undefined;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
