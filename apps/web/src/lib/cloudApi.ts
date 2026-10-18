/**
 * Cloud Project/Env lists for R3 ScopeSwitcher via a3s-api read-through proxy.
 * Authority remains A3S Cloud; a3s-api does not store Project/Env.
 */

import { apiRequest as request } from '@/lib/apiClient';

export type CloudProject = {
  id: string;
  organizationId: string;
  name: string;
};

export type CloudEnvironment = {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
};

let cloudConfigured: boolean | null = null;

export function isCloudScopeConfigured(): boolean {
  // Resolved lazily after the first successful/failed probe, or when env forces preview.
  if (cloudConfigured !== null) return cloudConfigured;
  return true;
}

export function markCloudScopeConfigured(ready: boolean) {
  cloudConfigured = ready;
}

export type CloudOrganization = {
  id: string;
  name: string;
  aggregateVersion: number | null;
  createdAt: string;
};

function normalizeOrganization(raw: Record<string, unknown>): CloudOrganization {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    aggregateVersion: finiteNumber(raw.aggregateVersion ?? raw.aggregate_version),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

export async function listCloudOrganizations() {
  const items = await request<Record<string, unknown>[]>('/cloud/organizations');
  return items.map(normalizeOrganization).filter((item) => item.id !== '');
}

function channelQuery(organizationId?: string) {
  if (!organizationId) return '';
  return `?organizationId=${encodeURIComponent(organizationId)}`;
}

export async function listCloudProjects(organizationId?: string) {
  const items = await request<Record<string, unknown>[]>(
    `/cloud/projects${channelQuery(organizationId)}`,
  );
  return items
    .map((raw) => ({
      id: String(raw.id ?? ''),
      organizationId: String(raw.organizationId ?? raw.organization_id ?? ''),
      name: String(raw.name ?? ''),
    }))
    .filter((item) => item.id !== '') as CloudProject[];
}

export async function listCloudEnvironments(projectId: string, organizationId?: string) {
  const items = await request<Record<string, unknown>[]>(
    `/cloud/projects/${encodeURIComponent(projectId)}/environments${channelQuery(organizationId)}`,
  );
  return items
    .map((raw) => ({
      id: String(raw.id ?? ''),
      organizationId: String(raw.organizationId ?? raw.organization_id ?? ''),
      projectId: String(raw.projectId ?? raw.project_id ?? ''),
      name: String(raw.name ?? ''),
    }))
    .filter((item) => item.id !== '') as CloudEnvironment[];
}

function normalizeProject(raw: Record<string, unknown>): CloudProject {
  return {
    id: String(raw.id ?? ''),
    organizationId: String(raw.organizationId ?? raw.organization_id ?? ''),
    name: String(raw.name ?? ''),
  };
}

function normalizeEnvironment(raw: Record<string, unknown>): CloudEnvironment {
  return {
    id: String(raw.id ?? ''),
    organizationId: String(raw.organizationId ?? raw.organization_id ?? ''),
    projectId: String(raw.projectId ?? raw.project_id ?? ''),
    name: String(raw.name ?? ''),
  };
}

/** Ensure Project `default` + Env `production` for the session Org. */
export async function ensureCloudDefaultWorkspace() {
  const projects = await listCloudProjects();
  const named = projects.find((item) => item.name.toLowerCase() === 'default');
  const project =
    named ??
    (projects.length === 1 ? projects[0] : null) ??
    (await createNamedCloudProject('default', 'a3s-default-project'));
  const environments = await listCloudEnvironments(project.id);
  const namedEnvironment = environments.find(
    (item) => item.name.toLowerCase() === 'production',
  );
  const environment =
    namedEnvironment ??
    (environments.length === 1 ? environments[0] : null) ??
    (await createNamedCloudEnvironment(
      project.id,
      'production',
      `a3s-default-env-${project.id}`,
    ));
  return { project, environment };
}

async function createNamedCloudProject(name: string, idempotencyKey: string) {
  const raw = await request<Record<string, unknown>>('/cloud/projects', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ name }),
  });
  return normalizeProject(raw);
}

async function createNamedCloudEnvironment(
  projectId: string,
  name: string,
  idempotencyKey: string,
) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/projects/${encodeURIComponent(projectId)}/environments`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ name }),
    },
  );
  return normalizeEnvironment(raw);
}

/** Official operator: ensure defaults for a Cloud Organization (channel tenant). */
export async function ensureCloudOrganizationWorkspace(cloudOrganizationId: string) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/organizations/${encodeURIComponent(cloudOrganizationId)}/workspace`,
    { method: 'PUT' },
  );
  const projectRaw = (raw.project ?? {}) as Record<string, unknown>;
  const envRaw = (raw.environment ?? {}) as Record<string, unknown>;
  return {
    project: normalizeProject(projectRaw),
    environment: normalizeEnvironment(envRaw),
  };
}

export async function createCloudProject(name: string, organizationId?: string) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/projects${channelQuery(organizationId)}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ name }),
    },
  );
  return normalizeProject(raw);
}

export async function createCloudEnvironment(
  projectId: string,
  name: string,
  organizationId?: string,
) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/projects/${encodeURIComponent(projectId)}/environments${channelQuery(organizationId)}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ name }),
    },
  );
  return normalizeEnvironment(raw);
}

export type CloudDurableCell = {
  applicationId: string;
  organizationId: string;
  projectId: string;
  environmentId: string;
  name: string;
  desiredState: string;
  currentRevisionId: string;
  currentRevisionNumber: number | null;
  currentDefinitionDigest: string;
  aggregateVersion: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CloudDurableCellRevision = {
  revisionId: string;
  applicationId: string;
  revisionNumber: number | null;
  parentRevisionId: string | null;
  definitionSchema: string;
  definitionAcl: string;
  definitionDigest: string;
  createdBy: string;
  createdAt: string;
};

export type CloudDurableCellDetail = {
  application: CloudDurableCell;
  revision: CloudDurableCellRevision;
};

function finiteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDurableCell(raw: Record<string, unknown>): CloudDurableCell {
  return {
    applicationId: String(raw.applicationId ?? raw.application_id ?? ''),
    organizationId: String(raw.organizationId ?? raw.organization_id ?? ''),
    projectId: String(raw.projectId ?? raw.project_id ?? ''),
    environmentId: String(raw.environmentId ?? raw.environment_id ?? ''),
    name: String(raw.name ?? ''),
    desiredState: String(raw.desiredState ?? raw.desired_state ?? ''),
    currentRevisionId: String(raw.currentRevisionId ?? raw.current_revision_id ?? ''),
    currentRevisionNumber: finiteNumber(
      raw.currentRevisionNumber ?? raw.current_revision_number,
    ),
    currentDefinitionDigest: String(
      raw.currentDefinitionDigest ?? raw.current_definition_digest ?? '',
    ),
    aggregateVersion: finiteNumber(raw.aggregateVersion ?? raw.aggregate_version),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  };
}

function normalizeDurableCellRevision(raw: Record<string, unknown>): CloudDurableCellRevision {
  return {
    revisionId: String(raw.revisionId ?? raw.revision_id ?? ''),
    applicationId: String(raw.applicationId ?? raw.application_id ?? ''),
    revisionNumber: finiteNumber(raw.revisionNumber ?? raw.revision_number),
    parentRevisionId:
      raw.parentRevisionId == null && raw.parent_revision_id == null
        ? null
        : String(raw.parentRevisionId ?? raw.parent_revision_id ?? ''),
    definitionSchema: String(raw.definitionSchema ?? raw.definition_schema ?? ''),
    definitionAcl: String(raw.definitionAcl ?? raw.definition_acl ?? ''),
    definitionDigest: String(raw.definitionDigest ?? raw.definition_digest ?? ''),
    createdBy: String(raw.createdBy ?? raw.created_by ?? ''),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

function scopeParams(projectId: string, environmentId: string) {
  return new URLSearchParams({ projectId, environmentId });
}

function idempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cell_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function listCloudDurableCells(projectId: string, environmentId: string) {
  const items = await request<Record<string, unknown>[]>(
    `/cloud/durable-cells?${scopeParams(projectId, environmentId)}`,
  );
  return items
    .map(normalizeDurableCell)
    .filter((item) => item.applicationId !== '');
}

export async function getCloudDurableCell(input: {
  applicationId: string;
  projectId: string;
  environmentId: string;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}?${scopeParams(
      input.projectId,
      input.environmentId,
    )}`,
  );
  const applicationRaw = (raw.application ?? raw) as Record<string, unknown>;
  const revisionRaw = (raw.revision ?? {}) as Record<string, unknown>;
  return {
    application: normalizeDurableCell(applicationRaw),
    revision: normalizeDurableCellRevision(revisionRaw),
  } satisfies CloudDurableCellDetail;
}

export async function listCloudDurableCellRevisions(input: {
  applicationId: string;
  projectId: string;
  environmentId: string;
}) {
  const items = await request<Record<string, unknown>[]>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}/revisions?${scopeParams(
      input.projectId,
      input.environmentId,
    )}`,
  );
  return items
    .map(normalizeDurableCellRevision)
    .filter((item) => item.revisionId !== '');
}

export async function createCloudDurableCell(input: {
  projectId: string;
  environmentId: string;
  name: string;
  definitionAcl: string;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells?${scopeParams(input.projectId, input.environmentId)}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        name: input.name,
        definitionAcl: input.definitionAcl,
      }),
    },
  );
  return normalizeDurableCell(raw);
}

export async function reviseCloudDurableCell(input: {
  applicationId: string;
  projectId: string;
  environmentId: string;
  expectedVersion: number;
  definitionAcl: string;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}/revisions?${scopeParams(
      input.projectId,
      input.environmentId,
    )}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        expectedVersion: input.expectedVersion,
        definitionAcl: input.definitionAcl,
      }),
    },
  );
  return normalizeDurableCell(raw);
}

export async function startCloudDurableCell(input: {
  applicationId: string;
  projectId: string;
  environmentId: string;
  expectedVersion: number;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}/start?${scopeParams(
      input.projectId,
      input.environmentId,
    )}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ expectedVersion: input.expectedVersion }),
    },
  );
  return normalizeDurableCell(raw);
}

export async function stopCloudDurableCell(input: {
  applicationId: string;
  projectId: string;
  environmentId: string;
  expectedVersion: number;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}/stop?${scopeParams(
      input.projectId,
      input.environmentId,
    )}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({ expectedVersion: input.expectedVersion }),
    },
  );
  return normalizeDurableCell(raw);
}

export type CloudDurableCellDeployment = {
  applicationId: string;
  applicationRevisionId: string;
  workloadId: string;
  deploymentId: string;
  operationId: string;
  status: string;
  replayed: boolean;
};

export type CloudDurableCellRoutePublication = {
  applicationId: string;
  applicationRevisionId: string;
  routeId: string;
  hostname: string;
  pathPrefix: string;
  state: string;
  replayed: boolean;
};

export async function deployCloudDurableCell(input: {
  applicationId: string;
  revisionId: string;
  projectId: string;
  environmentId: string;
  serviceProfileAcl: string;
  storageProviderProfileAcl?: string;
  providerWorkloadAcl: string;
  storageBindingAcl: string;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}/revisions/${encodeURIComponent(
      input.revisionId,
    )}/deployments?${scopeParams(input.projectId, input.environmentId)}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        serviceProfileAcl: input.serviceProfileAcl,
        storageProviderProfileAcl: input.storageProviderProfileAcl || undefined,
        providerWorkloadAcl: input.providerWorkloadAcl,
        storageBindingAcl: input.storageBindingAcl,
      }),
    },
  );
  return {
    applicationId: String(raw.applicationId ?? raw.application_id ?? ''),
    applicationRevisionId: String(
      raw.applicationRevisionId ?? raw.application_revision_id ?? '',
    ),
    workloadId: String(raw.workloadId ?? raw.workload_id ?? ''),
    deploymentId: String(raw.deploymentId ?? raw.deployment_id ?? ''),
    operationId: String(raw.operationId ?? raw.operation_id ?? ''),
    status: String(raw.status ?? ''),
    replayed: Boolean(raw.replayed),
  } satisfies CloudDurableCellDeployment;
}

export async function publishCloudDurableCellRoute(input: {
  applicationId: string;
  revisionId: string;
  projectId: string;
  environmentId: string;
  serviceProfileAcl: string;
  gatewayScopeId: string;
  domainClaimId: string;
  hostname: string;
  pathPrefix: string;
}) {
  const raw = await request<Record<string, unknown>>(
    `/cloud/durable-cells/${encodeURIComponent(input.applicationId)}/revisions/${encodeURIComponent(
      input.revisionId,
    )}/routes?${scopeParams(input.projectId, input.environmentId)}`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify({
        serviceProfileAcl: input.serviceProfileAcl,
        gatewayScopeId: input.gatewayScopeId,
        domainClaimId: input.domainClaimId,
        hostname: input.hostname,
        pathPrefix: input.pathPrefix,
      }),
    },
  );
  return {
    applicationId: String(raw.applicationId ?? raw.application_id ?? ''),
    applicationRevisionId: String(
      raw.applicationRevisionId ?? raw.application_revision_id ?? '',
    ),
    routeId: String(raw.routeId ?? raw.route_id ?? ''),
    hostname: String(raw.hostname ?? ''),
    pathPrefix: String(raw.pathPrefix ?? raw.path_prefix ?? ''),
    state: String(raw.state ?? ''),
    replayed: Boolean(raw.replayed),
  } satisfies CloudDurableCellRoutePublication;
}
