/**
 * Session binding onto the Cloud Fleet contract.
 * Organization is implied by the directory session. Verbs and bodies match Cloud.
 * The enrollment secret is generated here and never comes back from either API.
 */

import { apiRequest } from '@/lib/apiClient';

export type CloudNode = {
  id: string;
  organizationId: string;
  name: string;
  state: string;
  availability: string;
  agentInstanceId: string;
  agentVersion: string;
  runtimeProviderId: string;
  runtimeProviderBuild: string;
  capabilitiesDigest: string;
  capabilities: unknown;
  enrolledAt: string;
  lastObservedAt: string;
  aggregateVersion: number;
  replayed: boolean;
};

export type CloudNodePoolMaintenance = {
  generation: number;
  targetNodeIds: string[];
  startsAt: string;
  endsAt: string;
  reason: string;
  cancelledAt: string | null;
  status: string;
};

export type CloudNodePoolMemberRemoval = {
  nodeId: string;
  generation: number;
  requestedAt: string;
};

export type CloudNodePool = {
  id: string;
  organizationId: string;
  name: string;
  memberNodeIds: string[];
  memberRemovalGeneration: number;
  memberRemovals: CloudNodePoolMemberRemoval[];
  maintenance: CloudNodePoolMaintenance | null;
  specDigest: string;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
  replayed: boolean;
};

export type CloudEnrollment = {
  id: string;
  organizationId: string;
  name: string;
  aggregateVersion: number;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  replayed: boolean;
  installScript: string;
};

export type CloudNodeCapacitySlot = {
  kind: string;
  stableResourceId: string;
  amount: number;
  unit: string;
};

export type CloudNodeHostMetricSample = {
  observedAt: string | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  memoryAvailableBytes: number | null;
  diskAvailableBytes: number | null;
};

export type CloudNodeHostObservation = {
  hostname: string | null;
  addresses: string[];
  machineModel: string | null;
  operatingSystem: string | null;
  architecture: string | null;
  cpuModel: string | null;
  gpuModels: string[] | null;
  memoryAvailableBytes: number | null;
  diskAvailableBytes: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  observedAt: string | null;
  samples: CloudNodeHostMetricSample[];
};

export type CloudNodeCapacity = {
  nodeId: string;
  slots: CloudNodeCapacitySlot[];
  host: CloudNodeHostObservation | null;
};

function idempotencyKey() {
  return crypto.randomUUID();
}

/** `a3sn_` + 64 lowercase hex. The control plane stores only the digest. */
export function generateEnrollmentToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `a3sn_${hex}`;
}

export function issueCloudEnrollmentToken(input: {
  name: string;
  token: string;
  expiresAt: string;
}) {
  return apiRequest<CloudEnrollment>('/cloud/enrollment-tokens', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function listCloudNodes() {
  return apiRequest<CloudNode[]>('/cloud/nodes');
}

export function listCloudNodePools() {
  return apiRequest<CloudNodePool[]>('/cloud/node-pools');
}

export function listCloudNodeCapacities() {
  return apiRequest<CloudNodeCapacity[]>('/cloud/node-resource-inventories');
}

export function drainCloudNode(nodeId: string, expectedVersion: number) {
  return apiRequest<CloudNode>(
    `/cloud/nodes/${encodeURIComponent(nodeId)}/actions/drain`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

export function readyCloudNode(nodeId: string, expectedVersion: number) {
  return apiRequest<CloudNode>(
    `/cloud/nodes/${encodeURIComponent(nodeId)}/actions/ready`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

export function removeCloudNode(nodeId: string, expectedVersion: number) {
  return apiRequest<CloudNode>(
    `/cloud/nodes/${encodeURIComponent(nodeId)}/actions/remove`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

export function revokeCloudNode(nodeId: string, expectedVersion: number) {
  return apiRequest<CloudNode>(
    `/cloud/nodes/${encodeURIComponent(nodeId)}/actions/revoke`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

export function scheduleCloudMaintenance(input: {
  nodePoolId: string;
  expectedVersion: number;
  targetNodeIds: string[];
  startsAt: string;
  endsAt: string;
  reason: string;
}) {
  return apiRequest<CloudNodePool>(
    `/cloud/node-pools/${encodeURIComponent(input.nodePoolId)}/maintenance`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        expectedVersion: input.expectedVersion,
        targetNodeIds: input.targetNodeIds,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason,
      }),
    },
  );
}

export function cancelCloudMaintenance(input: {
  nodePoolId: string;
  expectedVersion: number;
  maintenanceGeneration: number;
}) {
  return apiRequest<CloudNodePool>(
    `/cloud/node-pools/${encodeURIComponent(input.nodePoolId)}/maintenance/cancel`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        expectedVersion: input.expectedVersion,
        maintenanceGeneration: input.maintenanceGeneration,
      }),
    },
  );
}
