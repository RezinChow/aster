import { memo } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import type { OpsTopoStatus } from '@/data/opsTopology';

export type OpsFlowEdgeData = {
  label: string;
  status: OpsTopoStatus;
};

export type OpsFlowEdge = Edge<OpsFlowEdgeData, 'ops'>;

function markerColor(status: OpsTopoStatus): string {
  switch (status) {
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
}

function OpsTopoEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<OpsFlowEdge>) {
  const status = data?.status ?? 'unknown';
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        d={path}
        fill="none"
        className="react-flow__edge-path ops-topo__edge-path"
        data-status={status}
        markerEnd={markerEnd}
      />
      {data?.label ? (
        <EdgeLabelRenderer>
          <div
            className="ops-topo__edge-label nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const OpsTopoFlowEdge = memo(OpsTopoEdgeView);

export function opsEdgeMarker(status: OpsTopoStatus) {
  return {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: markerColor(status),
  };
}
