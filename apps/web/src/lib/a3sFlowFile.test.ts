import { describe, expect, test } from 'bun:test';
import {
  FLOW_AUTHORING_GAP_X,
  FLOW_AUTHORING_NODE_WIDTH,
  linearFlowSource,
} from './a3sFlowFile';

describe('linearFlowSource', () => {
  test('leaves a clear gap between neighboring cards', () => {
    const document = JSON.parse(
      linearFlowSource('tenant.onboard', [
        { id: 'provision_org', title: '开通组织' },
        { id: 'grant_quota', title: '写入配额' },
      ]),
    ) as {
      workflow: { graph: { nodes: Array<{ position: { x: number } }> } };
    };
    const xs = document.workflow.graph.nodes.map((node) => node.position.x);
    const pitch = FLOW_AUTHORING_NODE_WIDTH + FLOW_AUTHORING_GAP_X;
    for (let index = 1; index < xs.length; index += 1) {
      expect(xs[index] - xs[index - 1]).toBe(pitch);
    }
    expect(pitch - FLOW_AUTHORING_NODE_WIDTH).toBeGreaterThanOrEqual(200);
  });
});
