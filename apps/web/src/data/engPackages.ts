/** Resolve engineering packages bound to kense-labs source repos. */

import {
  CODE_PACKAGE_KINDS,
  codePackageMarketState,
  findCodePackage,
  listCodePackages,
  type CodePackage,
  type CodePackageKind,
  type CodePackageMarketState,
} from '@/data/codePackages';
import {
  findKnowledgeBase,
  knowledgeMarketState,
  listKnowledgeBases,
  type KnowledgeBase,
  type KnowledgeMarketState,
} from '@/data/knowledgeBases';
import {
  findSkill,
  listSkills,
  skillBuildState,
  type Skill,
  type SkillBuildState,
} from '@/data/skills';
import {
  findSourceRepo,
  type OrgPackageKind,
  type SourceRepo,
} from '@/data/sources';
import {
  listArtifacts,
  listPublishableArtifacts,
  listPipelineRuns,
  latestMarketRelease,
  type PipelineRun,
  type SupplyArtifact,
  type MarketRelease,
} from '@/data/supply';

export type EngMarketState =
  | SkillBuildState
  | KnowledgeMarketState
  | CodePackageMarketState;

export type ResolvedEngPackage =
  | {
      kind: 'skill';
      packageId: string;
      name: string;
      slug: string;
      state: SkillBuildState;
      skill: Skill;
    }
  | {
      kind: 'knowledge';
      packageId: string;
      name: string;
      slug: string;
      state: KnowledgeMarketState;
      kb: KnowledgeBase;
    }
  | {
      kind: CodePackageKind;
      packageId: string;
      name: string;
      slug: string;
      state: CodePackageMarketState;
      pkg: CodePackage;
    };

export type EngCodeEntry =
  | { id: string; path: string; language: string; content: string }
  | { id: string; path: string; language: 'markdown'; content: string };

export function resolvePackageForRepo(
  repoId: string,
): ResolvedEngPackage | undefined {
  const skill = listSkills().find((s) => s.repoId === repoId);
  if (skill) {
    return {
      kind: 'skill',
      packageId: skill.id,
      name: skill.name,
      slug: skill.slug,
      state: skillBuildState(skill),
      skill,
    };
  }
  const kb = listKnowledgeBases().find((k) => k.repoId === repoId);
  if (kb) {
    return {
      kind: 'knowledge',
      packageId: kb.id,
      name: kb.name,
      slug: kb.slug,
      state: knowledgeMarketState(kb),
      kb,
    };
  }
  for (const kind of CODE_PACKAGE_KINDS) {
    const pkg = listCodePackages(kind).find((p) => p.repoId === repoId);
    if (pkg) {
      return {
        kind,
        packageId: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        state: codePackageMarketState(pkg),
        pkg,
      };
    }
  }
  return undefined;
}

export function resolvePackageById(
  kind: OrgPackageKind,
  packageId: string,
): ResolvedEngPackage | undefined {
  if (kind === 'skill') {
    const skill = findSkill(packageId);
    if (!skill) return undefined;
    return {
      kind: 'skill',
      packageId: skill.id,
      name: skill.name,
      slug: skill.slug,
      state: skillBuildState(skill),
      skill,
    };
  }
  if (kind === 'knowledge') {
    const kb = findKnowledgeBase(packageId);
    if (!kb) return undefined;
    return {
      kind: 'knowledge',
      packageId: kb.id,
      name: kb.name,
      slug: kb.slug,
      state: knowledgeMarketState(kb),
      kb,
    };
  }
  const pkg = findCodePackage(kind, packageId);
  if (!pkg) return undefined;
  return {
    kind,
    packageId: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    state: codePackageMarketState(pkg),
    pkg,
  };
}

export function engCodeEntries(
  resolved: ResolvedEngPackage,
): EngCodeEntry[] {
  if (resolved.kind === 'skill') {
    return [
      {
        id: 'readme',
        path: 'README.md',
        language: 'markdown',
        content: `# ${resolved.skill.name}

${resolved.skill.description || 'Skill package.'}

## 源码

- \`SKILL.md\` — 技能说明与指令
`,
      },
      {
        id: 'skill-md',
        path: 'SKILL.md',
        language: 'markdown',
        content: resolved.skill.markdown,
      },
    ];
  }
  if (resolved.kind === 'knowledge') {
    const docs = resolved.kb.documents.map((d) => ({
      id: d.id,
      path: d.path.includes('/') ? d.path : `docs/${d.path}`,
      language: 'markdown' as const,
      content: d.markdown,
    }));
    return [
      {
        id: 'readme',
        path: 'README.md',
        language: 'markdown',
        content: `# ${resolved.kb.name}

${resolved.kb.description || 'Knowledge base.'}

## 文档

${docs.map((d) => `- [\`${d.path}\`](${d.path})`).join('\n')}
`,
      },
      ...docs,
    ];
  }
  const files = resolved.pkg.files.map((f) => ({
    id: f.id,
    path: f.path,
    language: f.language,
    content: f.content,
  }));
  const hasReadme = files.some((f) => f.path.toLowerCase() === 'readme.md');
  if (hasReadme) return files;
  return [
    {
      id: 'readme',
      path: 'README.md',
      language: 'markdown',
      content: `# ${resolved.pkg.name}

${resolved.pkg.description || 'Package sources.'}

## 文件

${files.map((f) => `- \`${f.path}\``).join('\n')}
`,
    },
    ...files,
  ];
}

export function engArtifacts(resolved: ResolvedEngPackage): SupplyArtifact[] {
  return listArtifacts({
    kind: resolved.kind,
    packageSlug: resolved.slug,
  });
}

export function engPublishable(resolved: ResolvedEngPackage): SupplyArtifact[] {
  return listPublishableArtifacts({
    kind: resolved.kind,
    packageId: resolved.packageId,
    packageSlug: resolved.slug,
  });
}

export function engPipelineRuns(repo: SourceRepo): PipelineRun[] {
  const resolved = resolvePackageForRepo(repo.id);
  return listPipelineRuns({
    repoId: repo.id,
    ...(resolved ? { packageSlug: resolved.slug } : {}),
  });
}

export function engLatestRelease(
  resolved: ResolvedEngPackage,
): MarketRelease | undefined {
  return latestMarketRelease(resolved.packageId);
}

export function findRepoForPackage(
  kind: OrgPackageKind,
  packageId: string,
): SourceRepo | undefined {
  const resolved = resolvePackageById(kind, packageId);
  if (!resolved) return undefined;
  if (resolved.kind === 'skill') return findSourceRepo(resolved.skill.repoId);
  if (resolved.kind === 'knowledge') return findSourceRepo(resolved.kb.repoId);
  return findSourceRepo(resolved.pkg.repoId);
}
