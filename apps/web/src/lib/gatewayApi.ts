/**
 * Local a3s-gateway operator view. Standards are the caller-facing catalog.
 * Published models stay off this document. Platform routes name platform processes.
 */

import { apiRequest } from '@/lib/apiClient';

export type GatewayCoverage = 'mounted' | 'partial' | 'absent';

export type GatewayStandardRoute = {
  method: string;
  path: string;
};

export type GatewayStandard = {
  id: string;
  routes: GatewayStandardRoute[];
  coverage: GatewayCoverage;
};

export type GatewayMatch = {
  kind: 'prefix' | 'exact' | string;
  value: string;
};

export type GatewayHealth = { healthy: number; total: number };

export type GatewayPlatformRoute = {
  name: string;
  matches: GatewayMatch[];
  target: string;
  priority: number | null;
  middlewares: string[];
  requests: number | null;
  errors: number | null;
  avgLatencyMs: number | null;
  health?: GatewayHealth | null;
  healthPath?: string | null;
};

export type GatewayLive = {
  reachable: boolean;
  observedAt: string;
  endpoint: string;
  error: string | null;
  state: string | null;
  uptimeSecs: number | null;
  activeConnections: number | null;
  totalRequests: number | null;
  errorResponses: number | null;
};

export type GatewayEntrypoint = {
  name: string;
  address: string;
};

export type GatewaySurface = {
  source: string;
  mode: string;
  entrypoints: GatewayEntrypoint[];
  live?: GatewayLive | null;
  model: GatewayStandard[];
  api: GatewayStandard[];
  mcp: GatewayStandard[];
  platform: GatewayPlatformRoute[];
};

export function listLocalGatewayServices() {
  return apiRequest<GatewaySurface>('/gateway/services');
}
