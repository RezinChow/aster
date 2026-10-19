/**
 * FR0b automations consumer: management-plane automation definitions
 * read through a3s-api's /cloud proxy (Console → api → Cloud SDK).
 */

import { apiRequest } from '@/lib/apiClient';

export type CloudAutomationDefinition = {
  automationId: string;
  name: string;
  triggerKind: string;
  revisionId: string;
  revisionNumber: number;
  revisionDigest: string;
  projectId: string;
  environmentId: string;
  updatedAt: string;
};

export function listCloudAutomationDefinitions() {
  return apiRequest<CloudAutomationDefinition[]>('/cloud/automation-definitions');
}

export function getCloudAutomationDefinition(automationId: string) {
  return apiRequest<CloudAutomationDefinition>(
    `/cloud/automation-definitions/${encodeURIComponent(automationId)}`,
  );
}
