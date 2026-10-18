/**
 * AR0.1 Agent Runtime projection via a3s-api (Console → api → Cloud SDK).
 * No mock Ready enums; digests may be absent when unbound.
 */

import { apiRequest } from '@/lib/apiClient';

export type CloudAgentRuntimeProjection = {
  agentExecutionId: string;
  conversationId: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  operationId: string;
  status: string;
  fullyBound: boolean;
  harnessInvocationProfileDigest?: string | null;
  egressPolicyDigest?: string | null;
  workspaceMaterializationDigest?: string | null;
};

export function getCloudAgentRuntime(executionId: string) {
  return apiRequest<CloudAgentRuntimeProjection>(
    `/cloud/agent-runtimes/${encodeURIComponent(executionId)}`,
  );
}

export function listCloudAgentRuntimes(
  conversationId: string,
  limit?: number,
) {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  const query = params.toString();
  return apiRequest<CloudAgentRuntimeProjection[]>(
    `/cloud/agent-conversations/${encodeURIComponent(conversationId)}/agent-runtimes${
      query ? `?${query}` : ''
    }`,
  );
}

export type CreateCloudAgentRuntimeInput = {
  agentAssetId: string;
  agentAssetReleaseId: string;
  providerKind?: string;
  input?: unknown;
};

export type CloudAgentRuntimeMutation = {
  projection: CloudAgentRuntimeProjection;
  replayed: boolean;
};

export function createCloudAgentRuntime(
  conversationId: string,
  body: CreateCloudAgentRuntimeInput,
) {
  return apiRequest<CloudAgentRuntimeMutation>(
    `/cloud/agent-conversations/${encodeURIComponent(conversationId)}/agent-runtimes`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    },
  );
}

export function stopCloudAgentRuntime(executionId: string) {
  return apiRequest<CloudAgentRuntimeMutation>(
    `/cloud/agent-runtimes/${encodeURIComponent(executionId)}/stop`,
    {
      method: 'POST',
      headers: {
        'idempotency-key': crypto.randomUUID(),
      },
    },
  );
}

/** Delete alias of stop until retention/GC delete authority exists. */
export function deleteCloudAgentRuntime(executionId: string) {
  return apiRequest<CloudAgentRuntimeMutation>(
    `/cloud/agent-runtimes/${encodeURIComponent(executionId)}`,
    {
      method: 'DELETE',
      headers: {
        'idempotency-key': crypto.randomUUID(),
      },
    },
  );
}

export type CloudAgentRuntimeLogRecord = {
  sequence: number;
  kind: string;
  occurredAt: string;
  content: unknown;
};

export type CloudAgentRuntimeLogPage = {
  executionId: string;
  records: CloudAgentRuntimeLogRecord[];
  nextCursor: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Trajectory page from Cloud. Unknown shapes become an empty page. */
export function parseCloudAgentRuntimeLogs(raw: unknown): CloudAgentRuntimeLogPage {
  const body = asRecord(raw);
  const recordsRaw = Array.isArray(body?.records) ? body.records : [];
  const records: CloudAgentRuntimeLogRecord[] = [];
  for (const item of recordsRaw) {
    const row = asRecord(item);
    if (!row) continue;
    const sequence = Number(row.sequence);
    if (!Number.isFinite(sequence)) continue;
    records.push({
      sequence,
      kind: typeof row.kind === 'string' ? row.kind : '',
      occurredAt: typeof row.occurredAt === 'string' ? row.occurredAt : '',
      content: row.content ?? null,
    });
  }
  const cursor = body?.nextCursor;
  return {
    executionId: typeof body?.executionId === 'string' ? body.executionId : '',
    records,
    nextCursor: typeof cursor === 'string' && cursor.length > 0 ? cursor : null,
  };
}

export async function getCloudAgentRuntimeLogs(
  executionId: string,
  opts?: { limit?: number; cursor?: string },
) {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.cursor) params.set('cursor', opts.cursor);
  const query = params.toString();
  const raw = await apiRequest<unknown>(
    `/cloud/agent-runtimes/${encodeURIComponent(executionId)}/logs${
      query ? `?${query}` : ''
    }`,
  );
  return parseCloudAgentRuntimeLogs(raw);
}
