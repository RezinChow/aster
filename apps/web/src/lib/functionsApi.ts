/**
 * Session binding onto Cloud Function assets via a3s-api read-through.
 * Authority remains A3S Cloud; no local Function store.
 */

import { apiRequest } from '@/lib/apiClient';

export type CloudFunctionProfile = {
  assetReleaseId: string;
  profileDigest: string;
  mode: string;
  acl: string;
  maxConcurrency: number | null;
  timeoutMs: number | null;
  artifactDigest: string | null;
  executionTemplateId: string | null;
  createdAt: string;
};

export type CloudFunctionRelease = {
  releaseId: string;
  version: string;
  state: string;
  createdAt: string;
  publishedAt: string | null;
  yankedAt: string | null;
  profile: CloudFunctionProfile | null;
};

export type CloudFunctionSummary = {
  assetId: string;
  organizationId: string;
  name: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  latestRelease: CloudFunctionRelease | null;
};

export type CloudFunctionDetail = {
  assetId: string;
  organizationId: string;
  name: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  releases: CloudFunctionRelease[];
};

export type CloudFunctionRun = {
  executionId: string;
  status: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  exitCode: number | null;
  failureReason: string | null;
  artifactDigest: string | null;
};

export function listCloudFunctions() {
  return apiRequest<CloudFunctionSummary[]>('/cloud/functions');
}

export function getCloudFunction(assetId: string) {
  return apiRequest<CloudFunctionDetail>(
    `/cloud/functions/${encodeURIComponent(assetId)}`,
  );
}

export function listCloudFunctionRuns(
  assetId: string,
  input: { projectId: string; environmentId: string; limit?: number },
) {
  const params = new URLSearchParams({
    projectId: input.projectId,
    environmentId: input.environmentId,
  });
  if (input.limit != null) params.set('limit', String(input.limit));
  return apiRequest<CloudFunctionRun[]>(
    `/cloud/functions/${encodeURIComponent(assetId)}/runs?${params}`,
  );
}
