import { apiRequest as request } from '@/lib/apiClient';
import {
  queryString,
  type AssetCategory,
  type AssetPage,
  type FacetCount,
} from '@/lib/assetHubApi';

const BASE = '/assets/agents';

export type AgentCard = {
  slug: string;
  name: string;
  description: string;
  category: AssetCategory;
  tags: string[];
  color: string;
  featured: boolean;
  enabled: boolean;
  emoji: string;
  updatedAt: number;
  protocol?: string;
  protocolVersion?: number;
  packageVersion?: string;
  archiveDigest?: string;
  archiveSize?: number;
};

export type Agent = AgentCard & {
  prompt: string;
  position: number;
  createdAt: number;
};

export type AgentFacets = {
  total: number;
  categories: FacetCount[];
  tags: FacetCount[];
};

export type AgentSort = 'recommended' | 'updated' | 'name';

export type AgentSearch = {
  q?: string;
  category?: string;
  tag?: string;
  status?: string;
  sort?: AgentSort;
  page?: number;
  pageSize?: number;
};

export type AgentWrite = {
  slug?: string;
  name: string;
  description: string;
  prompt: string;
  emoji: string;
  category: AssetCategory;
  tags: string[];
  color: string;
  featured: boolean;
  position: number;
};

function agentPath(slug: string): string {
  return `${BASE}/${encodeURIComponent(slug)}`;
}

export function searchAgents(search: AgentSearch): Promise<AssetPage<AgentCard>> {
  return request(`${BASE}${queryString(search)}`);
}

export function agentFacets(): Promise<AgentFacets> {
  return request(`${BASE}/facets`);
}

export function getAgent(slug: string): Promise<Agent> {
  return request(agentPath(slug));
}

export function publishAcpCloudAgent(): Promise<Agent> {
  return request(`${BASE}/cases/acp-cloud`, { method: 'POST' });
}

export function createAgent(write: AgentWrite): Promise<Agent> {
  return request(BASE, { method: 'POST', body: JSON.stringify(write) });
}

export function updateAgent(slug: string, write: AgentWrite): Promise<Agent> {
  const { slug: _slug, ...rest } = write;
  return request(agentPath(slug), { method: 'PUT', body: JSON.stringify(rest) });
}

export function setAgentEnabled(slug: string, enabled: boolean): Promise<Agent> {
  return request(`${agentPath(slug)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}

export function deleteAgent(slug: string): Promise<{ ok: boolean }> {
  return request(agentPath(slug), { method: 'DELETE' });
}
