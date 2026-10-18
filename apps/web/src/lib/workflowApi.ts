/**
 * Read-only Workflow control-plane reads (Console R5-α engineering track).
 *
 * Console paths ride the a3s-api `/cloud` adapter, which resolves
 * the organization from the signed-in person's Cloud credential — the same
 * contract as the Agent Runtime projection. Nothing here owns workflow truth;
 * unknown wire shapes degrade to typed empty values instead of mock rows.
 *
 * Cloud DTO wire casing is mixed: some responses serialize snake_case
 * (`WorkflowRunResponse`) while others rename to camelCase
 * (`HumanTaskSummaryResponse`). Every parser below accepts both.
 */

import { apiRequest } from './apiClient';

export type CloudWorkflowDefinition = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  currentRevisionId: string;
  currentRevisionNumber: number;
  currentRevisionDigest: string;
  createdAt: string;
  updatedAt: string;
};

export type CloudWorkflowRevision = {
  id: string;
  revisionNumber: number;
  digest: string;
  createdAt: string;
};

export type CloudWorkflowRun = {
  id: string;
  projectId: string;
  workflowGoalId: string;
  planRevisionId: string;
  planDigest: string;
  operationId: string;
  flowRunId: string;
  status: string;
  outputDigest: string | null;
  error: string | null;
  requestedAt: string;
  updatedAt: string;
  startedAt: string | null;
  deadlineAt: string;
};

export type CloudWorkflowHistoryEvent = {
  sequence: number;
  kind: string;
  occurredAt: string;
  content: unknown;
};

export type CloudHumanTask = {
  id: string;
  workflowRunId: string;
  stepId: string;
  status: string;
  claimedBy: string | null;
  decisionId: string | null;
  message: string;
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Reads the first present key; Cloud wire casing varies per DTO. */
function wireString(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') return value;
  }
  return '';
}

function wireNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = Number(row[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function wireNullableString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === null) return null;
    if (typeof value === 'string') return value;
  }
  return null;
}

function wireRows(value: unknown): Record<string, unknown>[] {
  const row = asRecord(value);
  const list = Array.isArray(value)
    ? value
    : Array.isArray(row?.records)
      ? row.records
      : Array.isArray(row?.items)
        ? row.items
        : Array.isArray(row?.workflow_definitions)
          ? row.workflow_definitions
          : Array.isArray(row?.workflow_revisions)
            ? row.workflow_revisions
            : Array.isArray(row?.workflow_runs)
              ? row.workflow_runs
              : Array.isArray(row?.human_tasks)
                ? row.human_tasks
                : [];
  return list.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record] : [];
  });
}

export function parseCloudWorkflowDefinition(
  value: unknown,
): CloudWorkflowDefinition | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = wireString(row, ['id']);
  if (!id) return null;
  return {
    id,
    projectId: wireString(row, ['project_id', 'projectId']),
    name: wireString(row, ['name']),
    description: wireString(row, ['description']),
    currentRevisionId: wireString(row, ['current_revision_id', 'currentRevisionId']),
    currentRevisionNumber: wireNumber(row, [
      'current_revision_number',
      'currentRevisionNumber',
    ]),
    currentRevisionDigest: wireString(row, [
      'current_revision_digest',
      'currentRevisionDigest',
    ]),
    createdAt: wireString(row, ['created_at', 'createdAt']),
    updatedAt: wireString(row, ['updated_at', 'updatedAt']),
  };
}

export function parseCloudWorkflowDefinitionList(
  value: unknown,
): CloudWorkflowDefinition[] {
  return wireRows(value).flatMap((row) => {
    const parsed = parseCloudWorkflowDefinition(row);
    return parsed ? [parsed] : [];
  });
}

export function parseCloudWorkflowRevision(
  value: unknown,
): CloudWorkflowRevision | null {
  const row = asRecord(value);
  if (!row) return null;
  const summary = asRecord(row.summary) ?? row;
  const id = wireString(summary, ['id']);
  if (!id) return null;
  return {
    id,
    revisionNumber: wireNumber(summary, ['revision_number', 'revisionNumber']),
    digest: wireString(summary, ['digest']),
    createdAt: wireString(summary, ['created_at', 'createdAt']),
  };
}

export function parseCloudWorkflowRevisionList(
  value: unknown,
): CloudWorkflowRevision[] {
  return wireRows(value).flatMap((row) => {
    const parsed = parseCloudWorkflowRevision(row);
    return parsed ? [parsed] : [];
  });
}

export function parseCloudWorkflowRun(value: unknown): CloudWorkflowRun | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = wireString(row, ['id']);
  if (!id) return null;
  return {
    id,
    projectId: wireString(row, ['project_id', 'projectId']),
    workflowGoalId: wireString(row, ['workflow_goal_id', 'workflowGoalId']),
    planRevisionId: wireString(row, ['plan_revision_id', 'planRevisionId']),
    planDigest: wireString(row, ['plan_digest', 'planDigest']),
    operationId: wireString(row, ['operation_id', 'operationId']),
    flowRunId: wireString(row, ['flow_run_id', 'flowRunId']),
    status: wireString(row, ['status']),
    outputDigest: wireNullableString(row, ['output_digest', 'outputDigest']),
    error: wireNullableString(row, ['error']),
    requestedAt: wireString(row, ['requested_at', 'requestedAt']),
    updatedAt: wireString(row, ['updated_at', 'updatedAt']),
    startedAt: wireNullableString(row, ['started_at', 'startedAt']),
    deadlineAt: wireString(row, ['deadline_at', 'deadlineAt']),
  };
}

export function parseCloudWorkflowRunList(value: unknown): CloudWorkflowRun[] {
  return wireRows(value).flatMap((row) => {
    const parsed = parseCloudWorkflowRun(row);
    return parsed ? [parsed] : [];
  });
}

export type CloudWorkflowHistoryPage = {
  workflowRunId: string;
  events: CloudWorkflowHistoryEvent[];
  nextCursor: string | null;
};

export function parseCloudWorkflowHistory(
  value: unknown,
): CloudWorkflowHistoryPage {
  const row = asRecord(value);
  const events = wireRows(value).map((event) => ({
    sequence: wireNumber(event, ['sequence', 'flow_sequence', 'flowSequence']),
    kind: wireString(event, ['kind', 'event_kind', 'eventKind']),
    occurredAt: wireString(event, ['occurred_at', 'occurredAt', 'recorded_at']),
    content: event.content ?? event.payload ?? null,
  }));
  const cursor = row?.next_cursor ?? row?.nextCursor;
  return {
    workflowRunId: wireString(row ?? {}, [
      'workflow_run_id',
      'workflowRunId',
      'id',
    ]),
    events,
    nextCursor: typeof cursor === 'string' && cursor.length > 0 ? cursor : null,
  };
}

export function parseCloudHumanTask(value: unknown): CloudHumanTask | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = wireString(row, ['id']);
  if (!id) return null;
  return {
    id,
    workflowRunId: wireString(row, ['workflow_run_id', 'workflowRunId']),
    stepId: wireString(row, ['step_id', 'stepId']),
    status: wireString(row, ['status']),
    claimedBy: wireNullableString(row, ['claimed_by', 'claimedBy']),
    decisionId: wireNullableString(row, ['decision_id', 'decisionId']),
    message: wireString(row, ['message']),
    createdAt: wireString(row, ['created_at', 'createdAt']),
  };
}

export function parseCloudHumanTaskList(value: unknown): CloudHumanTask[] {
  return wireRows(value).flatMap((row) => {
    const parsed = parseCloudHumanTask(row);
    return parsed ? [parsed] : [];
  });
}

function projectScope(projectId: string, suffix: string): string {
  return `/cloud/projects/${encodeURIComponent(projectId)}${suffix}`;
}

export function listCloudWorkflowDefinitions(projectId: string) {
  return apiRequest<unknown>(
    projectScope(projectId, '/workflow-definitions'),
  ).then(parseCloudWorkflowDefinitionList);
}

export function getCloudWorkflowDefinition(definitionId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-definitions/${encodeURIComponent(definitionId)}`,
  ).then(parseCloudWorkflowDefinition);
}

export function listCloudWorkflowRevisions(definitionId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-definitions/${encodeURIComponent(definitionId)}/revisions`,
  ).then(parseCloudWorkflowRevisionList);
}

export function getCloudWorkflowRevision(
  definitionId: string,
  revisionId: string,
) {
  return apiRequest<unknown>(
    `/cloud/workflow-definitions/${encodeURIComponent(definitionId)}/revisions/${encodeURIComponent(revisionId)}`,
  );
}

export function listCloudWorkflowRuns(projectId: string) {
  return apiRequest<unknown>(
    projectScope(projectId, '/workflow-runs'),
  ).then(parseCloudWorkflowRunList);
}

export function getCloudWorkflowRun(runId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}`,
  ).then(parseCloudWorkflowRun);
}

export function getCloudWorkflowRunHistory(runId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/history`,
  ).then(parseCloudWorkflowHistory);
}

export function getCloudWorkflowRunOutput(runId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/output`,
  );
}

export function getCloudWorkflowRunVariables(runId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/variables`,
  );
}

export function getCloudWorkflowRunDiagnostics(runId: string) {
  return apiRequest<unknown>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/diagnostics`,
  );
}

export function getCloudWorkflowNodeCatalog(projectId: string) {
  return apiRequest<unknown>(
    projectScope(projectId, '/workflow-node-catalog'),
  );
}

export function listCloudHumanTasks(projectId: string) {
  return apiRequest<unknown>(
    projectScope(projectId, '/human-tasks'),
  ).then(parseCloudHumanTaskList);
}

export function getCloudHumanTask(taskId: string) {
  return apiRequest<unknown>(
    `/cloud/human-tasks/${encodeURIComponent(taskId)}`,
  ).then(parseCloudHumanTask);
}

// --- Desired-state submissions (M2 engineering track) ---------------------
// Mutations ride the same adapter with idempotency keys; the console only
// calls these once the publish flow lands (Cloud W0.3 availability gate).

export type CloudWorkflowPayloadAcl = {
  kind: string;
  acl: string;
};

export type CloudWorkflowSemanticContractAcls = {
  descriptorBindingsAcl: string;
  descriptorRegistryAcl: string;
  variableContractAcl: string;
  variableDefaultsAcl?: string;
  compositeRegionsAcl?: string;
};

export type CloudPublishWorkflowDefinitionInput = {
  definitionAcl: string;
  payloads: CloudWorkflowPayloadAcl[];
  semanticContracts?: CloudWorkflowSemanticContractAcls;
};

export type CloudStartWorkflowRunInput = {
  workflowGoalId: string;
  planRevisionId: string;
  timeoutSeconds?: number;
};

function mutationHeaders(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  };
}

function snakeKeys(value: Record<string, unknown>): Record<string, unknown> {
  return {
    definition_acl: value.definitionAcl,
    payloads: Array.isArray(value.payloads)
      ? (value.payloads as CloudWorkflowPayloadAcl[]).map((payload) => ({
          kind: payload.kind,
          acl: payload.acl,
        }))
      : value.payloads,
    semantic_contracts: value.semanticContracts
      ? {
          descriptor_bindings_acl: (
            value.semanticContracts as CloudWorkflowSemanticContractAcls
          ).descriptorBindingsAcl,
          descriptor_registry_acl: (
            value.semanticContracts as CloudWorkflowSemanticContractAcls
          ).descriptorRegistryAcl,
          variable_contract_acl: (
            value.semanticContracts as CloudWorkflowSemanticContractAcls
          ).variableContractAcl,
          variable_defaults_acl: (
            value.semanticContracts as CloudWorkflowSemanticContractAcls
          ).variableDefaultsAcl,
          composite_regions_acl: (
            value.semanticContracts as CloudWorkflowSemanticContractAcls
          ).compositeRegionsAcl,
        }
      : undefined,
  };
}

/** Publishes the first definition revision in a project (fail-closed ACL). */
export function publishCloudWorkflowDefinition(
  projectId: string,
  input: CloudPublishWorkflowDefinitionInput,
) {
  return apiRequest<unknown>(
    projectScope(projectId, '/workflow-definitions'),
    mutationHeaders(snakeKeys(input as unknown as Record<string, unknown>)),
  );
}

/** Appends an immutable revision; editing is never an in-place mutation. */
export function reviseCloudWorkflowDefinition(
  definitionId: string,
  input: CloudPublishWorkflowDefinitionInput,
) {
  return apiRequest<unknown>(
    `/cloud/workflow-definitions/${encodeURIComponent(definitionId)}/revisions`,
    mutationHeaders(snakeKeys(input as unknown as Record<string, unknown>)),
  );
}

export type CloudWorkflowRunMutation = {
  run: CloudWorkflowRun | null;
  replayed: boolean;
};

function parseRunMutation(value: unknown): CloudWorkflowRunMutation {
  const row = asRecord(value);
  const runRow = asRecord(row?.workflow_run) ?? asRecord(row?.workflowRun);
  return {
    run: runRow ? parseCloudWorkflowRun(runRow) : null,
    replayed: row?.replayed === true,
  };
}

export function startCloudWorkflowRun(
  projectId: string,
  input: CloudStartWorkflowRunInput,
) {
  return apiRequest<CloudWorkflowRunMutation>(
    projectScope(projectId, '/workflow-runs'),
    mutationHeaders({
      workflow_goal_id: input.workflowGoalId,
      plan_revision_id: input.planRevisionId,
      ...(input.timeoutSeconds != null
        ? { timeout_seconds: input.timeoutSeconds }
        : {}),
    }),
  ).then(parseRunMutation);
}

export function cancelCloudWorkflowRun(runId: string, reason?: string) {
  return apiRequest<CloudWorkflowRunMutation>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/cancel`,
    mutationHeaders(reason ? { reason } : {}),
  ).then(parseRunMutation);
}

export function pauseCloudWorkflowRun(runId: string, reason?: string) {
  return apiRequest<CloudWorkflowRunMutation>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/pause`,
    mutationHeaders(reason ? { reason } : {}),
  ).then(parseRunMutation);
}

export function resumeCloudWorkflowRun(runId: string) {
  return apiRequest<CloudWorkflowRunMutation>(
    `/cloud/workflow-runs/${encodeURIComponent(runId)}/resume`,
    mutationHeaders({}),
  ).then(parseRunMutation);
}
