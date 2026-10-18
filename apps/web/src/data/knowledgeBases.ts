import {
  commitToSourceRepo,
  ensurePackageRepo,
  findSourceRepo,
} from '@/data/sources';
import {
  latestMarketRelease,
  listArtifacts,
  listPublishableArtifacts,
  publishMarketRelease,
  triggerPackageBuild,
  type MarketRelease,
  type SupplyArtifact,
} from '@/data/supply';

export type KnowledgeLifecycle = 'active' | 'archived';

export type KnowledgeDocument = {
  id: string;
  title: string;
  /** Relative path in the Git repo, e.g. docs/overview.md */
  path: string;
  markdown: string;
  updatedAt: string;
};

export type KnowledgeBase = {
  id: string;
  name: string;
  slug: string;
  /** Git repo under Build → Sources */
  repoId: string;
  lifecycle: KnowledgeLifecycle;
  description: string;
  owner: string;
  tags: string[];
  documents: KnowledgeDocument[];
  createdAt: string;
  updatedAt: string;
};

const EMPTY_DOC = `# 新文档

在此编写知识内容。支持标题、列表与代码块。
`;

let knowledgeBases: KnowledgeBase[] = [];

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

function cloneKb(kb: KnowledgeBase): KnowledgeBase {
  return {
    ...kb,
    tags: [...kb.tags],
    documents: kb.documents.map((d) => ({ ...d })),
  };
}

export function listKnowledgeBases(): KnowledgeBase[] {
  return knowledgeBases.map(cloneKb);
}

export function findKnowledgeBase(id: string): KnowledgeBase | undefined {
  const found = knowledgeBases.find((k) => k.id === id);
  return found ? cloneKb(found) : undefined;
}

export function createKnowledgeBase(input: {
  name: string;
  slug?: string;
  description?: string;
  owner?: string;
  tags?: string[];
}): KnowledgeBase {
  const slugBase = input.slug?.trim() || slugify(input.name) || 'kb';
  let slug = slugBase;
  let n = 1;
  while (knowledgeBases.some((k) => k.slug === slug)) {
    slug = `${slugBase}-${n++}`;
  }
  const repo = ensurePackageRepo({ kind: 'knowledge', slug });
  const today = nowDate();
  const kb: KnowledgeBase = {
    id: `kb_${Date.now().toString(36)}`,
    name: input.name.trim(),
    slug,
    repoId: repo.id,
    lifecycle: 'active',
    description: input.description?.trim() ?? '',
    owner: input.owner?.trim() || '本地用户',
    tags: input.tags ?? [],
    documents: [
      {
        id: `doc_${Date.now().toString(36)}`,
        title: '首页',
        path: 'docs/index.md',
        markdown: EMPTY_DOC,
        updatedAt: today,
      },
    ],
    createdAt: today,
    updatedAt: today,
  };
  knowledgeBases = [kb, ...knowledgeBases];
  return cloneKb(kb);
}

export function updateKnowledgeBase(
  id: string,
  patch: Partial<Omit<KnowledgeBase, 'id' | 'createdAt' | 'repoId' | 'slug'>>,
): KnowledgeBase | undefined {
  const idx = knowledgeBases.findIndex((k) => k.id === id);
  if (idx < 0) return undefined;
  const current = knowledgeBases[idx]!;
  const next: KnowledgeBase = {
    ...current,
    ...patch,
    tags: patch.tags ? [...patch.tags] : [...current.tags],
    documents: patch.documents
      ? patch.documents.map((d) => ({ ...d }))
      : current.documents.map((d) => ({ ...d })),
    updatedAt: nowDate(),
  };
  knowledgeBases = knowledgeBases.map((k, i) => (i === idx ? next : k));
  return cloneKb(next);
}

export function deleteKnowledgeBase(id: string): boolean {
  const before = knowledgeBases.length;
  knowledgeBases = knowledgeBases.filter((k) => k.id !== id);
  return knowledgeBases.length < before;
}

export function upsertKnowledgeDocument(
  kbId: string,
  doc: { id?: string; title: string; path?: string; markdown: string },
): KnowledgeBase | undefined {
  const kb = findKnowledgeBase(kbId);
  if (!kb) return undefined;
  const today = nowDate();
  let documents = kb.documents;
  if (doc.id) {
    documents = documents.map((d) =>
      d.id === doc.id
        ? {
            ...d,
            title: doc.title,
            path: doc.path ?? d.path,
            markdown: doc.markdown,
            updatedAt: today,
          }
        : d,
    );
  } else {
    const slug = slugify(doc.title) || 'doc';
    documents = [
      {
        id: `doc_${Date.now().toString(36)}`,
        title: doc.title,
        path: doc.path ?? `docs/${slug}.md`,
        markdown: doc.markdown || EMPTY_DOC,
        updatedAt: today,
      },
      ...documents,
    ];
  }
  return updateKnowledgeBase(kbId, { documents });
}

export function deleteKnowledgeDocument(
  kbId: string,
  docId: string,
): KnowledgeBase | undefined {
  const kb = findKnowledgeBase(kbId);
  if (!kb) return undefined;
  if (kb.documents.length <= 1) return kb;
  return updateKnowledgeBase(kbId, {
    documents: kb.documents.filter((d) => d.id !== docId),
  });
}

/** Commit all docs into Build → Sources git repo. */
export function commitKnowledgeSource(
  id: string,
  message?: string,
): KnowledgeBase | undefined {
  const kb = findKnowledgeBase(id);
  if (!kb) return undefined;
  const repo = commitToSourceRepo(
    kb.repoId,
    message?.trim() || `docs(${kb.slug}): update knowledge docs`,
  );
  if (!repo) return undefined;
  return updateKnowledgeBase(id, {});
}

export function buildKnowledgeArtifact(id: string): SupplyArtifact | undefined {
  const kb = findKnowledgeBase(id);
  if (!kb) return undefined;
  const repo = findSourceRepo(kb.repoId);
  if (!repo) return undefined;
  const { artifact } = triggerPackageBuild({
    kind: 'knowledge',
    packageSlug: kb.slug,
    repoId: kb.repoId,
    sourceRevision: repo.latestRevision,
  });
  return artifact;
}

export function publishKnowledgeToMarket(
  id: string,
  artifactId: string,
): MarketRelease | undefined {
  return publishMarketRelease({
    kind: 'knowledge',
    packageId: id,
    artifactId,
  });
}

export function knowledgeMarketRelease(id: string): MarketRelease | undefined {
  return latestMarketRelease(id);
}

export function knowledgePublishableArtifacts(id: string): SupplyArtifact[] {
  const kb = findKnowledgeBase(id);
  if (!kb) return [];
  return listPublishableArtifacts({
    kind: 'knowledge',
    packageId: id,
    packageSlug: kb.slug,
  });
}

export function knowledgeArtifacts(id: string): SupplyArtifact[] {
  const kb = findKnowledgeBase(id);
  if (!kb) return [];
  return listArtifacts({ kind: 'knowledge', packageSlug: kb.slug });
}

export type KnowledgeMarketState = 'listed' | 'built' | 'source' | 'archived';

export function knowledgeMarketState(kb: KnowledgeBase): KnowledgeMarketState {
  if (kb.lifecycle === 'archived') return 'archived';
  if (latestMarketRelease(kb.id)) return 'listed';
  const arts = listArtifacts({ kind: 'knowledge', packageSlug: kb.slug });
  if (arts.some((a) => a.status === 'success' && a.signed)) return 'built';
  return 'source';
}
