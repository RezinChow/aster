/**
 * Engineering-repo build pipelines.
 * Workflow files are A3S ACL at `.a3s/workflows/<name>.acl`, committed to the
 * repository. Function workflows name a Cloud Function that dispatch runs on FaaS.
 */

import { apiRequest } from '@/lib/apiClient';

export type PipelineJob = {
  id: string;
  name: string;
  status: string;
  executionId: string;
  log: string;
  startedAt: string;
  finishedAt: string;
  runsOn: string;
  runnerName: string;
};

export type PipelineRun = {
  id: string;
  workflowId: string | null;
  workflowPath: string;
  repoId: string;
  event: string;
  status: string;
  gitRef: string;
  sha: string;
  createdAt: string;
  updatedAt: string;
  jobs: PipelineJob[];
};

export type PipelineWorkflow = {
  id: string;
  repoId: string;
  name: string;
  functionAssetId: string;
  createdAt: string;
  latestRun: PipelineRun | null;
};

/** Closed set from `.a3s/workflows/<name>.acl` (specs/014 contracts/workflow-acl.md). */
export type WorkflowTrigger = 'push' | 'change_request' | 'tag' | 'manual';

export type WorkflowStepKind = 'run' | 'aix.validate' | 'aix.build' | 'aix.test' | 'artifact.upload';

export type WorkflowStep = {
  name: string;
  kind: WorkflowStepKind;
  /** Command for `kind = "run"`; empty otherwise. */
  run: string;
  /** Artifact path for `kind = "artifact.upload"`; empty otherwise. */
  path: string;
};

export type WorkflowJobSpec = {
  id: string;
  name: string;
  runsOn: string[];
  needs: string[];
  timeoutMinutes: number | null;
  steps: WorkflowStep[];
};

export type WorkflowFile = {
  path: string;
  name: string;
  events: WorkflowTrigger[];
  jobs: WorkflowJobSpec[];
  content: string;
  source: 'git';
  /** Set for invalid ACL and for refused YAML under `.github/workflows`. */
  parseError: string | null;
};

export type PipelinePage = {
  workflows: PipelineWorkflow[];
  files: WorkflowFile[];
  runs: PipelineRun[];
};

export type PipelineRunner = {
  id: string;
  kind: 'hosted' | 'self-hosted' | string;
  name: string;
  labels: string[];
  os: string;
  functionAssetId: string | null;
  repoId: string;
  /** `needs_registration`: a plaintext token from before hashing; issue a new registration token. */
  status: 'idle' | 'offline' | 'busy' | 'needs_registration';
  enrollment: 'none' | 'pending' | 'enrolled' | 'legacy';
  createdAt: string;
  registrationToken?: string | null;
  tokenExpiresAt?: string | null;
  config?: { configure: string; run: string } | null;
  lastSeenAt?: string;
};

export type PipelineRepoDefaults = {
  repoId: string;
  projectId: string;
  environmentId: string;
  updatedAt: string;
};

export function listRepoPipelines(
  repoId: string,
  query?: { workflowId?: string; file?: string },
) {
  const params = new URLSearchParams();
  if (query?.workflowId) params.set('workflowId', query.workflowId);
  if (query?.file) params.set('file', query.file);
  const suffix = params.toString();
  return apiRequest<PipelinePage>(
    `/pipelines/repos/${encodeURIComponent(repoId)}${suffix ? `?${suffix}` : ''}`,
  );
}

export function saveWorkflowFile(repoId: string, input: { path: string; content: string }) {
  return apiRequest<WorkflowFile>(`/pipelines/repos/${encodeURIComponent(repoId)}/workflow-files`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function dispatchWorkflowFile(
  repoId: string,
  input: { path: string; projectId: string; environmentId: string; gitRef: string; sha: string },
) {
  return apiRequest<PipelineRun>(`/pipelines/repos/${encodeURIComponent(repoId)}/dispatches`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listPipelineRunners(repoId: string) {
  const params = new URLSearchParams({ repoId });
  return apiRequest<PipelineRunner[]>(`/pipelines/runners?${params}`);
}

export function createPipelineRunner(input: {
  name: string;
  labels: string[];
  os: string;
  functionAssetId: string | null;
  repoId: string;
}) {
  return apiRequest<PipelineRunner>('/pipelines/runners', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePipelineRunner(id: string, functionAssetId: string | null) {
  return apiRequest<PipelineRunner>(`/pipelines/runners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ functionAssetId }),
  });
}

export function deletePipelineRunner(id: string) {
  return apiRequest<{ id: string }>(`/pipelines/runners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function refreshRunnerRegistrationToken(id: string) {
  return apiRequest<PipelineRunner>(
    `/pipelines/runners/${encodeURIComponent(id)}/registration-tokens`,
    { method: 'POST' },
  );
}

export function getPipelineRepoDefaults(repoId: string) {
  return apiRequest<PipelineRepoDefaults | null>(
    `/pipelines/repos/${encodeURIComponent(repoId)}/defaults`,
  );
}

export function putPipelineRepoDefaults(
  repoId: string,
  input: { projectId: string; environmentId: string },
) {
  return apiRequest<PipelineRepoDefaults>(
    `/pipelines/repos/${encodeURIComponent(repoId)}/defaults`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function createPipelineWorkflow(
  repoId: string,
  input: { name: string; functionAssetId: string },
) {
  return apiRequest<PipelineWorkflow>(`/pipelines/repos/${encodeURIComponent(repoId)}/workflows`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function dispatchPipeline(
  workflowId: string,
  input: { projectId: string; environmentId: string; gitRef: string; sha: string },
) {
  return apiRequest<PipelineRun>(`/pipelines/workflows/${encodeURIComponent(workflowId)}/dispatches`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getPipelineRun(runId: string) {
  return apiRequest<PipelineRun>(`/pipelines/runs/${encodeURIComponent(runId)}`);
}
