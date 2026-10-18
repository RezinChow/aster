import type { OpsFlowEdge } from '@/components/OpsTopoFlowEdge';
import type { OpsFlowNode } from '@/components/OpsTopoFlowNode';

const COL_W = 210;
const ROW_H = 132;

/**
 * Fixed lanes so the picture matches the running call structure:
 * management on the first row, Gateway routes on the second,
 * Fleet convergence under that, product surfaces, then shared middleware.
 */
const SLOT: Record<string, { c: number; r: number }> = {
  console: { c: 0, r: 0 },
  cloud: { c: 1, r: 0 },
  api: { c: 2, r: 0 },
  auth: { c: 3, r: 0 },
  billing: { c: 4, r: 0 },

  work: { c: 0, r: 1 },
  gateway: { c: 1, r: 1 },
  runtime: { c: 2, r: 1 },
  registry: { c: 3, r: 1 },

  fleet: { c: 1, r: 2 },

  inference: { c: 1, r: 3 },
  functions: { c: 2, r: 3 },
  cells: { c: 3, r: 3 },
  usage: { c: 4, r: 3 },

  events: { c: 2, r: 4 },
  bus: { c: 3, r: 4 },
  queue: { c: 4, r: 4 },

  middleware: { c: 2, r: 5 },
};

export function layoutOpsFlow(
  nodes: OpsFlowNode[],
  _edges: OpsFlowEdge[],
): OpsFlowNode[] {
  return nodes.map((node, index) => {
    const slot = SLOT[node.id] ?? { c: index % 5, r: 6 };
    return {
      ...node,
      position: { x: 24 + slot.c * COL_W, y: 24 + slot.r * ROW_H },
    };
  });
}

export function orientOpsEdge(
  source: { x: number; y: number },
  target: { x: number; y: number },
): { sourceHandle: string; targetHandle: string } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'out-right', targetHandle: 'in-left' }
      : { sourceHandle: 'out-left', targetHandle: 'in-right' };
  }
  return dy >= 0
    ? { sourceHandle: 'out-bottom', targetHandle: 'in-top' }
    : { sourceHandle: 'out-top', targetHandle: 'in-bottom' };
}
