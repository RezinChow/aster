import { listArtifacts, type SupplyArtifact } from '@/data/supply';

export type SkillLifecycle = 'active' | 'archived';

export type Skill = {
  id: string;
  name: string;
  slug: string;
  /** Git repo under Build → Sources */
  repoId: string;
  lifecycle: SkillLifecycle;
  description: string;
  author: string;
  tags: string[];
  /** Working-tree SKILL.md (read-only in fixture preview) */
  markdown: string;
  createdAt: string;
  updatedAt: string;
};

let skills: Skill[] = [];

function clone(skill: Skill): Skill {
  return { ...skill, tags: [...skill.tags] };
}

export function listSkills(): Skill[] {
  return skills.map(clone);
}

export function findSkill(id: string): Skill | undefined {
  const found = skills.find((s) => s.id === id);
  return found ? clone(found) : undefined;
}

function skillFixtureWriteClosed(): never {
  throw new Error(
    'skills.ts writes are closed; use skillsApi → a3s-api → Cloud Assets',
  );
}

export function createSkill(_input: {
  name: string;
  slug?: string;
  description?: string;
  author?: string;
  tags?: string[];
  markdown?: string;
}): Skill {
  return skillFixtureWriteClosed();
}

export function updateSkill(
  _id: string,
  _patch: Partial<Omit<Skill, 'id' | 'createdAt' | 'repoId' | 'slug'>>,
): Skill | undefined {
  return skillFixtureWriteClosed();
}

export function deleteSkill(_id: string): boolean {
  return skillFixtureWriteClosed();
}

/** Persist working tree into Build → Sources git repo. */
export function commitSkillSource(
  _id: string,
  _markdown: string,
  _message?: string,
): Skill | undefined {
  return skillFixtureWriteClosed();
}

export function buildSkillArtifact(_id: string): SupplyArtifact | undefined {
  return skillFixtureWriteClosed();
}

export function skillArtifacts(id: string): SupplyArtifact[] {
  const skill = findSkill(id);
  if (!skill) return [];
  return listArtifacts({ kind: 'skill', packageSlug: skill.slug });
}

export function latestSkillArtifact(id: string): SupplyArtifact | undefined {
  return skillArtifacts(id)
    .filter((a) => a.status === 'success')
    .reduce<SupplyArtifact | undefined>(
      (latest, a) => (!latest || a.builtAt > latest.builtAt ? a : latest),
      undefined,
    );
}

export type SkillBuildState = 'built' | 'source' | 'archived';

export function skillBuildState(skill: Skill): SkillBuildState {
  if (skill.lifecycle === 'archived') return 'archived';
  const arts = listArtifacts({ kind: 'skill', packageSlug: skill.slug });
  return arts.some((a) => a.status === 'success' && a.signed)
    ? 'built'
    : 'source';
}
