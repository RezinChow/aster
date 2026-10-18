import { apiRequest as request } from '@/lib/apiClient';
import {
  queryString,
  type AssetCategory,
  type AssetPage,
  type FacetCount,
} from '@/lib/assetHubApi';

const BASE = '/assets/connectors';

export type McpTransport = 'stdio' | 'streamable_http' | 'sse';
export type ConnectorDeployment = 'hosted' | 'local';

export type ConnectorConfigField = {
  key: string;
  description: string;
  required: boolean;
  secret: boolean;
};

export type ConnectorTool = { name: string; description: string };

export type ConnectorCard = {
  slug: string;
  name: string;
  description: string;
  category: AssetCategory;
  tags: string[];
  provider: string;
  color: string;
  featured: boolean;
  enabled: boolean;
  iconUrl?: string | null;
  transport: McpTransport;
  deployment: ConnectorDeployment;
  toolCount: number;
  installs: number;
  updatedAt: number;
};

export type Connector = ConnectorCard & {
  homepage?: string | null;
  license: string;
  position: number;
  url?: string | null;
  command?: string | null;
  args: string[];
  config: ConnectorConfigField[];
  tools: ConnectorTool[];
  readme: string;
  /** `{ "mcpServers": { slug: … } }` snippet for MCP clients. */
  mcpConfig: unknown;
  createdAt: number;
};

export type ConnectorFacets = {
  total: number;
  categories: FacetCount[];
  deployments: FacetCount[];
  transports: FacetCount[];
  tags: FacetCount[];
};

export type ConnectorSort = 'recommended' | 'installs' | 'updated' | 'name';

export type ConnectorSearch = {
  q?: string;
  category?: string;
  transport?: string;
  deployment?: string;
  tag?: string;
  status?: string;
  sort?: ConnectorSort;
  page?: number;
  pageSize?: number;
};

export type ConnectorWrite = {
  slug?: string;
  name: string;
  description: string;
  category: AssetCategory;
  tags: string[];
  provider: string;
  homepage?: string;
  license: string;
  color: string;
  featured: boolean;
  position: number;
  transport: McpTransport;
  url?: string;
  command?: string;
  args: string[];
  config: ConnectorConfigField[];
  tools: ConnectorTool[];
  readme: string;
  removeIcon?: boolean;
};

function connectorPath(slug: string): string {
  return `${BASE}/${encodeURIComponent(slug)}`;
}

function writeBody(write: ConnectorWrite, icon?: File | null): BodyInit {
  if (!icon) return JSON.stringify(write);
  const form = new FormData();
  form.set('connector', JSON.stringify(write));
  form.set('icon', icon, icon.name);
  return form;
}

export function searchConnectors(search: ConnectorSearch): Promise<AssetPage<ConnectorCard>> {
  return request(`${BASE}${queryString(search)}`);
}

export function connectorFacets(): Promise<ConnectorFacets> {
  return request(`${BASE}/facets`);
}

export function getConnector(slug: string): Promise<Connector> {
  return request(connectorPath(slug));
}

export function createConnector(write: ConnectorWrite, icon?: File | null): Promise<Connector> {
  return request(BASE, { method: 'POST', body: writeBody(write, icon) });
}

export function updateConnector(
  slug: string,
  write: ConnectorWrite,
  icon?: File | null,
): Promise<Connector> {
  const { slug: _slug, ...rest } = write;
  return request(connectorPath(slug), { method: 'PUT', body: writeBody(rest, icon) });
}

export function setConnectorEnabled(slug: string, enabled: boolean): Promise<Connector> {
  return request(`${connectorPath(slug)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function deleteConnector(slug: string): Promise<{ ok: boolean }> {
  return request(connectorPath(slug), { method: 'DELETE' });
}
