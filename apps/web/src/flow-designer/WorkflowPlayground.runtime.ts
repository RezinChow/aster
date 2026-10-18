import type { A3sFlowDagNodeRegistry } from '@a3s-lab/flow-ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkflowPlaygroundCopy } from './WorkflowPlayground.copy';
import type {
  PlaygroundRunRecord,
  PlaygroundRunStep,
} from './WorkflowPlaygroundDebug';
import { nodeDisplayName } from './WorkflowPlayground.graph';
import { executeNode, executePlaygroundGraph } from './playgroundExecute';
import type {
  PlaygroundGraphState,
  PlaygroundNode,
  compilePlaygroundGraph,
} from './WorkflowPlayground.model';
import type { FlowWebsiteLocale } from './flow-node-catalog';

type PlaygroundCompilation = ReturnType<typeof compilePlaygroundGraph>;

type WorkflowPlaygroundRuntimeOptions = {
  compilation: PlaygroundCompilation;
  configurationIssueCount: number;
  copy: WorkflowPlaygroundCopy;
  graph: PlaygroundGraphState;
  locale: FlowWebsiteLocale;
  registry: A3sFlowDagNodeRegistry;
  onAnnouncement: (message: string) => void;
  onOpenTrace: () => void;
  onOpenValidation: () => void;
};

export function useWorkflowPlaygroundRuntime({
  compilation,
  configurationIssueCount,
  copy,
  graph,
  locale,
  registry,
  onAnnouncement,
  onOpenTrace,
  onOpenValidation,
}: WorkflowPlaygroundRuntimeOptions) {
  const [statuses, setStatuses] = useState<
    Record<string, PlaygroundNode['data']['runtimeStatus']>
  >({});
  const [running, setRunning] = useState(false);
  const [runningNodeId, setRunningNodeId] = useState<string>();
  const [trace, setTrace] = useState<PlaygroundRunStep[]>([]);
  const [history, setHistory] = useState<PlaygroundRunRecord[]>([]);
  const runAbort = useRef<AbortController | undefined>(undefined);
  const runCounter = useRef(1);

  useEffect(() => () => runAbort.current?.abort(), []);

  const stopRun = useCallback(() => {
    runAbort.current?.abort();
    setRunning(false);
    setRunningNodeId(undefined);
    setStatuses({});
    onAnnouncement(copy.runStopped);
  }, [copy.runStopped, onAnnouncement]);

  const runNode = useCallback(
    async (nodeId: string) => {
      if (running) return;
      const node = graph.nodes.find(({ id }) => id === nodeId);
      if (!node) return;
      const controller = new AbortController();
      runAbort.current?.abort();
      runAbort.current = controller;
      setRunning(true);
      onOpenTrace();
      setRunningNodeId(nodeId);
      setStatuses({ [nodeId]: 'running' });
      const step = await executeNode({
        node,
        trigger: {},
        locale,
        label: nodeDisplayName(node, locale, registry),
      });
      if (controller.signal.aborted) return;
      setTrace([step]);
      setStatuses({
        [nodeId]:
          step.status === 'error'
            ? 'error'
            : step.status === 'waiting'
              ? 'waiting'
              : 'success',
      });
      setRunningNodeId(undefined);
      setRunning(false);
      onAnnouncement(
        step.error ??
          (step.status === 'waiting' ? copy.runPaused : copy.runComplete),
      );
    },
    [
      copy.runComplete,
      copy.runPaused,
      graph.nodes,
      locale,
      onAnnouncement,
      onOpenTrace,
      registry,
      running,
    ],
  );

  const runWorkflow = useCallback(
    async (_input?: unknown) => {
      if (running) return;
      if (!compilation.ok || configurationIssueCount > 0) {
        onOpenValidation();
        return;
      }
      const controller = new AbortController();
      runAbort.current?.abort();
      runAbort.current = controller;
      const execution = await executePlaygroundGraph({
        nodes: graph.nodes,
        edges: graph.edges,
        trigger: _input ?? {},
        locale,
        label: (node) => nodeDisplayName(node, locale, registry),
      });
      const steps: PlaygroundRunStep[] = [];
      setRunning(true);
      onOpenTrace();
      setTrace([]);
      setStatuses({});

      for (const step of execution.steps) {
        if (controller.signal.aborted) return;
        setRunningNodeId(step.nodeId);
        setStatuses((current) => ({ ...current, [step.nodeId]: 'running' }));
        await new Promise((resolve) => window.setTimeout(resolve, 40));
        if (controller.signal.aborted) return;
        steps.push(step);
        setTrace([...steps]);
        setStatuses((current) => ({
          ...current,
          [step.nodeId]:
            step.status === 'error'
              ? 'error'
              : step.status === 'waiting'
                ? 'waiting'
                : 'success',
        }));
        if (step.status === 'waiting') break;
      }

      const paused = execution.ok && execution.pausedAt !== undefined;
      if (!paused) {
        const durationMs = steps.reduce(
          (total, step) => total + step.durationMs,
          0,
        );
        const record: PlaygroundRunRecord = {
          id: `run-${String(runCounter.current++).padStart(3, '0')}`,
          startedAt: new Date().toLocaleTimeString(
            locale === 'zh' ? 'zh-CN' : 'en-US',
            { hour: '2-digit', minute: '2-digit', second: '2-digit' },
          ),
          durationMs,
          steps,
        };
        setHistory((current) => [record, ...current].slice(0, 12));
      }
      setRunningNodeId(undefined);
      setRunning(false);
      if (paused) {
        onAnnouncement(copy.runPaused);
        return;
      }
      onAnnouncement(execution.ok ? copy.runComplete : execution.error);
    },
    [
      compilation,
      configurationIssueCount,
      copy.runComplete,
      copy.runPaused,
      graph.edges,
      graph.nodes,
      locale,
      onAnnouncement,
      onOpenTrace,
      onOpenValidation,
      registry,
      running,
    ],
  );

  const resetRuntimeHistory = useCallback(() => {
    setTrace([]);
    setHistory([]);
  }, []);

  return {
    history,
    resetRuntimeHistory,
    runNode,
    runWorkflow,
    running,
    runningNodeId,
    statuses,
    trace,
    stopRun,
  };
}
