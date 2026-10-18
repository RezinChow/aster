import { apiRequest as request } from '@/lib/apiClient';
import { queryString, type AssetPage, type FacetCount } from '@/lib/assetHubApi';

const BASE = '/assets/plugins';

export const PLUGIN_SURFACES = ['skill', 'mcp', 'tool', 'ui', 'flow', 'okf', 'plugin'] as const;
export type PluginSurface = (typeof PLUGIN_SURFACES)[number];

export const PLUGIN_CATEGORIES = [
  'general',
  'learning',
  'developer',
  'experience',
  'accessibility',
  'art-design',
  'privacy-security',
  'lifestyle',
] as const;
export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];

export type PluginFile = {
  path: string;
  size: number;
  sha256: string;
  text?: string | null;
};

export type PluginCard = {
  publisher: string;
  name: string;
  title?: string;
  version: string;
  category: PluginCategory;
  description: string;
  surfaces: PluginSurface[];
  enabled: boolean;
  featured: boolean;
  installs: number;
  color: string;
  updatedAt: number;
  createdAt: number;
  logoUrl?: string | null;
  coverUrl?: string | null;
  files?: PluginFile[];
};

export type PluginFacets = {
  total: number;
  surfaces: FacetCount[];
  categories: FacetCount[];
};

export type PluginSort = 'recommended' | 'installs' | 'updated' | 'name';

export type PluginSearch = {
  q?: string;
  surface?: string;
  category?: string;
  status?: string;
  sort?: PluginSort;
  page?: number;
  pageSize?: number;
};

export type PackageVisibility = 'public' | 'namespace';

export type PluginWrite = {
  publisher: string;
  name: string;
  title?: string;
  version: string;
  category: PluginCategory;
  description: string;
  surfaces: PluginSurface[];
  featured: boolean;
  visibility?: PackageVisibility;
  note?: string;
};

export type PackageRelease = {
  version: string;
  digest: string;
  updatedAt: number;
  note: string;
};

export type PathChange = {
  path: string;
  kind: string;
  diff?: string | null;
};

export type PluginFiles = {
  logo?: File | null;
  cover?: File | null;
  pkg?: File | null;
};

export function pluginId(plugin: Pick<PluginCard, 'publisher' | 'name'>): string {
  return `${plugin.publisher}/${plugin.name}`;
}

export function pluginCategoryKey(category: PluginCategory) {
  return ('assets.plugins.category.' + category) as 'assets.plugins.category.general';
}

export function pluginSurfaceKey(surface: PluginSurface) {
  switch (surface) {
    case 'skill':
      return 'assets.plugins.surface.skill' as const;
    case 'mcp':
      return 'assets.plugins.surface.mcp' as const;
    case 'tool':
      return 'assets.plugins.surface.tool' as const;
    case 'ui':
      return 'assets.plugins.surface.ui' as const;
    case 'flow':
      return 'assets.plugins.surface.flow' as const;
    case 'okf':
      return 'assets.plugins.surface.okf' as const;
    case 'plugin':
      return 'assets.plugins.surface.plugin' as const;
  }
}

function pluginPath(publisher: string, name: string): string {
  return `${BASE}/${encodeURIComponent(publisher)}/${encodeURIComponent(name)}`;
}

export function searchPlugins(search: PluginSearch): Promise<AssetPage<PluginCard>> {
  return request(`${BASE}${queryString(search)}`);
}

export function pluginFacets(surface?: string): Promise<PluginFacets> {
  return request(`${BASE}/facets${queryString({ surface })}`);
}

export function getPlugin(publisher: string, name: string): Promise<PluginCard> {
  return request(pluginPath(publisher, name));
}

export function currentNamespace(scope: 'org' | 'member'): Promise<{ name: string | null }> {
  return request(`${BASE}/namespaces/current${queryString({ scope })}`);
}

export function listReleases(publisher: string, name: string): Promise<PackageRelease[]> {
  return request(`${pluginPath(publisher, name)}/releases`);
}

export function getGeneration(
  publisher: string,
  name: string,
  version: string,
  digest: string,
): Promise<PluginCard> {
  return request(`${pluginPath(publisher, name)}/generation${queryString({ version, digest })}`);
}

export function compareReleases(
  publisher: string,
  name: string,
  before: PackageRelease,
  after: PackageRelease,
): Promise<PathChange[]> {
  return request(
    `${pluginPath(publisher, name)}/compare${queryString({
      beforeVersion: before.version,
      beforeDigest: before.digest,
      afterVersion: after.version,
      afterDigest: after.digest,
    })}`,
  );
}

function writeBody(write: PluginWrite | Omit<PluginWrite, 'publisher' | 'name'>, files?: PluginFiles): BodyInit {
  const logo = files?.logo ?? null;
  const cover = files?.cover ?? null;
  const pkg = files?.pkg ?? null;
  if (!logo && !cover && !pkg) return JSON.stringify(write);
  const form = new FormData();
  form.set('plugin', JSON.stringify(write));
  if (logo) form.set('logo', logo, logo.name);
  if (cover) form.set('cover', cover, cover.name);
  if (pkg) form.set('package', pkg, pkg.name);
  return form;
}

export function createPlugin(write: PluginWrite, files: PluginFiles): Promise<PluginCard> {
  return request(BASE, { method: 'POST', body: writeBody(write, files) });
}

export function updatePlugin(
  publisher: string,
  name: string,
  write: Omit<PluginWrite, 'publisher' | 'name'>,
  files?: PluginFiles,
): Promise<PluginCard> {
  return request(pluginPath(publisher, name), { method: 'PUT', body: writeBody(write, files) });
}

export function setPluginEnabled(publisher: string, name: string, enabled: boolean): Promise<PluginCard> {
  return request(`${pluginPath(publisher, name)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function deletePlugin(publisher: string, name: string): Promise<{ ok: boolean }> {
  return request(pluginPath(publisher, name), { method: 'DELETE' });
}
