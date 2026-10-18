import {
  commitToSourceRepo,
  ensurePackageRepo,
  findSourceRepo,
  removeSourceRepo,
} from '@/data/sources';
import { emptyFlowSource } from '@/lib/a3sFlowFile';
import {
  latestMarketRelease,
  listArtifacts,
  listPublishableArtifacts,
  publishMarketRelease,
  triggerPackageBuild,
  type MarketRelease,
  type PackageKind,
  type SupplyArtifact,
} from '@/data/supply';

export type CodePackageKind = Extract<
  PackageKind,
  'applet' | 'api' | 'connector' | 'tool' | 'agent' | 'workflow' | 'model'
>;

export const CODE_PACKAGE_KINDS: CodePackageKind[] = [
  'applet',
  'api',
  'connector',
  'tool',
  'agent',
  'workflow',
  'model',
];

export type CodePackageLifecycle = 'active' | 'archived';

export type CodeFile = {
  id: string;
  path: string;
  language: string;
  content: string;
};

export type CodePackage = {
  id: string;
  kind: CodePackageKind;
  name: string;
  slug: string;
  repoId: string;
  lifecycle: CodePackageLifecycle;
  description: string;
  author: string;
  tags: string[];
  files: CodeFile[];
  createdAt: string;
  updatedAt: string;
  /** Platform workflow required by Kense OS. Cannot be deleted. */
  system?: boolean;
};

export type CodePackageMarketState =
  | 'listed'
  | 'built'
  | 'source'
  | 'archived';

const SEED: CodePackage[] = [];

let packages: CodePackage[] = SEED.map(clonePackage);

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function clonePackage(pkg: CodePackage): CodePackage {
  return {
    ...pkg,
    tags: [...pkg.tags],
    files: pkg.files.map((f) => ({ ...f })),
  };
}

function defaultFiles(kind: CodePackageKind, slug: string): CodeFile[] {
  const readme: CodeFile = {
    id: `f_${Date.now().toString(36)}_readme`,
    path: 'README.md',
    language: 'markdown',
    content: `# ${slug}

Package sources under kense-labs.
`,
  };
  switch (kind) {
    case 'applet':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_manifest`,
          path: 'applet.json',
          language: 'json',
          content: `{\n  "name": "${slug}",\n  "entry": "src/index.ts"\n}\n`,
        },
        {
          id: `f_${Date.now().toString(36)}_index`,
          path: 'src/index.ts',
          language: 'typescript',
          content: `export function mount(el: HTMLElement) {\n  el.textContent = '${slug}';\n}\n`,
        },
      ];
    case 'api':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_openapi`,
          path: 'openapi.yaml',
          language: 'yaml',
          content: `openapi: 3.0.3\ninfo:\n  title: ${slug}\n  version: 0.1.0\npaths: {}\n`,
        },
        {
          id: `f_${Date.now().toString(36)}_handler`,
          path: 'src/handler.ts',
          language: 'typescript',
          content: `export async function handle() {\n  return { ok: true };\n}\n`,
        },
      ];
    case 'connector':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_manifest`,
          path: 'connector.json',
          language: 'json',
          content: `{\n  "name": "${slug}",\n  "auth": "oauth2"\n}\n`,
        },
        {
          id: `f_${Date.now().toString(36)}_sync`,
          path: 'src/sync.ts',
          language: 'typescript',
          content: `export async function sync() {\n  return { ok: true };\n}\n`,
        },
      ];
    case 'tool':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_manifest`,
          path: 'tool.json',
          language: 'json',
          content: `{\n  "name": "${slug}",\n  "schema": { "type": "object" }\n}\n`,
        },
        {
          id: `f_${Date.now().toString(36)}_run`,
          path: 'src/run.ts',
          language: 'typescript',
          content: `export async function run(input: Record<string, unknown>) {\n  return input;\n}\n`,
        },
      ];
    case 'agent':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_manifest`,
          path: 'agent.json',
          language: 'json',
          content: `{\n  "name": "${slug}",\n  "runtime": "a3s-agent",\n  "tools": []\n}\n`,
        },
        {
          id: `f_${Date.now().toString(36)}_policy`,
          path: 'src/policy.ts',
          language: 'typescript',
          content: `export function route(_input: Record<string, unknown>) {\n  return 'auto';\n}\n`,
        },
      ];
    case 'workflow':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_manifest`,
          path: 'workflow.json',
          language: 'json',
          content: emptyFlowSource(slug),
        },
      ];
    case 'model':
      return [
        readme,
        {
          id: `f_${Date.now().toString(36)}_manifest`,
          path: 'model.json',
          language: 'json',
          content: `{\n  "name": "${slug}",\n  "framework": "onnx",\n  "task": "custom"\n}\n`,
        },
        {
          id: `f_${Date.now().toString(36)}_eval`,
          path: 'eval/baseline.md',
          language: 'markdown',
          content: `# Eval baseline\n\nAdd metrics for ${slug}.\n`,
        },
      ];
  }
}

export function listCodePackages(kind: CodePackageKind): CodePackage[] {
  return packages.filter((p) => p.kind === kind).map(clonePackage);
}

export function findCodePackage(
  kind: CodePackageKind,
  id: string,
): CodePackage | undefined {
  const found = packages.find((p) => p.kind === kind && p.id === id);
  return found ? clonePackage(found) : undefined;
}

export function createCodePackage(
  kind: CodePackageKind,
  input: {
    name: string;
    slug?: string;
    description?: string;
    author?: string;
    tags?: string[];
  },
): CodePackage {
  const slugBase = input.slug?.trim() || slugify(input.name) || kind;
  let slug = slugBase;
  let n = 1;
  while (packages.some((p) => p.kind === kind && p.slug === slug)) {
    slug = `${slugBase}-${n++}`;
  }
  const repo = ensurePackageRepo({ kind, slug });
  const today = nowDate();
  const pkg: CodePackage = {
    id: `${kind.slice(0, 2)}_${Date.now().toString(36)}`,
    kind,
    name: input.name.trim(),
    slug,
    repoId: repo.id,
    lifecycle: 'active',
    description: input.description?.trim() ?? '',
    author: input.author?.trim() || '本地用户',
    tags: input.tags ?? [],
    files: defaultFiles(kind, slug),
    createdAt: today,
    updatedAt: today,
  };
  packages = [pkg, ...packages];
  return clonePackage(pkg);
}

export function updateCodePackage(
  kind: CodePackageKind,
  id: string,
  patch: Partial<
    Omit<CodePackage, 'id' | 'createdAt' | 'repoId' | 'slug' | 'kind'>
  >,
): CodePackage | undefined {
  const idx = packages.findIndex((p) => p.kind === kind && p.id === id);
  if (idx < 0) return undefined;
  const current = packages[idx]!;
  const next: CodePackage = {
    ...current,
    ...patch,
    system: current.system,
    tags: patch.tags ? [...patch.tags] : [...current.tags],
    files: patch.files
      ? patch.files.map((f) => ({ ...f }))
      : current.files.map((f) => ({ ...f })),
    updatedAt: nowDate(),
  };
  packages = packages.map((p, i) => (i === idx ? next : p));
  return clonePackage(next);
}

export function isSystemRepo(repoId: string): boolean {
  return packages.some((pkg) => pkg.repoId === repoId && pkg.system === true);
}

export function deleteCodePackage(kind: CodePackageKind, id: string): boolean {
  const target = packages.find((pkg) => pkg.kind === kind && pkg.id === id);
  if (!target || target.system) return false;
  packages = packages.filter((pkg) => pkg !== target);
  removeSourceRepo(target.repoId);
  return true;
}

export function upsertCodeFile(
  kind: CodePackageKind,
  id: string,
  file: { id?: string; path: string; language: string; content: string },
): CodePackage | undefined {
  const pkg = findCodePackage(kind, id);
  if (!pkg) return undefined;
  let files = pkg.files;
  if (file.id) {
    files = files.map((f) =>
      f.id === file.id
        ? {
            ...f,
            path: file.path,
            language: file.language,
            content: file.content,
          }
        : f,
    );
  } else {
    files = [
      {
        id: `f_${Date.now().toString(36)}`,
        path: file.path,
        language: file.language,
        content: file.content,
      },
      ...files,
    ];
  }
  return updateCodePackage(kind, id, { files });
}

export function deleteCodeFile(
  kind: CodePackageKind,
  id: string,
  fileId: string,
): CodePackage | undefined {
  const pkg = findCodePackage(kind, id);
  if (!pkg || pkg.files.length <= 1) return pkg;
  return updateCodePackage(kind, id, {
    files: pkg.files.filter((f) => f.id !== fileId),
  });
}

export function commitCodePackageSource(
  kind: CodePackageKind,
  id: string,
  message?: string,
): CodePackage | undefined {
  const pkg = findCodePackage(kind, id);
  if (!pkg) return undefined;
  const repo = commitToSourceRepo(
    pkg.repoId,
    message?.trim() || `chore(${pkg.slug}): update package sources`,
  );
  if (!repo) return undefined;
  return updateCodePackage(kind, id, {});
}

export function buildCodePackageArtifact(
  kind: CodePackageKind,
  id: string,
): SupplyArtifact | undefined {
  const pkg = findCodePackage(kind, id);
  if (!pkg) return undefined;
  const repo = findSourceRepo(pkg.repoId);
  if (!repo) return undefined;
  const { artifact } = triggerPackageBuild({
    kind,
    packageSlug: pkg.slug,
    repoId: pkg.repoId,
    sourceRevision: repo.latestRevision,
  });
  return artifact;
}

export function publishCodePackageToMarket(
  kind: CodePackageKind,
  id: string,
  artifactId: string,
): MarketRelease | undefined {
  return publishMarketRelease({ kind, packageId: id, artifactId });
}

export function codePackageMarketRelease(
  id: string,
): MarketRelease | undefined {
  return latestMarketRelease(id);
}

export function codePackagePublishableArtifacts(
  kind: CodePackageKind,
  id: string,
): SupplyArtifact[] {
  const pkg = findCodePackage(kind, id);
  if (!pkg) return [];
  return listPublishableArtifacts({
    kind,
    packageId: id,
    packageSlug: pkg.slug,
  });
}

export function codePackageArtifacts(
  kind: CodePackageKind,
  id: string,
): SupplyArtifact[] {
  const pkg = findCodePackage(kind, id);
  if (!pkg) return [];
  return listArtifacts({ kind, packageSlug: pkg.slug });
}

export function codePackageMarketState(
  pkg: CodePackage,
): CodePackageMarketState {
  if (pkg.lifecycle === 'archived') return 'archived';
  if (latestMarketRelease(pkg.id)) return 'listed';
  const arts = listArtifacts({ kind: pkg.kind, packageSlug: pkg.slug });
  if (arts.some((a) => a.status === 'success' && a.signed)) return 'built';
  return 'source';
}

export const CODE_PACKAGE_LIST_PATH: Record<CodePackageKind, string> = {
  applet: '/admin/assets/sources/applets',
  api: '/admin/assets/sources/services',
  connector: '/admin/assets/sources/connectors',
  tool: '/admin/assets/sources/tools',
  agent: '/admin/assets/sources/agents',
  workflow: '/admin/assets/sources/workflows',
  model: '/admin/assets/models',
};
