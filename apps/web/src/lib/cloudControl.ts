/**
 * Console Cloud resource calls.
 * Mapped `/cloud` paths go to A3S Cloud as the signed-in person.
 * Unmapped paths stay on the a3s-api install-token adapter.
 */

import { API_BASE } from '@/lib/apiBase';
import { ApiRequestError, unwrapApiEnvelope } from '@/lib/apiEnvelope';
import { CLOUD_API_BASE } from '@/lib/openapi';
import {
  getCloudPersonCredential,
  getUserToken,
  setCloudPersonCredential,
  type CloudPersonCredential,
} from '@/lib/userSession';

export type CloudControlResult<T> = { ok: true; data: T } | { ok: false };

const CREDENTIAL_PATH = '/identity/cloud-credentials';

let inflight: Promise<CloudPersonCredential> | null = null;

export function cloudControlPath(path: string, organizationId: string): string | null {
  const queryIndex = path.indexOf('?');
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : path.slice(queryIndex + 1);
  if (!pathname.startsWith('/cloud/')) return null;
  const rest = pathname.slice('/cloud'.length);
  const org = encodeURIComponent(organizationId);
  const params = new URLSearchParams(query);

  if (
    rest === '/projects' ||
    /^\/projects\/[^/]+\/environments$/.test(rest) ||
    rest === '/nodes' ||
    /^\/nodes\/[^/]+\/actions\/(drain|ready|revoke|remove)$/.test(rest) ||
    rest === '/node-pools' ||
    /^\/node-pools\/[^/]+\/maintenance(\/cancel)?$/.test(rest) ||
    rest === '/node-resource-inventories'
  ) {
    return withQuery(`/organizations/${org}${rest}`, params);
  }

  if (rest === '/workloads') {
    return withQuery(`/organizations/${org}/workload-service-loads`, params);
  }

  // Organization-owned system services use the signed-in person's authority.
  if (/^\/(sms|service-secrets)(?:\/.*)?$/.test(rest)) {
    return withQuery(`/organizations/${org}${rest}`, params);
  }

  // Workflow (R5-α): project-scoped collections and workflow-scoped reads.
  if (/^\/projects\/[^/]+\/environments\/[^/]+\/(sms(?:\/.*)?|secrets)$/.test(rest)) {
    return withQuery(`/organizations/${org}${rest}`, params);
  }

  const workflowCollection = rest.match(
    /^\/projects\/([^/]+)\/(workflow-definitions|workflow-runs|workflow-node-catalog|human-tasks)$/,
  );
  if (workflowCollection) {
    return withQuery(
      `/organizations/${org}/projects/${workflowCollection[1]}/${workflowCollection[2]}`,
      params,
    );
  }

  const workflowResource = rest.match(
    /^\/(workflow-definitions|workflow-runs|human-tasks)\/([^/]+)(\/(revisions|history|output|variables|diagnostics)(\/([^/]+))?)?$/,
  );
  if (workflowResource) {
    const [, kind, id, , sub, , subId] = workflowResource;
    const suffix = sub
      ? `/${sub}${subId ? `/${subId}` : ''}`
      : '';
    return withQuery(
      `/organizations/${org}/${kind}/${id}${suffix}`,
      params,
    );
  }

  const runtime = rest.match(/^\/agent-runtimes\/([^/]+)(\/(?:stop|logs))?$/);
  if (runtime) {
    return withQuery(
      `/organizations/${org}/agent-runtimes/${runtime[1]}${runtime[2] ?? ''}`,
      params,
    );
  }

  const conversation = rest.match(/^\/agent-conversations\/([^/]+)\/agent-runtimes$/);
  if (conversation) {
    return withQuery(
      `/organizations/${org}/agent-conversations/${conversation[1]}/agent-runtimes`,
      params,
    );
  }

  if (rest === '/durable-cells' || rest.startsWith('/durable-cells/')) {
    const projectId = params.get('projectId');
    const environmentId = params.get('environmentId');
    if (!projectId || !environmentId) return null;
    params.delete('projectId');
    params.delete('environmentId');
    const suffix = rest.replace(/^\/durable-cells/, '/durable-cell-applications');
    return withQuery(
      `/organizations/${org}/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(environmentId)}${suffix}`,
      params,
    );
  }

  return null;
}

function withQuery(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function adaptCloudControlBody(data: unknown): unknown {
  const row = asRecord(data);
  const record = asRecord(row?.record);
  if (record?.application && typeof record.application === 'object') {
    return record.application;
  }
  const publication = asRecord(row?.publication);
  const publishedRoute = asRecord(publication?.route);
  const correlation = asRecord(row?.correlation);
  if (correlation?.applicationId != null && publishedRoute) {
    return {
      applicationId: correlation.applicationId,
      applicationRevisionId: correlation.applicationRevisionId,
      routeId: publishedRoute.id,
      hostname: publishedRoute.hostname,
      pathPrefix: publishedRoute.pathPrefix,
      state: publishedRoute.state,
      replayed: publication?.replayed === true,
    };
  }
  const workload = asRecord(row?.workload);
  if (correlation?.applicationId != null && workload) {
    return {
      applicationId: correlation.applicationId,
      applicationRevisionId: correlation.applicationRevisionId,
      workloadId: correlation.workloadId,
      deploymentId: correlation.deploymentId,
      operationId: correlation.operationId,
      status: workload.status ?? '',
      replayed: row?.replayed === true,
    };
  }
  return adaptAgentRuntime(data);
}

function adaptAgentRuntime(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(flattenAgentRuntimeProjection);
  const row = asRecord(data);
  if (!row) return data;
  const projection = asRecord(row.projection);
  if (projection?.correlation) {
    return {
      projection: flattenAgentRuntimeProjection(projection),
      replayed: row.replayed === true,
    };
  }
  if (row.correlation) return flattenAgentRuntimeProjection(row);
  return data;
}

function flattenAgentRuntimeProjection(value: unknown): unknown {
  const row = asRecord(value);
  const correlation = asRecord(row?.correlation);
  if (!row || !correlation) return value;
  return {
    agentExecutionId: wireString(correlation, 'agent_execution_id'),
    conversationId: typeof row.conversationId === 'string' ? row.conversationId : '',
    organizationId: wireString(correlation, 'organization_id'),
    projectId: wireString(correlation, 'project_id'),
    environmentId: wireString(correlation, 'environment_id'),
    operationId: wireString(correlation, 'operation_id'),
    status: typeof row.status === 'string' ? row.status : '',
    fullyBound: row.fullyBound === true,
    harnessInvocationProfileDigest: wireOptional(correlation, 'harness_invocation_profile_digest'),
    egressPolicyDigest: wireOptional(correlation, 'egress_policy_digest'),
    workspaceMaterializationDigest: wireOptional(
      correlation,
      'workspace_materialization_digest',
    ),
  };
}

/** AgentRuntimeCorrelationV1 has no rename_all, so these keys stay snake_case. */
function wireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function wireOptional(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function tryCloudControl<T>(
  path: string,
  init?: RequestInit,
): Promise<CloudControlResult<T>> {
  if (cloudControlPath(path, '0') === null) return { ok: false };
  const credential = await loadCloudPersonCredential();
  const target = cloudControlPath(path, credential.organizationId);
  if (!target) return { ok: false };
  const base = CLOUD_API_BASE.replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}${target}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
        ...asHeaderRecord(init?.headers),
        authorization: `Bearer ${credential.accessToken}`,
      },
    });
  } catch (error) {
    throw new ApiRequestError(
      error instanceof Error ? error.message : 'Cloud control plane is unreachable',
      { code: 503 },
    );
  }
  if (response.status === 401) setCloudPersonCredential(null);
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text || `HTTP ${response.status}`);
    }
  }
  const data = unwrapApiEnvelope<T>(payload, response.status);
  return { ok: true, data: adaptCloudControlBody(data) as T };
}

export function loadCloudPersonCredential(): Promise<CloudPersonCredential> {
  const cached = getCloudPersonCredential();
  if (cached) return Promise.resolve(cached);
  if (!getUserToken()) {
    return Promise.reject(
      new ApiRequestError('Cloud credential is unavailable', { code: 40100 }),
    );
  }
  if (!inflight) {
    inflight = fetchCredential().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function fetchCredential(): Promise<CloudPersonCredential> {
  const session = getUserToken();
  if (!session) {
    throw new ApiRequestError('Cloud credential is unavailable', { code: 40100 });
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${CREDENTIAL_PATH}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${session}`,
      },
    });
  } catch (error) {
    throw new ApiRequestError(
      error instanceof Error ? error.message : 'Cloud credential is unavailable',
      { code: 503 },
    );
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiRequestError(text || `HTTP ${response.status}`, { code: response.status });
    }
  }
  const data = unwrapApiEnvelope<unknown>(payload, response.status);
  const credential = parseCredential(data);
  if (!credential) {
    throw new ApiRequestError('Cloud credential is unavailable', { code: 50000 });
  }
  setCloudPersonCredential(credential);
  return credential;
}

function parseCredential(value: unknown): CloudPersonCredential | null {
  const row = asRecord(value);
  if (!row) return null;
  const accessToken = row.accessToken;
  const organizationId = row.organizationId;
  const principalId = row.principalId;
  const subject = row.subject;
  if (
    typeof accessToken !== 'string' ||
    !/^a3s_[0-9a-f]{64}$/.test(accessToken) ||
    typeof organizationId !== 'string' ||
    organizationId.length === 0 ||
    typeof principalId !== 'string' ||
    principalId.length === 0 ||
    typeof subject !== 'string' ||
    subject.length === 0
  ) {
    return null;
  }
  return { accessToken, organizationId, principalId, subject };
}

function asHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}
