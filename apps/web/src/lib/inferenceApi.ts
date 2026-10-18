/**
 * Cloud inference routes and deployments in the current environment, read by the Ops cards.
 * Fleet nodes are not part of this surface.
 */

import { apiRequest } from '@/lib/apiClient';

export type InferenceTarget = {
  targetId: string;
  service: string;
  upstreamModel: string;
  priority: number;
  weight: number;
};

export type InferenceModel = {
  alias: string;
  modelId: string;
  targets: InferenceTarget[];
};

export type InferenceRoute = {
  id: string;
  router: string;
  policyRevision: number;
  models: InferenceModel[];
  updatedAt: string;
  retiredAt: string | null;
};

export type InferenceRoutePage = {
  items: InferenceRoute[];
  nextCursor: string | null;
};

export type InferenceDeployment = {
  id: string;
  projectId: string;
  environmentId: string;
  modelId: string;
  name: string;
  hub: string;
  repoId: string;
  displayName: string;
  replicas: number;
  engine: string;
  quantization: string;
  readyReplicas: number;
  reason?: string;
  createdAt: string;
  artifactDigest?: string;
};

export function listInferenceRoutes(projectId: string, environmentId: string) {
  const params = new URLSearchParams({ projectId, environmentId });
  return apiRequest<InferenceRoutePage>(`/inference/routes?${params}`, {
    cache: 'no-store',
  });
}

export function listInferenceDeployments(projectId: string, environmentId: string) {
  const params = new URLSearchParams({ projectId, environmentId });
  return apiRequest<InferenceDeployment[]>(`/inference/deployments?${params}`, {
    cache: 'no-store',
  });
}

export type CreateInferenceDeploymentInput = {
  projectId: string;
  environmentId: string;
  modelId: string;
  artifactDigest: string;
  name: string;
  replicas: number;
  engine: string;
  quantization: string;
};

export function createInferenceDeployment(input: CreateInferenceDeploymentInput) {
  return apiRequest<InferenceDeployment>('/inference/deployments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
