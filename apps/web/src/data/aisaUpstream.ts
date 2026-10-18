/** AIsa catalog. No upstream route table is shipped. */

export const AISA_API_BASE = '';
export const AISA_DOCS_URL = '';
export const AISA_MCP_URL = '';

export const AISA_SKUS = [] as const;

export type AisaSku = (typeof AISA_SKUS)[number];

export function isAisaSku(_sku: string): _sku is AisaSku {
  return false;
}

export type AisaUpstreamOp = {
  sku: AisaSku;
  gatewayPath: string;
  operationId: string;
  method: 'GET' | 'POST';
  path: string;
  summary: string;
  unitPriceUsd?: number;
  sampleInput: Record<string, unknown>;
};

export const AISA_UPSTREAM_OPS: Record<AisaSku, AisaUpstreamOp> = {};

export function aisaEndpointPricing(): Array<{
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
