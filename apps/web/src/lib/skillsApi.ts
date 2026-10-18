/**
 * Session binding onto Cloud Skill assets via a3s-api.
 * Authority remains A3S Cloud; no parallel skill store in the browser.
 *
 * Single write/read path: Console → skillsApi → a3s-api → Cloud SDK.
 * Do not call Cloud REST from the browser (`cloudSkillsApi` is deprecated).
 *
 * Skills are not marketplace products: there is no listing, SKU, or price.
 * Members install them from Studio 能力扩展 via `/v1/api/org/capabilities`.
 */

import { apiRequest } from '@/lib/apiClient';

export type CloudSkillReleaseArtifact = {
  kind: string;
  digest: string;
  mediaType: string;
  sizeBytes: number;
};

export type CloudSkillRelease = {
  releaseId: string;
  version: string;
  state: string;
  commitSha: string;
  createdAt: string;
  publishedAt: string | null;
  yankedAt: string | null;
  artifact: CloudSkillReleaseArtifact | null;
};

export type CloudSkillSummary = {
  assetId: string;
  organizationId: string;
  name: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  latestRelease: CloudSkillRelease | null;
};

export type CloudSkillDetail = {
  assetId: string;
  organizationId: string;
  name: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  releases: CloudSkillRelease[];
};

export type CloudSkillCreateResult = {
  assetId: string;
  commitSha: string;
  release: CloudSkillRelease | null;
};

function idempotencyKey() {
  return crypto.randomUUID();
}

export function listCloudSkills() {
  return apiRequest<CloudSkillSummary[]>('/cloud/skills');
}

export function getCloudSkill(assetId: string) {
  return apiRequest<CloudSkillDetail>(
    `/cloud/skills/${encodeURIComponent(assetId)}`,
  );
}

export function createCloudSkill(input: {
  name: string;
  markdown: string;
  message?: string;
  version?: string;
}) {
  return apiRequest<CloudSkillCreateResult>('/cloud/skills', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify(input),
  });
}

export function commitCloudSkillSource(
  assetId: string,
  input: { markdown: string; message?: string },
) {
  return apiRequest<{ commitSha: string }>(
    `/cloud/skills/${encodeURIComponent(assetId)}/skill-source`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function buildCloudSkillRelease(
  assetId: string,
  input: { version: string; commitSha: string },
) {
  return apiRequest<CloudSkillRelease>(
    `/cloud/skills/${encodeURIComponent(assetId)}/releases`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey() },
      body: JSON.stringify(input),
    },
  );
}

/** Build state from Cloud summary: source-only, built bundle, or archived. */
export function cloudSkillBuildState(
  row: CloudSkillSummary,
): 'built' | 'source' | 'archived' {
  if (row.state === 'archived') return 'archived';
  const release = row.latestRelease;
  if (!release) return 'source';
  if (release.artifact || release.state === 'published') return 'built';
  return 'source';
}

export function nextSkillReleaseVersion(releases: CloudSkillRelease[]): string {
  const latest = releases[0]?.version ?? '0.0.0';
  const parts = latest.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
  return '0.1.0';
}
