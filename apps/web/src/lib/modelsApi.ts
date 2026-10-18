import { apiRequest as request } from '@/lib/apiClient';

export type HubInfo = {
  id: 'huggingface' | 'modelscope' | string;
  label: string;
  configured: boolean;
};

export type HubSearchHit = {
  repo_id: string;
  name: string;
  author?: string | null;
  downloads?: number | null;
  likes?: number | null;
  tags: string[];
  pipeline_tag?: string | null;
};

export type HubFile = {
  path: string;
  size: number;
};

export type HubRevision = {
  name: string;
  commit?: string | null;
};

export type HubRuntime = {
  library?: string | null;
  pipeline?: string | null;
  architectures?: string[];
  model_type?: string | null;
  dtypes?: string[];
  parameters?: number | null;
  auto_model?: string | null;
  processor?: string | null;
  weight_bytes?: number | null;
  backends?: string[];
  weight_formats?: string[];
};

export type HubRepoDetail = {
  repo_id: string;
  revision: string;
  license?: string | null;
  files: HubFile[];
  tags: string[];
  revisions?: HubRevision[];
  runtime?: HubRuntime | null;
};

export type ModelSummary = {
  id: string;
  hub: string;
  repo_id: string;
  display_name: string;
  created_at_epoch: number;
  content_digest?: string;
  engine?: string;
  quantization?: string;
  memory_bytes?: number;
  accelerators?: number;
  runtime?: HubRuntime | null;
};

export type ModelFile = {
  path: string;
  size_bytes: number;
  sha256: string;
  object_key: string;
};

export type ImportProgress = {
  bytes_done?: number;
  bytes_total?: number;
  files_done?: number;
  files_total?: number;
  current_file?: string | null;
};

export type ModelImport = {
  id: string;
  model_id: string;
  revision: string;
  status: string;
  progress: ImportProgress;
  error?: string | null;
  include_globs: string[];
  created_at_epoch: number;
  updated_at_epoch: number;
  files?: ModelFile[];
};

export type ModelDetail = {
  model: ModelSummary;
  imports: ModelImport[];
  manifest: ModelFile[];
};

export type StartImportResult = {
  id: string;
  status: string;
  model_id: string;
};

export function listHubs() {
  return request<HubInfo[]>('/models/hubs');
}

export function searchHub(
  hub: string,
  query: string,
  limit = 20,
  opts?: { sort?: string; pipeline?: string },
) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  const q = query.trim();
  if (q) params.set('q', q);
  if (opts?.sort?.trim()) params.set('sort', opts.sort.trim());
  if (opts?.pipeline?.trim() && opts.pipeline !== 'all') {
    params.set('pipeline', opts.pipeline.trim());
  }
  return request<HubSearchHit[]>(
    `/models/hubs/${encodeURIComponent(hub)}/search?${params}`,
  );
}

export function resolveHubRepo(
  hub: string,
  repoId: string,
  revision?: string,
) {
  const params = new URLSearchParams({ id: repoId });
  if (revision) params.set('revision', revision);
  return request<HubRepoDetail>(
    `/models/hubs/${encodeURIComponent(hub)}/repo?${params}`,
  );
}

export function listModels() {
  return request<ModelSummary[]>('/models');
}

export function getModel(id: string) {
  return request<ModelDetail>(`/models/${encodeURIComponent(id)}`);
}

export function listImports() {
  return request<ModelImport[]>('/models/imports');
}

export function getImport(id: string) {
  return request<ModelImport>(`/models/imports/${encodeURIComponent(id)}`);
}

export function startImport(input: {
  hub: string;
  repo_id: string;
  revision?: string;
  include_globs?: string[];
}) {
  return request<StartImportResult>('/models/imports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelImport(id: string) {
  return request<ModelImport>(
    `/models/imports/${encodeURIComponent(id)}/cancellations`,
    { method: 'POST' },
  );
}

export function retryImport(id: string) {
  return request<StartImportResult>(
    `/models/imports/${encodeURIComponent(id)}/retries`,
    { method: 'POST' },
  );
}

export function deleteModel(id: string) {
  return request<null>(`/models/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
