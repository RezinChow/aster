/** Source connections and repos. Empty until a Git provider is connected. */

export type GitProvider = 'github' | 'gitlab' | 'gitea';

export type ConnectionStatus = 'ready' | 'degraded' | 'error' | 'pending';

export type WebhookHealth = 'ok' | 'failing' | 'unknown';

export type OrgPackageKind =
  | 'skill'
  | 'knowledge'
  | 'applet'
  | 'api'
  | 'connector'
  | 'tool'
  | 'agent'
  | 'workflow'
  | 'model';

export type SourceConnection = {
  id: string;
  provider: GitProvider;
  account: string;
  installId: string;
  webhook: WebhookHealth;
  repoCount: number;
  status: ConnectionStatus;
  connectedAtEpoch: number;
};

export type SourceRepo = {
  id: string;
  connectionId: string;
  fullName: string;
  defaultBranch: string;
  latestRevision: string;
  latestMessage: string;
  latestAtEpoch: number;
  subscribed: boolean;
  /** Package kind when this repo is under kense-labs/{kind}/… */
  packageKind?: OrgPackageKind;
};

export type SourceRevision = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  committedAtEpoch: number;
};

export type WebhookDelivery = {
  id: string;
  connectionId: string;
  event: string;
  status: 'delivered' | 'failed' | 'pending';
  attempts: number;
  atEpoch: number;
  latencyMs: number;
};

export const sourceConnections: SourceConnection[] = [];

export let sourceRepos: SourceRepo[] = [];

export const sourceRevisionsByRepo: Record<string, SourceRevision[]> = {};

export const webhookDeliveries: WebhookDelivery[] = [];

export function providerLabel(provider: GitProvider): string {
  switch (provider) {
    case 'github':
      return 'GitHub';
    case 'gitlab':
      return 'GitLab';
    case 'gitea':
      return 'Gitea';
  }
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export const A3S_LABS_ORG = 'kense-labs';

const KIND_PATH: Record<OrgPackageKind, string> = {
  skill: 'skills',
  knowledge: 'knowledge',
  applet: 'applets',
  api: 'services',
  connector: 'connectors',
  tool: 'tools',
  agent: 'agents',
  workflow: 'workflows',
  model: 'models',
};

const PATH_TO_KIND: Record<string, OrgPackageKind> = {
  skills: 'skill',
  knowledge: 'knowledge',
  applets: 'applet',
  services: 'api',
  /** @deprecated legacy path — still resolve existing bookmarks */
  'api-services': 'api',
  connectors: 'connector',
  tools: 'tool',
  agents: 'agent',
  workflows: 'workflow',
  models: 'model',
};

export function orgKindPath(kind: OrgPackageKind): string {
  return KIND_PATH[kind];
}

/** Console list URL for a code-hosting asset kind (`/admin/assets/sources/agents`, …). */
export function engListPath(kind: OrgPackageKind): string {
  return `/admin/assets/sources/${KIND_PATH[kind]}`;
}

export function engKindFromPathSegment(
  segment: string,
): OrgPackageKind | undefined {
  return PATH_TO_KIND[segment];
}

export function parseOrgRepoFullName(fullName: string): {
  org: string;
  kindPath: string;
  slug: string;
  kind: OrgPackageKind;
} | undefined {
  const parts = fullName.split('/');
  if (parts.length < 3) return undefined;
  const [org, kindPath, ...slugParts] = parts;
  if (!org || !kindPath || slugParts.length === 0) return undefined;
  const kind = PATH_TO_KIND[kindPath];
  if (!kind) return undefined;
  return { org, kindPath, slug: slugParts.join('/'), kind };
}

export function repoPathInOrg(repo: SourceRepo): string {
  const parsed = parseOrgRepoFullName(repo.fullName);
  if (!parsed) {
    const i = repo.fullName.indexOf('/');
    return i >= 0 ? repo.fullName.slice(i + 1) : repo.fullName;
  }
  return `${parsed.kindPath}/${parsed.slug}`;
}

export function listOrgRepos(org: string = A3S_LABS_ORG): SourceRepo[] {
  return sourceRepos
    .filter((r) => r.fullName.startsWith(`${org}/`))
    .map((r) => {
      const parsed = parseOrgRepoFullName(r.fullName);
      return {
        ...r,
        packageKind: r.packageKind ?? parsed?.kind,
      };
    });
}

export function findSourceRepo(id: string): SourceRepo | undefined {
  const found = sourceRepos.find((r) => r.id === id);
  if (!found) return undefined;
  const parsed = parseOrgRepoFullName(found.fullName);
  return {
    ...found,
    packageKind: found.packageKind ?? parsed?.kind,
  };
}

export function listSourceRepos(): SourceRepo[] {
  return sourceRepos.map((r) => {
    const parsed = parseOrgRepoFullName(r.fullName);
    return { ...r, packageKind: r.packageKind ?? parsed?.kind };
  });
}

/** Create (or reuse) a subscribed Git repo under the Build Sources group. */
export function ensurePackageRepo(input: {
  kind: OrgPackageKind;
  slug: string;
  connectionId?: string;
}): SourceRepo {
  const prefixByKind: Record<OrgPackageKind, string> = {
    skill: 'kense-labs/skills',
    knowledge: 'kense-labs/knowledge',
    applet: 'kense-labs/applets',
    api: 'kense-labs/services',
    connector: 'kense-labs/connectors',
    tool: 'kense-labs/tools',
    agent: 'kense-labs/agents',
    workflow: 'kense-labs/workflows',
    model: 'kense-labs/models',
  };
  const initMessageByKind: Record<OrgPackageKind, string> = {
    skill: 'chore: init SKILL.md',
    knowledge: 'chore: init knowledge docs',
    applet: 'chore: init applet package',
    api: 'chore: init api service',
    connector: 'chore: init connector',
    tool: 'chore: init tool package',
    agent: 'chore: init agent package',
    workflow: 'chore: init workflow package',
    model: 'chore: init model package',
  };
  const prefix = prefixByKind[input.kind];
  const fullName = `${prefix}/${input.slug}`;
  const existing = sourceRepos.find((r) => r.fullName === fullName);
  if (existing) return { ...existing };

  const id = `repo_${input.kind}_${input.slug.replace(/[^a-z0-9]+/g, '_')}`;
  const sha = `${Date.now().toString(16)}${'0'.repeat(24)}`.slice(0, 32);
  const message = initMessageByKind[input.kind];
  const repo: SourceRepo = {
    id,
    connectionId: input.connectionId ?? 'conn_local',
    fullName,
    defaultBranch: 'main',
    latestRevision: sha,
    latestMessage: message,
    latestAtEpoch: Math.floor(Date.now() / 1000),
    subscribed: true,
    packageKind: input.kind,
  };
  sourceRepos.unshift(repo);
  sourceRevisionsByRepo[id] = [
    {
      sha,
      shortSha: sha.slice(0, 7),
      message,
      author: 'local@example.com',
      committedAtEpoch: Math.floor(Date.now() / 1000),
    },
  ];
  return { ...repo };
}

/** Commit working-tree content into the linked Source repo (mock). */
export function commitToSourceRepo(
  repoId: string,
  message: string,
): SourceRepo | undefined {
  const idx = sourceRepos.findIndex((r) => r.id === repoId);
  if (idx < 0) return undefined;
  const sha = `${Date.now().toString(16)}${'abcdef0123456789'.repeat(2)}`.slice(
    0,
    32,
  );
  const epoch = Math.floor(Date.now() / 1000);
  const next: SourceRepo = {
    ...sourceRepos[idx]!,
    latestRevision: sha,
    latestMessage: message,
    latestAtEpoch: epoch,
  };
  sourceRepos[idx] = next;
  const revs = sourceRevisionsByRepo[repoId] ?? [];
  sourceRevisionsByRepo[repoId] = [
    {
      sha,
      shortSha: sha.slice(0, 7),
      message,
      author: 'local@example.com',
      committedAtEpoch: epoch,
    },
    ...revs,
  ];
  return { ...next };
}

export function removeSourceRepo(id: string): boolean {
  const before = sourceRepos.length;
  sourceRepos = sourceRepos.filter((repo) => repo.id !== id);
  delete sourceRevisionsByRepo[id];
  return sourceRepos.length < before;
}
