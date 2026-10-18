/**
 * Session binding onto Cloud service load.
 * `GET /cloud/workloads` forwards Cloud
 * `GET /organizations/{organization}/workload-service-loads`.
 * Health, replicas, CPU, and memory are decided by that Workloads query.
 */

import { apiRequest } from '@/lib/apiClient';

export type CloudWorkloadMember = {
  ordinal: number;
  deploymentStatus: string | null;
  runtimeState: string | null;
  healthState: string | null;
};

export type CloudWorkload = {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  desiredState: string;
  ownerKind: string | null;
  desiredReplicas: number;
  readyReplicas: number;
  cpuMillis: number | null;
  memoryBytes: number | null;
  health: string;
  members: CloudWorkloadMember[];
};

export function listCloudWorkloads() {
  return apiRequest<CloudWorkload[]>('/cloud/workloads');
}
