/** a3s-flow workflow file kept in each code-repository workflow package. */

export const WORKFLOW_FILE = 'workflow.json';

export function emptyFlowSource(name: string): string {
  return `${JSON.stringify(
    {
      version: '0.7.0',
      kind: 'app',
      app: { name, mode: 'workflow' },
      dependencies: [],
      workflow: { graph: { nodes: [], edges: [] } },
    },
    null,
    2,
  )}\n`;
}

export function flowNodeCount(source: string): number | null {
  try {
    const raw = JSON.parse(source) as {
      workflow?: { graph?: { nodes?: unknown } };
    };
    const nodes = raw.workflow?.graph?.nodes;
    return Array.isArray(nodes) ? nodes.length : null;
  } catch {
    return null;
  }
}

type FlowStep = { id: string; title: string };

/** Slot reserved for one card when a straight workflow is authored. */
export const FLOW_AUTHORING_NODE_WIDTH = 240;
/** Clear space between neighboring cards, wide enough for the edge and its label. */
export const FLOW_AUTHORING_GAP_X = 200;
export const FLOW_AUTHORING_GAP_Y = 120;
const FLOW_AUTHORING_PITCH = FLOW_AUTHORING_NODE_WIDTH + FLOW_AUTHORING_GAP_X;
const FLOW_AUTHORING_ORIGIN = { x: 80, y: 180 } as const;

/** Start → steps → complete. Positions are authoring data, not runtime state. */
export function linearFlowSource(name: string, steps: readonly FlowStep[]): string {
  const start = {
    id: 'start',
    position: { ...FLOW_AUTHORING_ORIGIN },
    data: { type: 'flow.start', title: '开始', workflow_name: name },
  };
  const tasks = steps.map((step, index) => ({
    id: step.id,
    position: {
      x: FLOW_AUTHORING_ORIGIN.x + (index + 1) * FLOW_AUTHORING_PITCH,
      y: FLOW_AUTHORING_ORIGIN.y,
    },
    data: { type: 'flow.step', title: step.title },
  }));
  const complete = {
    id: 'complete',
    position: {
      x: FLOW_AUTHORING_ORIGIN.x + (steps.length + 1) * FLOW_AUTHORING_PITCH,
      y: FLOW_AUTHORING_ORIGIN.y,
    },
    data: { type: 'flow.complete', title: '完成' },
  };
  const chain = [start, ...tasks, complete];
  const edges = chain.slice(0, -1).map((node, index) => {
    const next = chain[index + 1]!;
    return {
      id: `e_${node.id}_${next.id}`,
      source: node.id,
      target: next.id,
      sourceHandle: node.id === 'start' ? 'next' : 'success',
      targetHandle: 'in',
    };
  });
  return `${JSON.stringify(
    {
      version: '0.7.0',
      kind: 'app',
      app: { name, mode: 'workflow' },
      dependencies: [],
      workflow: { graph: { nodes: chain, edges } },
    },
    null,
    2,
  )}\n`;
}
