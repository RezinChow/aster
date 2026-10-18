import {
  createA3sFlowExpression,
  type A3sFlowDagNodeRegistry,
  type A3sFlowWorkflowDagNode,
} from '@a3s-lab/flow-ui';
import type { XYPosition } from '@xyflow/react';
import type { FlowWebsiteLocale } from './flow-node-catalog';
import {
  createPlaygroundNode,
  type PlaygroundNode,
} from './WorkflowPlayground.model';

export type LocalizedText = readonly [zh: string, en: string];
export type SampleExpression = Parameters<typeof createA3sFlowExpression>[0];
export type SampleJsonObject = Omit<A3sFlowWorkflowDagNode['data'], 'type'>;
type SampleJsonValue = Extract<SampleExpression, { op: 'literal' }>['value'];

export type SampleConnection = {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
};

type SampleNodeOptions = {
  configuration?: SampleJsonObject;
  parentId?: string;
  registry?: A3sFlowDagNodeRegistry;
};

const CONTAINER_WIDTH = 1_176;
const CONTAINER_HEIGHT = 480;

export function localize(
  locale: FlowWebsiteLocale,
  [zh, en]: LocalizedText,
): string {
  return locale === 'zh' ? zh : en;
}

export function field(path: string): SampleExpression {
  return { op: 'field', path };
}

export function literal(value: SampleJsonValue): SampleExpression {
  return { op: 'literal', value };
}

export function expression(value: SampleExpression) {
  return createA3sFlowExpression(value);
}

export function sampleNode(
  id: string,
  type: string,
  position: XYPosition,
  locale: FlowWebsiteLocale,
  title: LocalizedText,
  description: LocalizedText,
  options: SampleNodeOptions = {},
): PlaygroundNode {
  return createPlaygroundNode(id, type, position, locale, {
    configuration: {
      title: localize(locale, title),
      desc: localize(locale, description),
      ...(options.configuration ?? {}),
    },
    parentId: options.parentId,
    registry: options.registry,
  });
}

export function sampleContainer(
  id: string,
  type: 'iteration' | 'loop',
  position: XYPosition,
  locale: FlowWebsiteLocale,
  title: LocalizedText,
  description: LocalizedText,
  configuration: SampleJsonObject,
): PlaygroundNode {
  const node = sampleNode(id, type, position, locale, title, description, {
    configuration,
  });
  return {
    ...node,
    initialWidth: CONTAINER_WIDTH,
    initialHeight: CONTAINER_HEIGHT,
    style: {
      ...node.style,
      width: CONTAINER_WIDTH,
      height: CONTAINER_HEIGHT,
    },
  };
}

export function connection(
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle = 'in',
): SampleConnection {
  return { source, sourceHandle, target, targetHandle };
}
