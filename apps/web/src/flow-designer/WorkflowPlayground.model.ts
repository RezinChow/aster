import {
  A3S_FLOW_TESTED_WORKFLOW_DSL_VERSION,
  a3sFlowDagNodeRegistry,
  compileA3sFlowWorkflowDag,
  compileA3sFlowWorkflowDagForPublication,
  createA3sFlowDagNode,
  getA3sFlowCoreNode,
  isA3sFlowCorePortAvailable,
  localizeA3sFlowDagManifest,
  mergeA3sFlowDagNodeConfiguration,
  parseA3sFlowWorkflowDslJson,
  selectA3sFlowDagNodeConfiguration,
  validateA3sFlowDagNodeConfiguration,
  type A3sFlowDagNodeCatalog,
  type A3sFlowDagNodeRegistry,
  type A3sFlowWorkflowDag,
  type A3sFlowWorkflowDagEdge,
  type A3sFlowWorkflowDagNode,
  type A3sFlowWorkflowDsl,
} from '@a3s-lab/flow-ui';
import type { Edge, Node, XYPosition } from '@xyflow/react';
import { designerFieldViolations, designerRegistry } from './designerFields';
import type { FlowWebsiteLocale } from './flow-node-catalog';

export type PlaygroundNodeData = {
  dagNode: A3sFlowWorkflowDagNode;
  locale: FlowWebsiteLocale;
  internal: boolean;
  container: boolean;
  runtimeStatus?: 'idle' | 'running' | 'success' | 'waiting' | 'error';
  onRun?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
} & Record<string, unknown>;

export type PlaygroundNode = Node<PlaygroundNodeData, 'flowNode'>;

/** Authoring fields such as title live beside the typed `type` key. */
export function dagRecord(
  data: A3sFlowWorkflowDagNode['data'],
): Record<string, unknown> {
  return data as unknown as Record<string, unknown>;
}

export type PlaygroundEdgeRouting = 'curve' | 'orthogonal';
export type PlaygroundEdgeColor = 'blue' | 'teal' | 'violet' | 'amber';

export const PLAYGROUND_EDGE_COLORS: Readonly<
  Record<PlaygroundEdgeColor, { line: string; active: string }>
> = {
  blue: { line: '#6886c5', active: '#155eef' },
  teal: { line: '#4a9b92', active: '#087a6f' },
  violet: { line: '#8a78c5', active: '#6e4cc7' },
  amber: { line: '#c18b40', active: '#925a10' },
};

export type PlaygroundAnnotationKind = 'note' | 'comment';

export type PlaygroundAnnotationData = {
  kind: PlaygroundAnnotationKind;
  text: string;
  label?: string;
  placeholder?: string;
  deleteLabel?: string;
  onTextChange?: (id: string, text: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onDelete?: (id: string) => void;
} & Record<string, unknown>;

export type PlaygroundAnnotationNode = Node<
  PlaygroundAnnotationData,
  'annotation'
>;

export type PlaygroundCanvasNode = PlaygroundNode | PlaygroundAnnotationNode;

/** A source handle and the canvas point where a new node should be placed. */
export type PlaygroundPendingConnection = {
  source: string;
  sourceHandle: string;
  position: XYPosition;
};

export type PlaygroundEdgeData = {
  /**
   * Optional author-facing label. This is deliberately separate from the
   * source port contract so renaming a connection can never change runtime
   * routing.
   */
  labelOverride?: string;
  routing?: PlaygroundEdgeRouting;
  sourcePortLabel?: string;
  insertLabel?: string;
  onInsert?: (edgeId: string, position: XYPosition) => void;
  editLabel?: string;
  labelPlaceholder?: string;
  editingLabel?: boolean;
  onSelect?: (edgeId: string) => void;
  onEditLabel?: (edgeId: string) => void;
  onCommitLabel?: (edgeId: string, value: string) => void;
  onCancelLabel?: (edgeId: string) => void;
} & Record<string, unknown>;

export type PlaygroundEdge = Edge<PlaygroundEdgeData, 'workflow'>;

export const PLAYGROUND_EDGE_LABEL_MAX_LENGTH = 80;

/** Keeps persisted labels single-line, bounded, and empty-safe. */
export function normalizePlaygroundEdgeLabel(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized) return undefined;
  return normalized.slice(0, PLAYGROUND_EDGE_LABEL_MAX_LENGTH);
}

/** Resolves the visible label without allowing presentation text to replace a port ID. */
export function resolvePlaygroundEdgeDisplayLabel(
  edge: Pick<PlaygroundEdge, 'data'>,
  sourcePortLabel?: string,
): string | undefined {
  return (
    normalizePlaygroundEdgeLabel(edge.data?.labelOverride) ?? sourcePortLabel
  );
}

export type PlaygroundGraphState = {
  nodes: PlaygroundNode[];
  edges: PlaygroundEdge[];
  annotations: PlaygroundAnnotationNode[];
};

export type ConnectionRejection =
  | 'missing_endpoint'
  | 'missing_handle'
  | 'missing_node'
  | 'unknown_port'
  | 'unavailable_port'
  | 'incompatible_port'
  | 'cross_scope'
  | 'self_edge'
  | 'duplicate_edge'
  | 'occupied_input'
  | 'cycle';

export type ConnectionValidation =
  { ok: true } | { ok: false; reason: ConnectionRejection };

type CompleteConnection = {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
};

type ConnectionCandidate = {
  source: string | null;
  sourceHandle?: string | null;
  target: string | null;
  targetHandle?: string | null;
};

export type PlaygroundConfigurationIssue = {
  nodeId: string;
  nodeType: string;
  path: string;
  code: string;
  message: string;
};

type CachedConfigurationIssue = Omit<
  PlaygroundConfigurationIssue,
  'nodeId' | 'nodeType'
>;

const configurationValidationCache = new WeakMap<
  object,
  WeakMap<object, Map<string, readonly CachedConfigurationIssue[]>>
>();
const semanticDataIdentities = new WeakMap<object, number>();
let nextSemanticDataIdentity = 1;

function semanticDataIdentity(value: object): number {
  const cached = semanticDataIdentities.get(value);
  if (cached) return cached;
  const identity = nextSemanticDataIdentity++;
  semanticDataIdentities.set(value, identity);
  return identity;
}

export function playgroundGraphSemanticKey(
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
): string {
  const nodeKey = nodes
    .map(
      (node) =>
        `${node.id}\u0001${node.parentId ?? ''}\u0001${semanticDataIdentity(node.data.dagNode.data)}`,
    )
    .join('\u0002');
  const edgeKey = edges
    .map(
      (edge) =>
        `${edge.id}\u0001${edge.source}\u0001${edge.sourceHandle ?? ''}\u0001${edge.target}\u0001${edge.targetHandle ?? ''}`,
    )
    .join('\u0002');
  return `${nodes.length}:${nodeKey}\u0003${edges.length}:${edgeKey}`;
}

const NORMAL_NODE_WIDTH = 240;
const NORMAL_NODE_HEIGHT = 126;
const CONTAINER_NODE_WIDTH = 600;
const CONTAINER_NODE_HEIGHT = 360;

function sanitizeId(value: string): string {
  return value.replace(/^flow\./u, '').replace(/[^a-z0-9]+/giu, '_');
}

function nextNodeId(type: string, nodes: readonly PlaygroundNode[]): string {
  const base = sanitizeId(type);
  const ids = new Set(nodes.map(({ id }) => id));
  let index = 1;
  while (ids.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

export function createPlaygroundNode(
  id: string,
  type: string,
  position: XYPosition,
  locale: FlowWebsiteLocale,
  options: {
    configuration?: Parameters<typeof createA3sFlowDagNode>[2];
    parentId?: string;
    registry?: A3sFlowDagNodeRegistry;
    selected?: boolean;
  } = {},
): PlaygroundNode {
  const registry = options.registry ?? a3sFlowDagNodeRegistry;
  const manifest = registry.require(type);
  const localized = localizeA3sFlowDagManifest(manifest, locale);
  const configuration = {
    title: localized.display_name,
    ...(options.configuration ?? {}),
  };
  const dagNode = options.parentId
    ? createA3sFlowDagNode(id, manifest, configuration, {
        parentId: options.parentId,
        position: { x: position.x, y: position.y },
      })
    : createA3sFlowDagNode(id, manifest, configuration, {
        position: { x: position.x, y: position.y },
      });
  const container = manifest.role === 'container';
  const initialWidth = container ? CONTAINER_NODE_WIDTH : NORMAL_NODE_WIDTH;
  const initialHeight = container ? CONTAINER_NODE_HEIGHT : NORMAL_NODE_HEIGHT;

  return {
    id,
    type: 'flowNode',
    position,
    initialWidth,
    initialHeight,
    parentId: options.parentId,
    extent: options.parentId ? 'parent' : undefined,
    expandParent: Boolean(options.parentId),
    selected: options.selected,
    data: {
      dagNode,
      locale,
      internal: Boolean(manifest.internal),
      container,
    },
    style: container
      ? { width: CONTAINER_NODE_WIDTH, height: CONTAINER_NODE_HEIGHT }
      : { width: NORMAL_NODE_WIDTH },
    ariaLabel: `${localized.display_name} · ${id}`,
    focusable: true,
  };
}

function edgeId(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
): string {
  return `edge_${sanitizeId(source)}_${sanitizeId(sourceHandle)}_${sanitizeId(target)}_${sanitizeId(targetHandle)}`;
}

export function createPlaygroundEdge(
  connection: CompleteConnection,
  nodes: readonly PlaygroundNode[],
  locale: FlowWebsiteLocale,
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
  options: { labelOverride?: string } = {},
): PlaygroundEdge {
  const sourcePortLabel = resolvePlaygroundEdgeSourceLabel(
    connection,
    nodes,
    locale,
    registry,
  );
  const labelOverride = normalizePlaygroundEdgeLabel(options.labelOverride);
  const displayLabel = resolvePlaygroundEdgeDisplayLabel(
    { data: { labelOverride } },
    sourcePortLabel,
  );

  return {
    id: edgeId(
      connection.source,
      connection.sourceHandle,
      connection.target,
      connection.targetHandle,
    ),
    source: connection.source,
    sourceHandle: connection.sourceHandle,
    target: connection.target,
    targetHandle: connection.targetHandle,
    type: 'workflow',
    label: displayLabel,
    data: { sourcePortLabel, ...(labelOverride ? { labelOverride } : {}) },
    ariaLabel: playgroundEdgeAriaLabel(
      connection.source,
      connection.target,
      displayLabel,
    ),
  };
}

export function playgroundEdgeAriaLabel(
  source: string,
  target: string,
  sourcePortLabel?: string,
): string {
  return `${source}${sourcePortLabel ? ` ${sourcePortLabel}` : ''} to ${target}`;
}

export function resolvePlaygroundEdgeSourceLabel(
  connection: Pick<PlaygroundEdge, 'source' | 'sourceHandle'>,
  nodes: readonly PlaygroundNode[],
  locale: FlowWebsiteLocale,
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
  nodeById?: ReadonlyMap<string, PlaygroundNode>,
): string | undefined {
  const sourceNode =
    nodeById?.get(connection.source) ??
    nodes.find(({ id }) => id === connection.source);
  const sourceManifest = sourceNode
    ? localizeA3sFlowDagManifest(
        registry.require(sourceNode.data.dagNode.data.type),
        locale,
      )
    : undefined;
  const sourcePort = sourceManifest?.ports.outputs.find(
    ({ id }) => id === connection.sourceHandle,
  );
  if (!sourceNode || !sourceManifest || !sourcePort) return undefined;

  if (sourceNode.data.dagNode.data.type === 'flow.condition') {
    const field =
      connection.sourceHandle === 'matched'
        ? 'matched_label'
        : connection.sourceHandle === 'otherwise'
          ? 'otherwise_label'
          : undefined;
    const configured = field
      ? dagRecord(sourceNode.data.dagNode.data)[field]
      : undefined;
    if (typeof configured === 'string' && configured.trim().length > 0) {
      return configured.trim();
    }
  }

  const coreDefinition = getA3sFlowCoreNode(sourceNode.data.dagNode.data.type);
  const controlOutputCount = sourceManifest.ports.outputs.filter((port) => {
    if (port.kind !== 'control') return false;
    const corePort = coreDefinition?.ports.outputs.find(
      ({ id }) => id === port.id,
    );
    return (
      !corePort ||
      isA3sFlowCorePortAvailable(corePort, sourceNode.data.dagNode.data)
    );
  }).length;
  const showLabel =
    sourcePort.kind === 'data' ||
    (sourcePort.kind === 'control' && controlOutputCount > 1);
  return showLabel ? sourcePort.label : undefined;
}

export function createNodeAddition(
  type: string,
  position: XYPosition,
  locale: FlowWebsiteLocale,
  existingNodes: readonly PlaygroundNode[],
  parentId?: string,
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
): PlaygroundGraphState {
  const manifest = registry.require(type);
  const nodeId = nextNodeId(type, existingNodes);
  if (!manifest.container) {
    return {
      nodes: [
        createPlaygroundNode(nodeId, type, position, locale, {
          parentId,
          registry,
          selected: true,
        }),
      ],
      edges: [],
      annotations: [],
    };
  }

  const startType = manifest.container.startNodeType;
  const startId = `${nodeId}_start`;
  const taskId = `${nodeId}_task`;
  const container = createPlaygroundNode(nodeId, type, position, locale, {
    configuration: { start_node_id: startId },
    parentId,
    registry,
    selected: true,
  });
  const start = createPlaygroundNode(
    startId,
    startType,
    { x: 36, y: 150 },
    locale,
    {
      parentId: nodeId,
      registry,
    },
  );
  const task = createPlaygroundNode(
    taskId,
    'flow.step',
    { x: 324, y: 150 },
    locale,
    { parentId: nodeId, registry },
  );
  const nodes = [container, start, task];
  const edges = [
    createPlaygroundEdge(
      {
        source: startId,
        sourceHandle: 'next',
        target: taskId,
        targetHandle: 'in',
      },
      nodes,
      locale,
      registry,
    ),
  ];
  return { nodes, edges, annotations: [] };
}

function nodeScope(node: PlaygroundNode): string | null {
  return node.parentId ?? null;
}

function wouldCreateCycle(
  source: string,
  target: string,
  scope: string | null,
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
): boolean {
  const inScope = new Set(
    nodes.filter((node) => nodeScope(node) === scope).map(({ id }) => id),
  );
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!inScope.has(edge.source) || !inScope.has(edge.target)) continue;
    const targets = outgoing.get(edge.source) ?? [];
    targets.push(edge.target);
    outgoing.set(edge.source, targets);
  }
  const pending = [target];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === source) return true;
    visited.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }
  return false;
}

export function validatePlaygroundConnection(
  connection: ConnectionCandidate,
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
): ConnectionValidation {
  if (!connection.source || !connection.target) {
    return { ok: false, reason: 'missing_endpoint' };
  }
  if (!connection.sourceHandle || !connection.targetHandle) {
    return { ok: false, reason: 'missing_handle' };
  }
  if (connection.source === connection.target) {
    return { ok: false, reason: 'self_edge' };
  }

  const source = nodes.find(({ id }) => id === connection.source);
  const target = nodes.find(({ id }) => id === connection.target);
  if (!source || !target) return { ok: false, reason: 'missing_node' };
  if (nodeScope(source) !== nodeScope(target)) {
    return { ok: false, reason: 'cross_scope' };
  }

  const sourceManifest = registry.require(source.data.dagNode.data.type);
  const targetManifest = registry.require(target.data.dagNode.data.type);
  const sourcePort = sourceManifest.ports.outputs.find(
    ({ id }) => id === connection.sourceHandle,
  );
  const targetPort = targetManifest.ports.inputs.find(
    ({ id }) => id === connection.targetHandle,
  );
  if (!sourcePort || !targetPort) {
    return { ok: false, reason: 'unknown_port' };
  }

  const coreDefinition = getA3sFlowCoreNode(sourceManifest.type);
  const corePort = coreDefinition?.ports.outputs.find(
    ({ id }) => id === sourcePort.id,
  );
  if (
    corePort &&
    !isA3sFlowCorePortAvailable(corePort, source.data.dagNode.data)
  ) {
    return { ok: false, reason: 'unavailable_port' };
  }

  const compatible =
    sourcePort.kind === targetPort.kind &&
    sourcePort.types.some((type) => targetPort.types.includes(type));
  if (!compatible) return { ok: false, reason: 'incompatible_port' };

  const duplicate = edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.sourceHandle === connection.sourceHandle &&
      edge.target === connection.target &&
      edge.targetHandle === connection.targetHandle,
  );
  if (duplicate) return { ok: false, reason: 'duplicate_edge' };
  if (
    edges.some(
      (edge) =>
        edge.target === connection.target &&
        edge.targetHandle === connection.targetHandle,
    )
  ) {
    return { ok: false, reason: 'occupied_input' };
  }
  if (
    wouldCreateCycle(
      connection.source,
      connection.target,
      nodeScope(source),
      nodes,
      edges,
    )
  ) {
    return { ok: false, reason: 'cycle' };
  }
  return { ok: true };
}

export function buildPlaygroundGraph(
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
): A3sFlowWorkflowDag {
  const graphNodes = nodes.map((node) => {
    const dagNode = structuredClone(node.data.dagNode);
    dagNode.position = structuredClone(node.position);
    return dagNode;
  });
  const graphEdges: A3sFlowWorkflowDagEdge[] = edges.map((edge) => {
    const labelOverride = normalizePlaygroundEdgeLabel(
      edge.data?.labelOverride,
    );
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
      ...(edge.targetHandle ? { targetHandle: edge.targetHandle } : {}),
      ...(labelOverride ? { label: labelOverride } : {}),
    };
  });
  return { nodes: graphNodes, edges: graphEdges };
}

export function buildPlaygroundDocument(
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
): A3sFlowWorkflowDsl {
  return {
    version: A3S_FLOW_TESTED_WORKFLOW_DSL_VERSION,
    kind: 'app',
    app: { name: 'playground.workflow', mode: 'workflow' },
    dependencies: [],
    workflow: { graph: buildPlaygroundGraph(nodes, edges) },
  };
}

export function compilePlaygroundGraph(
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
  catalog?: Pick<A3sFlowDagNodeCatalog, 'registry' | 'capabilities'>,
) {
  const graph = buildPlaygroundGraph(nodes, edges);
  return catalog
    ? compileA3sFlowWorkflowDagForPublication(
        graph,
        catalog.registry,
        catalog.capabilities,
      )
    : compileA3sFlowWorkflowDag(graph);
}

export function validatePlaygroundConfigurations(
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
): PlaygroundConfigurationIssue[] {
  const connectedOutputsByNode = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.sourceHandle) continue;
    const outputs = connectedOutputsByNode.get(edge.source);
    if (outputs) outputs.push(edge.sourceHandle);
    else connectedOutputsByNode.set(edge.source, [edge.sourceHandle]);
  }

  return nodes.flatMap((node) => {
    const nodeType = node.data.dagNode.data.type;
    const manifest = registry.require(nodeType);
    const connectedOutputPortIds = connectedOutputsByNode.get(node.id) ?? [];
    const connectionSignature = [...new Set(connectedOutputPortIds)]
      .sort()
      .join('\u0000');
    const dataIdentity = node.data.dagNode.data;
    let byManifest = configurationValidationCache.get(dataIdentity);
    if (!byManifest) {
      byManifest = new WeakMap();
      configurationValidationCache.set(dataIdentity, byManifest);
    }
    let byConnection = byManifest.get(manifest);
    if (!byConnection) {
      byConnection = new Map();
      byManifest.set(manifest, byConnection);
    }
    let cached = byConnection.get(connectionSignature);
    if (!cached) {
      const value = selectA3sFlowDagNodeConfiguration(
        node.data.dagNode,
        manifest,
      );
      const result = validateA3sFlowDagNodeConfiguration(manifest, value, {
        connectedOutputPortIds,
      });
      const reported = new Set(result.errors.map((error) => error.path));
      const fieldErrors = designerFieldViolations(
        manifest,
        value as Record<string, unknown>,
      ).filter((error) => !reported.has(error.path));
      cached = [...result.errors, ...fieldErrors].map(({ path, code, message }) => ({
        path,
        code,
        message,
      }));
      byConnection.set(connectionSignature, cached);
    }
    return cached.map((error) => ({
      nodeId: node.id,
      nodeType,
      ...error,
    }));
  });
}

export function readPlaygroundField(
  node: PlaygroundNode,
  fieldName: string,
  registry: A3sFlowDagNodeRegistry = designerRegistry(node.data.locale),
): unknown {
  const manifest = registry.require(node.data.dagNode.data.type);
  return selectA3sFlowDagNodeConfiguration(node.data.dagNode, manifest)[fieldName];
}

export function assignPlaygroundField(
  node: PlaygroundNode,
  fieldName: string,
  value: unknown,
  registry: A3sFlowDagNodeRegistry = designerRegistry(node.data.locale),
): PlaygroundNode {
  const manifest = registry.require(node.data.dagNode.data.type);
  const configuration = selectA3sFlowDagNodeConfiguration(
    node.data.dagNode,
    manifest,
  );
  const dagNode = mergeA3sFlowDagNodeConfiguration(node.data.dagNode, manifest, {
    ...configuration,
    [fieldName]: value as (typeof configuration)[string],
  });
  return {
    ...node,
    data: { ...node.data, dagNode },
  };
}

export function collectDeletionIds(
  nodes: readonly PlaygroundNode[],
  selectedIds: ReadonlySet<string>,
): Set<string> {
  const deletion = new Set(selectedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (
        node.parentId &&
        deletion.has(node.parentId) &&
        !deletion.has(node.id)
      ) {
        deletion.add(node.id);
        changed = true;
      }
    }
  }
  return deletion;
}

/** Node types that end a control path; their unconnected outputs are fine. */
const TERMINAL_NODE_TYPES: ReadonlySet<string> = new Set([
  'flow.complete',
  'flow.fail',
  'flow.cancel',
  'flow.timeout',
  'flow.continue-as-new',
]);

/** Region nodes whose `start_node_id` must reference an existing node. */
const REGION_REFERENCE_NODE_TYPES: ReadonlySet<string> = new Set([
  'iteration',
  'loop',
]);

function unknownStepReference(
  value: unknown,
  knownReferences: ReadonlySet<string>,
  visit: (path: string) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) unknownStepReference(item, knownReferences, visit);
    return;
  }
  if (
    isRecordValue(value) &&
    value.op === 'field' &&
    typeof value.path === 'string'
  ) {
    const segments = value.path.split('.');
    if (
      segments[0] === 'steps' &&
      segments.length > 1 &&
      !knownReferences.has(segments[1]!)
    ) {
      visit(segments[1]);
    }
    return;
  }
  if (isRecordValue(value)) {
    for (const item of Object.values(value)) {
      unknownStepReference(item, knownReferences, visit);
    }
  }
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whole-graph checks the per-node validator cannot see: start multiplicity,
 * reachability, dead ends, dangling region references, and expression
 * `steps.*` references that point at no existing node or step name.
 */
export function validatePlaygroundGraphStructure(
  nodes: readonly PlaygroundNode[],
  edges: readonly PlaygroundEdge[],
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
): PlaygroundConfigurationIssue[] {
  const issues: PlaygroundConfigurationIssue[] = [];
  const topLevel = nodes.filter((node) => !node.parentId);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const stepNames = new Set(
    nodes
      .map((node) => dagRecord(node.data.dagNode.data).step_name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0),
  );
  const knownReferences = new Set([...nodeIds, ...stepNames]);
  const typeOf = (node: PlaygroundNode): string =>
    node.data.dagNode.data.type;

  const starts = topLevel.filter(
    (node) => typeOf(node) === 'flow.start',
  );
  for (const extra of starts.slice(1)) {
    issues.push({
      nodeId: extra.id,
      nodeType: 'flow.start',
      path: '',
      code: 'graph.multiple_starts',
      message: 'only one start node is allowed',
    });
  }
  if (starts.length === 0 && topLevel.length > 0) {
    issues.push({
      nodeId: '',
      nodeType: '',
      path: '',
      code: 'graph.no_start',
      message: 'the workflow needs exactly one start node',
    });
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const targets = adjacency.get(edge.source);
    if (targets) targets.push(edge.target);
    else adjacency.set(edge.source, [edge.target]);
  }
  const visited = new Set(starts.map((node) => node.id));
  for (let index = 0; index < topLevel.length; index += 1) {
    const current = topLevel[index]!;
    if (!visited.has(current.id)) continue;
    for (const target of adjacency.get(current.id) ?? []) {
      if (!visited.has(target)) visited.add(target);
    }
  }
  for (const node of topLevel) {
    if (visited.has(node.id)) continue;
    issues.push({
      nodeId: node.id,
      nodeType: typeOf(node),
      path: '',
      code: 'graph.unreachable',
      message: 'this node cannot be reached from the start node',
    });
  }

  for (const node of topLevel) {
    const type = typeOf(node);
    if (
      type === 'flow.start' ||
      TERMINAL_NODE_TYPES.has(type) ||
      registry.require(type).role === 'container'
    ) {
      continue;
    }
    const controlOutputs = registry
      .require(type)
      .ports.outputs.filter((port) => port.kind === 'control');
    if (controlOutputs.length === 0) continue;
    const connected = new Set(
      edges
        .filter((edge) => edge.source === node.id && edge.sourceHandle)
        .map((edge) => edge.sourceHandle as string),
    );
    if (controlOutputs.every((port) => !connected.has(port.id))) {
      issues.push({
        nodeId: node.id,
        nodeType: type,
        path: '',
        code: 'graph.dead_end',
        message: 'this node has no outgoing connection',
      });
    }
  }

  for (const node of nodes) {
    const type = typeOf(node);
    if (!REGION_REFERENCE_NODE_TYPES.has(type)) continue;
    const value = selectA3sFlowDagNodeConfiguration(
      node.data.dagNode,
      registry.require(type),
    ) as Record<string, unknown>;
    const startRef = value.start_node_id;
    if (
      typeof startRef === 'string' &&
      startRef.trim().length > 0 &&
      !nodeIds.has(startRef.trim())
    ) {
      issues.push({
        nodeId: node.id,
        nodeType: type,
        path: 'start_node_id',
        code: 'graph.unknown_start_node',
        message: 'start node id does not match any node in the graph',
      });
    }
  }

  for (const node of nodes) {
    const type = typeOf(node);
    const value = selectA3sFlowDagNodeConfiguration(
      node.data.dagNode,
      registry.require(type),
    );
    for (const fieldName of Object.keys(value)) {
      unknownStepReference(value[fieldName], knownReferences, () => {
        issues.push({
          nodeId: node.id,
          nodeType: type,
          path: fieldName,
          code: 'graph.unknown_reference',
          message: 'expression references an unknown step',
        });
      });
    }
  }

  return issues;
}

export type PlaygroundDocumentImport =
  | { ok: true; graph: PlaygroundGraphState }
  | { ok: false; reason: 'parse' | 'unknown_node' | 'unknown_edge' };

/** Rebuilds an editable graph from a serialized a3s-flow DSL document. */
export function importPlaygroundDocument(
  source: string,
  locale: FlowWebsiteLocale,
  registry: A3sFlowDagNodeRegistry = a3sFlowDagNodeRegistry,
): PlaygroundDocumentImport {
  let parsed: ReturnType<typeof parseA3sFlowWorkflowDslJson>;
  try {
    parsed = parseA3sFlowWorkflowDslJson(source);
  } catch {
    return { ok: false, reason: 'parse' };
  }
  if (!parsed.ok) return { ok: false, reason: 'parse' };
  const graph = parsed.document.workflow?.graph;
  if (!graph) return { ok: false, reason: 'parse' };

  let nodes: PlaygroundNode[];
  try {
    nodes = graph.nodes.map((node, index) => {
      const { type, ...configuration } = node.data;
      const position = node.position;
      const x =
        position &&
        typeof position === 'object' &&
        typeof (position as { x?: unknown }).x === 'number'
          ? (position as { x: number }).x
          : 80 + index * 40;
      const y =
        position &&
        typeof position === 'object' &&
        typeof (position as { y?: unknown }).y === 'number'
          ? (position as { y: number }).y
          : 160;
      return createPlaygroundNode(node.id, type, { x, y }, locale, {
        configuration,
        parentId:
          typeof node.parentId === 'string' ? node.parentId : undefined,
        registry,
      });
    });
  } catch {
    return { ok: false, reason: 'unknown_node' };
  }

  let edges: PlaygroundEdge[];
  try {
    edges = graph.edges.flatMap((edge) => {
      if (!edge.sourceHandle || !edge.targetHandle) return [];
      return [
        createPlaygroundEdge(
          {
            source: edge.source,
            sourceHandle: edge.sourceHandle,
            target: edge.target,
            targetHandle: edge.targetHandle,
          },
          nodes,
          locale,
          registry,
          { labelOverride: typeof edge.label === 'string' ? edge.label : undefined },
        ),
      ];
    });
  } catch {
    return { ok: false, reason: 'unknown_edge' };
  }

  return { ok: true, graph: { nodes, edges, annotations: [] } };
}
