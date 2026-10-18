import { useCallback, useEffect, useRef } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/styles/ops-topo.css';
import { Button } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import type { OpsTopology, OpsTopoNodeId } from '@/data/opsTopology';
import { layoutOpsFlow, orientOpsEdge } from '@/data/opsTopologyLayout';
import type { UsageRecord } from '@/data/usageLedger';
import {
  OpsTopoFlowEdge,
  opsEdgeMarker,
  type OpsFlowEdge,
} from '@/components/OpsTopoFlowEdge';
import {
  OpsTopoFlowNode,
  type OpsFlowNode,
} from '@/components/OpsTopoFlowNode';

const nodeTypes = { ops: OpsTopoFlowNode } satisfies NodeTypes;
const edgeTypes = { ops: OpsTopoFlowEdge } satisfies EdgeTypes;

function buildFlowNodes(
  topo: OpsTopology,
  usage: UsageRecord[],
  prev: OpsFlowNode[],
): OpsFlowNode[] {
  const prevPos = new Map(prev.map((n) => [n.id, n.position]));
  return topo.nodes.map((node) => {
    const id = node.id as OpsTopoNodeId;
    return {
      id,
      type: 'ops' as const,
      position: prevPos.get(id) ?? { x: 0, y: 0 },
      data: { topo: node, graph: topo, usage },
      draggable: true,
      selectable: true,
    };
  });
}

function buildFlowEdges(
  topo: OpsTopology,
  nodes: OpsFlowNode[],
): OpsFlowEdge[] {
  const at = new Map(nodes.map((node) => [node.id, node.position]));
  return topo.edges.map((e) => {
    const source = at.get(e.from) ?? { x: 0, y: 0 };
    const target = at.get(e.to) ?? { x: 0, y: 0 };
    const handles = orientOpsEdge(source, target);
    const flowing = e.status === 'healthy' || e.status === 'degraded';
    return {
      id: e.id,
      type: 'ops' as const,
      source: e.from,
      target: e.to,
      sourceHandle: handles.sourceHandle,
      targetHandle: handles.targetHandle,
      data: { label: e.label, status: e.status },
      animated: flowing,
      markerEnd: opsEdgeMarker(e.status),
    };
  });
}

function OpsTopologyCanvas({
  topo,
  usage,
}: {
  topo: OpsTopology;
  usage: UsageRecord[];
}) {
  const { t } = useI18n();
  const seedNodes = layoutOpsFlow(buildFlowNodes(topo, usage, []), []);
  const seedEdges = buildFlowEdges(topo, seedNodes);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<OpsFlowNode>(seedNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<OpsFlowEdge>(seedEdges);
  const { fitView } = useReactFlow();
  const didFit = useRef(false);

  useEffect(() => {
    setNodes((prev) => {
      const built = buildFlowNodes(topo, usage, prev);
      const sameShape =
        prev.length === built.length &&
        prev.every((node) => built.some((next) => next.id === node.id));
      return sameShape ? built : layoutOpsFlow(built, []);
    });
  }, [topo, usage, setNodes]);

  useEffect(() => {
    setEdges(buildFlowEdges(topo, nodes));
  }, [topo, nodes, setEdges]);

  useEffect(() => {
    if (didFit.current || nodes.length === 0) return;
    didFit.current = true;
    const id = window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2, maxZoom: 1.1 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [nodes.length, fitView]);

  const onArrange = useCallback(() => {
    const nextNodes = layoutOpsFlow(buildFlowNodes(topo, usage, []), []);
    setNodes(nextNodes);
    setEdges(buildFlowEdges(topo, nextNodes));
    window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2, maxZoom: 1.1 });
    });
  }, [topo, usage, setNodes, setEdges, fitView]);

  const minimapNodeColor = useCallback((node: OpsFlowNode) => {
    switch (node.data?.topo?.status) {
      case 'healthy':
        return '#2f9e6b';
      case 'degraded':
      case 'fixture':
        return '#c4922a';
      case 'down':
      case 'unwired':
        return '#c45c3e';
      default:
        return '#9aa3ad';
    }
  }, []);

  return (
    <div className="ops-topo__viewport">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 24, y: 24, zoom: 0.85 }}
        minZoom={0.35}
        maxZoom={1.6}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="color-mix(in srgb, var(--color-ink) 12%, transparent)"
        />
        <Controls showInteractive={false} />
        <Panel position="top-right">
          <Button type="button" size="sm" onClick={onArrange}>
            {t('ops.layout')}
          </Button>
        </Panel>
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="color-mix(in srgb, var(--color-bg) 70%, transparent)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

export function OpsTopologyMap({
  topo,
  usage = [],
}: {
  topo: OpsTopology;
  usage?: UsageRecord[];
}) {
  return (
    <div className="ops-topo">
      <ReactFlowProvider>
        <OpsTopologyCanvas topo={topo} usage={usage} />
      </ReactFlowProvider>
    </div>
  );
}
