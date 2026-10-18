/** SiliconFlow catalog. No upstream route table is shipped. */

export const SILICONFLOW_API_BASE = '';
export const SILICONFLOW_DOCS_URL = '';
export const SILICONFLOW_API_DOCS_URL = '';

export const SILICONFLOW_CHAT_MODEL_SAMPLES = [] as const;

export const SILICONFLOW_SKUS = [] as const;

export type SiliconflowSku = (typeof SILICONFLOW_SKUS)[number];

export function isSiliconflowSku(_sku: string): _sku is SiliconflowSku {
  return false;
}

export type SiliconflowUpstreamOp = {
  sku: SiliconflowSku;
  gatewayPath: string;
  operationId: string;
  upstreamMethod: 'GET' | 'POST' | 'DELETE';
  upstreamPath: string;
  response: 'json' | 'binary';
  unitPriceUsd: number;
  sampleInput: Record<string, unknown>;
};

export const SILICONFLOW_UPSTREAM_OPS: Record<
  SiliconflowSku,
  SiliconflowUpstreamOp
> = {};

export function siliconflowEndpointPricing(): Array<{
  key: string;
  method: string;
  path: string;
  name: string;
  description: string;
  operationId: string;
  unitPriceUsd: number;
}> {
  return [];
}
