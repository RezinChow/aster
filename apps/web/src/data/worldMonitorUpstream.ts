/** World Monitor catalog. No upstream route table is shipped. */

export const WM_API_BASE = '';
export const WM_SANDBOX_BASE = '';
export const WM_MCP_URL = '';
export const WM_API_KEY_HEADER = '';
export const WM_USER_AGENT = '';
export const WM_DEFAULT_RATE_LIMIT = {
  requests: 0,
  windowSeconds: 0,
  perDay: 0,
};

export const A3S_MONITOR_SKUS = [] as const;

export type A3sMonitorSku = (typeof A3S_MONITOR_SKUS)[number];

export function isA3sMonitorSku(_sku: string): _sku is A3sMonitorSku {
  return false;
}

export type WorldMonitorUpstreamOp = {
  sku: A3sMonitorSku;
  gatewayPath: string;
  operationId: string;
  method: 'GET';
  path: string;
  sandboxSlug: string;
  unitPriceUsd: number;
  sampleInput: Record<string, unknown>;
  queryFromInput: (input: Record<string, unknown>) => Record<string, string>;
};

export const WORLD_MONITOR_UPSTREAM_OPS: Record<
  A3sMonitorSku,
  WorldMonitorUpstreamOp
> = {};

export function upstreamOpForSku(sku: A3sMonitorSku): WorldMonitorUpstreamOp {
  return WORLD_MONITOR_UPSTREAM_OPS[sku];
}

export function sandboxUrl(op: WorldMonitorUpstreamOp): string {
  return `${WM_SANDBOX_BASE}/${op.sandboxSlug}.json`;
}

export function liveUrl(
  op: WorldMonitorUpstreamOp,
  input: Record<string, unknown>,
  baseUrl = WM_API_BASE,
): string {
  const base = baseUrl.replace(/\/$/, '');
  const qs = new URLSearchParams(op.queryFromInput(input));
  const q = qs.toString();
  return `${base}${op.path}${q ? `?${q}` : ''}`;
}

export function a3sMonitorEndpointPricing(): Array<{
  key: string;
  method: string;
  path: string;
  name: string;
  description: string;
  names?: { zh: string; en: string };
  descriptions?: { zh: string; en: string };
  groupId?: string;
  groupNames?: { zh: string; en: string };
  summary: string;
  operationId: string;
  openApiParams?: unknown[];
  unitPriceUsd?: number;
}> {
  return [];
}
