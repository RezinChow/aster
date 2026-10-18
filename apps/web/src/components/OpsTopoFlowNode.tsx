import { memo } from 'react';
import { Link } from 'react-router-dom';
import {
  Handle,
  NodeToolbar,
  Position,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Badge, type BadgeTone } from '@a3s-lab/ui';
import { useI18n, type MessageKey } from '@/i18n/useI18n';
import type {
  OpsTopoNode,
  OpsTopoNodeId,
  OpsTopoStatus,
  OpsTopology,
} from '@/data/opsTopology';
import { getTopoNode } from '@/data/opsTopology';
import type { UsageRecord } from '@/data/usageLedger';

export type OpsFlowNodeData = {
  topo: OpsTopoNode;
  graph: OpsTopology;
  usage: UsageRecord[];
};

export type OpsFlowNode = Node<OpsFlowNodeData, 'ops'>;

function healthTone(status: OpsTopoStatus): BadgeTone {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'degraded':
    case 'fixture':
      return 'warn';
    case 'down':
    case 'unwired':
      return 'danger';
    default:
      return 'neutral';
  }
}

function statusLabelKey(status: OpsTopoStatus): MessageKey {
  switch (status) {
    case 'healthy':
      return 'ops.status.healthy';
    case 'degraded':
      return 'ops.status.degraded';
    case 'down':
      return 'ops.status.down';
    case 'unwired':
      return 'ops.status.unwired';
    case 'fixture':
      return 'ops.status.fixture';
    default:
      return 'ops.status.unknown';
  }
}

function OpsTopoNodeView({ data, selected }: NodeProps<OpsFlowNode>) {
  const { t } = useI18n();
  if (!data?.topo) {
    return (
      <div className="ops-topo__node">
        <div className="text-xs text-ink-muted">—</div>
      </div>
    );
  }
  const node = data.topo;
  const inbound = data.graph.edges.filter((e) => e.to === node.id);
  const outbound = data.graph.edges.filter((e) => e.from === node.id);
  const usagePreview =
    node.id === 'runtime' ? (data.usage ?? []).slice(0, 5) : [];

  return (
    <>
      {(['left', 'right', 'top', 'bottom'] as const).map((side) => {
        const position =
          side === 'left'
            ? Position.Left
            : side === 'right'
              ? Position.Right
              : side === 'top'
                ? Position.Top
                : Position.Bottom;
        return (
          <span key={side}>
            <Handle
              type="target"
              id={`in-${side}`}
              position={position}
              className="ops-topo__handle"
              isConnectable={false}
            />
            <Handle
              type="source"
              id={`out-${side}`}
              position={position}
              className="ops-topo__handle"
              isConnectable={false}
            />
          </span>
        );
      })}

      <div
        className="ops-topo__node"
        data-selected={selected ? 'true' : undefined}
        data-status={node.status}
      >
        <div className="text-xs text-ink-faint">
          {node.roleKey
            ? t(node.roleKey as MessageKey)
            : t(`ops.topo.plane.${node.plane}` as MessageKey)}
        </div>
        <div className="mt-1 truncate text-sm font-medium text-ink">
          {t(node.titleKey as MessageKey)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={healthTone(node.status)}>
            {t(statusLabelKey(node.status))}
          </Badge>
          {node.latencyMs != null ? (
            <span className="font-mono text-[10px] text-ink-faint">
              {node.latencyMs}ms
            </span>
          ) : null}
        </div>
      </div>

      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        offset={12}
        className="nopan nodrag"
      >
        <div className="ops-topo__popover" role="dialog">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs text-ink-faint">
                {t('ops.topo.inspect')}
              </div>
              <div className="mt-0.5 text-sm font-medium text-ink">
                {t(node.titleKey as MessageKey)}
              </div>
            </div>
            <Badge tone={healthTone(node.status)}>
              {t(statusLabelKey(node.status))}
            </Badge>
          </div>

          <p className="mt-2 break-words text-xs text-ink-muted">{node.detail}</p>
          {node.latencyMs != null ? (
            <p className="mt-1 text-[11px] text-ink-faint">
              {t('ops.latency')}: {node.latencyMs}ms
            </p>
          ) : null}

          {node.metrics.length > 0 ? (
            <dl className="mt-2 grid grid-cols-2 gap-1.5">
              {node.metrics.map((m) => (
                <div key={m.label}>
                  <dt className="text-[10px] text-ink-faint">{m.label}</dt>
                  <dd className="font-mono text-xs text-ink">{m.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-medium text-ink-faint">
                {t('ops.topo.inbound')}
              </div>
              {inbound.length === 0 ? (
                <p className="mt-0.5 text-[11px] text-ink-muted">—</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {inbound.map((e) => {
                    const src = getTopoNode(data.graph, e.from as OpsTopoNodeId);
                    return (
                      <li key={e.id} className="text-[11px] text-ink-muted">
                        {src
                          ? t(src.titleKey as MessageKey)
                          : e.from}{' '}
                        <span className="font-mono text-ink-faint">{e.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div>
              <div className="text-[10px] font-medium text-ink-faint">
                {t('ops.topo.outbound')}
              </div>
              {outbound.length === 0 ? (
                <p className="mt-0.5 text-[11px] text-ink-muted">—</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {outbound.map((e) => {
                    const dst = getTopoNode(data.graph, e.to as OpsTopoNodeId);
                    return (
                      <li key={e.id} className="text-[11px] text-ink-muted">
                        <span className="font-mono text-ink-faint">{e.label}</span>{' '}
                        {dst ? t(dst.titleKey as MessageKey) : e.to}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {usagePreview.length > 0 ? (
            <div className="mt-3 border-t border-[color:var(--color-hairline)] pt-2">
              <div className="text-[10px] font-medium text-ink-faint">
                {t('ops.section.usage')}
              </div>
              <ul className="mt-1 space-y-0.5">
                {usagePreview.map((row) => (
                  <li
                    key={row.id}
                    className="flex justify-between gap-2 font-mono text-[10px] text-ink-muted"
                  >
                    <span className="truncate">{row.sku}</span>
                    <span>{row.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {node.href && node.href !== '/topology' ? (
            <Link
              to={node.href}
              className="mt-3 inline-block text-xs font-medium text-ink hover:opacity-80"
              onClick={(ev) => ev.stopPropagation()}
            >
              {t('ops.open')} →
            </Link>
          ) : null}
        </div>
      </NodeToolbar>
    </>
  );
}

export const OpsTopoFlowNode = memo(OpsTopoNodeView);
