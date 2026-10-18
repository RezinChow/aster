import { apiRequest as request } from '@/lib/apiClient';
import {
  fetchAssetDownload,
  queryString,
  type AssetCategory,
  type AssetDownload,
  type AssetPage,
  type FacetCount,
} from '@/lib/assetHubApi';

const BASE = '/assets/skills';

export type SkillCard = {
  slug: string;
  name: string;
  description: string;
  category: AssetCategory;
  tags: string[];
  author: string;
  version: string;
  color: string;
  featured: boolean;
  enabled: boolean;
  iconUrl?: string | null;
  fileCount: number;
  size: number;
  installs: number;
  updatedAt: number;
};

export type SkillFile = { path: string; size: number };

export type Skill = SkillCard & {
  license: string;
  homepage?: string | null;
  position: number;
  digest: string;
  files: SkillFile[];
  readme: string;
  createdAt: number;
  prompts: string[];
};

export type SkillFilePreview = { path: string; size: number; text?: string | null };

export type SkillFacets = {
  total: number;
  categories: FacetCount[];
  authors: FacetCount[];
  tags: FacetCount[];
};

export type SkillSort = 'recommended' | 'installs' | 'updated' | 'name';

export type SkillSearch = {
  q?: string;
  category?: string;
  tag?: string;
  author?: string;
  status?: string;
  sort?: SkillSort;
  page?: number;
  pageSize?: number;
};

/** Blank name/description/version/author/license take what `SKILL.md` declares. */
export type SkillWrite = {
  slug?: string;
  name: string;
  description: string;
  category: AssetCategory;
  tags: string[];
  author: string;
  version: string;
  /** Omit to keep the package list. An empty array clears it. */
  prompts?: string[];
  license: string;
  homepage?: string;
  color: string;
  featured: boolean;
  position: number;
  removeIcon?: boolean;
};

function skillPath(slug: string): string {
  return `${BASE}/${encodeURIComponent(slug)}`;
}

function writeBody(write: SkillWrite, files: { pkg?: File | null; icon?: File | null }): BodyInit {
  if (!files.pkg && !files.icon) return JSON.stringify(write);
  const form = new FormData();
  form.set('skill', JSON.stringify(write));
  if (files.pkg) form.set('package', files.pkg, files.pkg.name);
  if (files.icon) form.set('icon', files.icon, files.icon.name);
  return form;
}

export function searchSkills(search: SkillSearch): Promise<AssetPage<SkillCard>> {
  return request(`${BASE}${queryString(search)}`);
}

export function skillFacets(): Promise<SkillFacets> {
  return request(`${BASE}/facets`);
}

export function getSkill(slug: string): Promise<Skill> {
  return request(skillPath(slug));
}

export function getSkillFile(slug: string, path: string): Promise<SkillFilePreview> {
  return request(`${skillPath(slug)}/file${queryString({ path })}`);
}

export function createSkill(
  write: SkillWrite,
  files: { pkg: File; icon?: File | null },
): Promise<Skill> {
  return request(BASE, { method: 'POST', body: writeBody(write, files) });
}

export function updateSkill(
  slug: string,
  write: SkillWrite,
  files: { pkg?: File | null; icon?: File | null } = {},
): Promise<Skill> {
  const { slug: _slug, ...rest } = write;
  return request(skillPath(slug), { method: 'PUT', body: writeBody(rest, files) });
}

export function setSkillEnabled(slug: string, enabled: boolean): Promise<Skill> {
  return request(`${skillPath(slug)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function deleteSkill(slug: string): Promise<{ ok: boolean }> {
  return request(skillPath(slug), { method: 'DELETE' });
}

export function downloadSkillPackage(slug: string): Promise<AssetDownload> {
  return fetchAssetDownload(`${skillPath(slug)}/package`, `${slug}.zip`);
}
