/**
 * Token usage from the Cloud inference daily rollup.
 * Totals only — the ledger does not split prompt and completion tokens.
 */

import { apiRequest } from '@/lib/apiClient';

export type TokenRollup = {
  day: string;
  environmentId: string;
  modelId: string;
  endpoint: string;
  requestCount: number;
  succeededCount: number;
  failedCount: number;
  fallbackCount: number;
  cancelledCount: number;
  disconnectedCount: number;
  unknownMeasurementCount: number;
  upstreamUsageCount: number;
  totalTokens: number;
};

export type TokenUsagePage = {
  from: string;
  to: string;
  rollups: TokenRollup[];
};

export function listTokenUsage(input: {
  projectId: string;
  environmentId: string;
  from: string;
  to: string;
}) {
  const params = new URLSearchParams({
    projectId: input.projectId,
    environmentId: input.environmentId,
    from: input.from,
    to: input.to,
  });
  return apiRequest<TokenUsagePage>(`/usage/tokens?${params}`);
}
