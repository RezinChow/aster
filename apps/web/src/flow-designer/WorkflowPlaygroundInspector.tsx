import {
  CheckCircle,
  Clipboard,
  PauseCircle,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import {
  localizeA3sFlowDagManifest,
  type A3sFlowDagNodeRegistry,
  type A3sFlowWorkflowDagCompilation,
  type A3sFlowWorkflowDagNode,
} from '@a3s-lab/flow-ui';
import {
  A3sFlowDagNodeConfigurationPanel,
  WorkflowCodeEditor,
} from '@a3s-lab/flow-ui/react';
import { useMemo, useState, type ReactNode } from 'react';
import { presentDesignerManifest } from './designerFields';
import type { WorkflowPlaygroundCopy } from './WorkflowPlayground.copy';
import { dagRecord } from './WorkflowPlayground.model';
import type {
  PlaygroundConfigurationIssue,
  PlaygroundEdge,
  PlaygroundNode,
} from './WorkflowPlayground.model';
import type { PlaygroundRunStep } from './WorkflowPlaygroundDebug';
import type { FlowWebsiteLocale } from './flow-node-catalog';
import { buildPlaygroundExpressionVariables } from './WorkflowPlayground.variables';

export type InspectorTab = 'settings' | 'validation' | 'document';

type WorkflowPlaygroundInspectorProps = {
  activeTab: InspectorTab;
  compilation: A3sFlowWorkflowDagCompilation;
  configurationIssues: readonly PlaygroundConfigurationIssue[];
  copy: WorkflowPlaygroundCopy;
  documentJson: string;
  edges: readonly PlaygroundEdge[];
  locale: FlowWebsiteLocale;
  registry: A3sFlowDagNodeRegistry;
  nodes: readonly PlaygroundNode[];
  onApply: () => void;
  onClose: () => void;
  onCopyDocument: () => void;
  onImportDocument?: (
    source: string,
  ) => { ok: true } | { ok: false; error: string };
  onNodeChange: (node: A3sFlowWorkflowDagNode) => void;
  onRequestConnection: (valuePath: string) => void;
  onRunNode: (nodeId: string) => void;
  selectedNode?: PlaygroundNode;
  trace: readonly PlaygroundRunStep[];
};

function nodeLabel(
  nodeId: string,
  nodes: readonly PlaygroundNode[],
  locale: FlowWebsiteLocale,
  registry: A3sFlowDagNodeRegistry,
): string {
  const node = nodes.find(({ id }) => id === nodeId);
  if (!node) return nodeId;
  const manifest = localizeA3sFlowDagManifest(
    registry.require(node.data.dagNode.data.type),
    locale,
  );
  const title = dagRecord(node.data.dagNode.data).title;
  return `${typeof title === 'string' && title.trim() ? title : manifest.display_name} · ${nodeId}`;
}

function PanelHeader({
  title,
  copy,
  onClose,
  action,
}: {
  title: string;
  copy: WorkflowPlaygroundCopy;
  onClose: () => void;
  action?: ReactNode;
}) {
  return (
    <header className="flow-playground-side-panel__header">
      <h2>{title}</h2>
      <div className="flow-playground-side-panel__header-actions">
        {action}
        <button
          aria-label={copy.close}
          onClick={onClose}
          title={copy.close}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function DocumentEditor({
  copy,
  documentJson,
  locale,
  onImportDocument,
}: Pick<
  WorkflowPlaygroundInspectorProps,
  'copy' | 'documentJson' | 'locale' | 'onImportDocument'
>) {
  const [seenJson, setSeenJson] = useState(documentJson);
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState<string>();
  if (seenJson !== documentJson) {
    setSeenJson(documentJson);
    setDraft(undefined);
    setError(undefined);
  }
  const dirty = draft !== undefined && draft !== documentJson;
  const value = draft ?? documentJson;
  return (
    <>
      <WorkflowCodeEditor
        ariaLabel={copy.documentPreview}
        className="flow-playground-document"
        fileName="workflow.json"
        id="flow-playground-document-json"
        language="json"
        locale={locale}
        meta={
          <>
            <span>UTF-8</span>
            <span>LF</span>
          </>
        }
        onChange={(next) => {
          setDraft(next);
          setError(undefined);
        }}
        readOnly={!onImportDocument}
        size="lg"
        status={
          error ??
          (dirty ? copy.documentDirty : copy.readOnly)
        }
        value={value}
      />
      {onImportDocument && dirty && (
        <footer className="flow-playground-document__import">
          {error && <p role="alert">{error}</p>}
          <button
            className="is-primary"
            onClick={() => {
              const result = onImportDocument(draft ?? '');
              if (result.ok) {
                setDraft(undefined);
                setError(undefined);
              } else {
                setError(result.error);
              }
            }}
            type="button"
          >
            {copy.importDocument}
          </button>
        </footer>
      )}
    </>
  );
}

function ValidationPanel({
  compilation,
  configurationIssues,
  copy,
  locale,
  nodes,
  registry,
}: Pick<
  WorkflowPlaygroundInspectorProps,
  | 'compilation'
  | 'configurationIssues'
  | 'copy'
  | 'locale'
  | 'nodes'
  | 'registry'
>) {
  const valid = compilation.ok && configurationIssues.length === 0;
  return (
    <div className="flow-playground-validation">
      <header className={valid ? 'is-valid' : 'is-invalid'}>
        {valid ? (
          <CheckCircle aria-hidden="true" size={23} weight="fill" />
        ) : (
          <WarningCircle aria-hidden="true" size={23} weight="fill" />
        )}
        <div>
          <strong>{valid ? copy.validTitle : copy.invalidTitle}</strong>
          <p>{valid ? copy.validDetail : copy.invalidDetail}</p>
        </div>
      </header>

      {!compilation.ok && (
        <section>
          <h3>{copy.graphIssues}</h3>
          <ol className="flow-playground-issue-list">
            {compilation.issues.map((issue) => (
              <li key={`${issue.code}-${issue.path}`}>
                <code>{issue.path || 'graph'}</code>
                <strong>{issue.code}</strong>
                <p>{issue.message}</p>
              </li>
            ))}
          </ol>        </section>
      )}

      <section>
        <h3>{copy.configurationTitle}</h3>
        {configurationIssues.length === 0 ? (
          <p className="flow-playground-validation__plain">
            <CheckCircle aria-hidden="true" size={16} weight="fill" />
            {copy.configurationValid}
          </p>
        ) : (
          <>
            <p className="flow-playground-validation__plain is-invalid">
              <WarningCircle aria-hidden="true" size={16} weight="fill" />
              {copy.configurationInvalid(configurationIssues.length)}
            </p>
            <ol className="flow-playground-issue-list">
              {configurationIssues.map((issue) => (
                <li key={`${issue.nodeId}-${issue.code}-${issue.path}`}>
                  <code>
                    {[issue.nodeId, issue.path].filter(Boolean).join('.') ||
                      'graph'}
                  </code>
                  <strong>{issue.code}</strong>
                  <p>{issue.message}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {compilation.ok && (
        <section>
          <h3>{copy.planTitle}</h3>
          <div className="flow-playground-plan">
            <strong>{copy.topLevel}</strong>
            <ol>
              {compilation.plan.topLevel.map((id) => (
                <li key={id}>{nodeLabel(id, nodes, locale, registry)}</li>
              ))}
            </ol>
            {Object.entries(compilation.plan.scopes).map(([scope, ids]) => (
              <div className="flow-playground-plan__scope" key={scope}>
                <strong>{`${copy.scope} · ${scope}`}</strong>
                <ol>
                  {ids.map((id) => (
                    <li key={id}>{nodeLabel(id, nodes, locale, registry)}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function WorkflowPlaygroundInspector({
  activeTab,
  compilation,
  configurationIssues,
  copy,
  documentJson,
  edges,
  locale,
  nodes,
  registry,
  onApply,
  onClose,
  onCopyDocument,
  onImportDocument,
  onNodeChange,
  onRequestConnection,
  onRunNode,
  selectedNode,
  trace,
}: WorkflowPlaygroundInspectorProps) {
  const expressionVariables = useMemo(
    () =>
      selectedNode
        ? buildPlaygroundExpressionVariables(
            selectedNode,
            nodes,
            edges,
            locale,
            registry,
          )
        : [],
    [edges, locale, nodes, registry, selectedNode],
  );
  const nodeOptions = useMemo(
    () =>
      nodes
        .filter((node) => node.id !== selectedNode?.id)
        .map((node) => ({
          value: node.id,
          label: nodeLabel(node.id, nodes, locale, registry),
        })),
    [locale, nodes, registry, selectedNode?.id],
  );
  if (activeTab === 'settings' && !selectedNode) return null;

  const connectedOutputPortIds = selectedNode
    ? edges
        .filter(({ source }) => source === selectedNode.id)
        .flatMap(({ sourceHandle }) => (sourceHandle ? [sourceHandle] : []))
    : [];

  return (
    <aside
      aria-label={
        activeTab === 'settings'
          ? copy.settings
          : activeTab === 'validation'
            ? copy.validation
            : copy.document
      }
      className="a3s-node-inspector flow-playground-side-panel"
      data-testid="node-inspector"
    >
      {activeTab === 'settings' && selectedNode && (
        <div className="flow-playground-config">
        <A3sFlowDagNodeConfigurationPanel
          connectedOutputPortIds={connectedOutputPortIds}
          dagNode={selectedNode.data.dagNode}
          manifest={presentDesignerManifest(
            selectedNode.data.dagNode.data.type,
            locale,
            { nodeOptions },
          )}
          preserveFieldPresentation
          expressionVariables={expressionVariables}
          lastRun={(() => {
            const step = [...trace]
              .reverse()
              .find((item) => item.nodeId === selectedNode.id);
            if (!step) return undefined;
            const failed = step.status === 'error';
            const waiting = step.status === 'waiting';
            return (
              <div className="flow-playground-last-run" data-status={step.status}>
                {failed ? (
                  <WarningCircle aria-hidden="true" weight="fill" />
                ) : waiting ? (
                  <PauseCircle aria-hidden="true" weight="fill" />
                ) : (
                  <CheckCircle aria-hidden="true" weight="fill" />
                )}
                <strong>
                  {failed
                    ? step.error
                    : waiting
                      ? copy.runPaused
                      : copy.runComplete}
                </strong>
                <pre>
                  <code>{JSON.stringify(step.output ?? null, null, 2)}</code>
                </pre>
              </div>
            );
          })()}
          locale={locale}
          onApply={onApply}
          onChange={onNodeChange}
          onClose={onClose}
          onRequestConnection={({ valuePath }) =>
            onRequestConnection(valuePath ?? 'value')
          }
          onReset={onNodeChange}
          onRun={() => onRunNode(selectedNode.id)}
          registry={registry}
          showDocumentation={false}
        />
        </div>
      )}

      {activeTab === 'validation' && (
        <>
          <PanelHeader copy={copy} onClose={onClose} title={copy.validation} />
          <div className="flow-playground-side-panel__scroll">
            <ValidationPanel
              compilation={compilation}
              configurationIssues={configurationIssues}
              copy={copy}
              locale={locale}
              nodes={nodes}
              registry={registry}
            />
          </div>
        </>
      )}

      {activeTab === 'document' && (
        <>
          <PanelHeader
            action={
              <button
                className="flow-playground-document__copy"
                onClick={onCopyDocument}
                type="button"
              >
                <Clipboard aria-hidden="true" size={14} />
                <span>{copy.copyDocument}</span>
              </button>
            }
            copy={copy}
            onClose={onClose}
            title={copy.document}
          />
          <DocumentEditor
            copy={copy}
            documentJson={documentJson}
            locale={locale}
            onImportDocument={onImportDocument}
          />
        </>
      )}
    </aside>
  );
}
