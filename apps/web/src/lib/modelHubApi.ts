import { apiRequest as request } from '@/lib/apiClient';
import {
  fetchAssetDownload,
  queryString,
  type AssetDownload,
  type AssetPage,
  type FacetCount,
} from '@/lib/assetHubApi';

const BASE = '/assets/models';

export type ModelHubKind = 'huggingface' | 'modelscope';
export type ModelVisibility = 'public' | 'private';
export type TaskDomain = 'nlp' | 'multimodal' | 'cv' | 'audio' | 'science' | 'other';

export type HubModelSource = {
  hub: ModelHubKind;
  repo: string;
  revision?: string | null;
};

export type HubModelCard = {
  id: string;
  owner: string;
  name: string;
  summary: string;
  task: string;
  domain: TaskDomain;
  frameworks: string[];
  license: string;
  languages: string[];
  tags: string[];
  parameters: string;
  visibility: ModelVisibility;
  source?: HubModelSource | null;
  fileCount: number;
  size: number;
  downloads: number;
  likes: number;
  createdAt: number;
  updatedAt: number;
};

export type HubModelFile = {
  path: string;
  size: number;
  storage: 'stored' | 'remote';
  digest?: string | null;
  url?: string | null;
};

export type HubModel = HubModelCard & {
  readme: string;
  files: HubModelFile[];
};

export type ModelFacets = {
  total: number;
  tasks: FacetCount[];
  frameworks: FacetCount[];
  licenses: FacetCount[];
  languages: FacetCount[];
  owners: FacetCount[];
};

export type TaskDomainGroup = { domain: TaskDomain; tasks: string[] };

export type ModelSort = 'popular' | 'downloads' | 'likes' | 'updated' | 'created';

export type ModelSearch = {
  q?: string;
  domain?: string;
  task?: string;
  framework?: string;
  license?: string;
  language?: string;
  owner?: string;
  visibility?: string;
  origin?: string;
  sort?: ModelSort;
  page?: number;
  pageSize?: number;
};

export type ModelCardInput = {
  summary: string;
  task: string;
  frameworks: string[];
  license: string;
  languages: string[];
  tags: string[];
  parameters: string;
  readme: string;
  visibility: ModelVisibility;
};

export type ModelImportInput = {
  hub: ModelHubKind;
  repo: string;
  revision?: string;
  owner?: string;
  name?: string;
  visibility?: ModelVisibility;
};

function modelPath(owner: string, name: string): string {
  return `${BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

export function searchModels(search: ModelSearch): Promise<AssetPage<HubModelCard>> {
  return request(`${BASE}${queryString(search)}`);
}

export function modelFacets(): Promise<ModelFacets> {
  return request(`${BASE}/facets`);
}

export function modelTasks(): Promise<TaskDomainGroup[]> {
  return request(`${BASE}/tasks`);
}

export function getModel(owner: string, name: string): Promise<HubModel> {
  return request(modelPath(owner, name));
}

export function createModel(
  input: ModelCardInput & { owner: string; name: string },
): Promise<HubModel> {
  return request(BASE, { method: 'POST', body: JSON.stringify(input) });
}

export function importModel(input: ModelImportInput): Promise<HubModel> {
  return request(`${BASE}/imports`, { method: 'POST', body: JSON.stringify(input) });
}

export function updateModel(owner: string, name: string, input: ModelCardInput): Promise<HubModel> {
  return request(modelPath(owner, name), { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteModel(owner: string, name: string): Promise<{ ok: boolean }> {
  return request(modelPath(owner, name), { method: 'DELETE' });
}

export function syncModel(owner: string, name: string): Promise<HubModel> {
  return request(`${modelPath(owner, name)}/syncs`, { method: 'POST' });
}

export function uploadModelFile(
  owner: string,
  name: string,
  file: File,
  path?: string,
): Promise<HubModel> {
  const form = new FormData();
  form.set('file', file, file.name);
  if (path?.trim()) form.set('path', path.trim());
  return request(`${modelPath(owner, name)}/files`, { method: 'POST', body: form });
}

export function deleteModelFile(owner: string, name: string, path: string): Promise<HubModel> {
  return request(`${modelPath(owner, name)}/files${queryString({ path })}`, { method: 'DELETE' });
}

export function downloadModelFile(owner: string, name: string, path: string): Promise<AssetDownload> {
  return fetchAssetDownload(
    `${modelPath(owner, name)}/files/content${queryString({ path })}`,
    path.split('/').pop() ?? path,
  );
}
