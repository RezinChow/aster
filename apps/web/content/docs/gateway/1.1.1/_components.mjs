import { createElement as h } from 'react';
import { PeleDiagram } from '../../../../scripts/docs_diagrams.mjs';

export function GatewayArchitectureDiagram() {
  return h(PeleDiagram, {
    name: 'gateway-architecture',
    label: 'Gateway 的流量职责与期望状态',
    description: 'standalone ACL 或 Cloud 快照激活本地 Gateway 数据平面。Box 只提供可选的就绪副本端点。',
  });
}
