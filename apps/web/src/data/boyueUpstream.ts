/** Boyue chat catalog. No upstream model map is shipped. */

export const BOYUE_OPENAI_CHAT_SKU = '';

export const BOYUE_MODEL_NAMES = [] as const;

export type BoyueModelName = string;

export function isBoyueOpenAiChatSku(_sku: string): boolean {
  return false;
}

/** @deprecated Use isBoyueOpenAiChatSku. */
export function isBoyueModelSku(sku: string): boolean {
  return isBoyueOpenAiChatSku(sku);
}

export function isBoyueModelName(_name: string): boolean {
  return false;
}

export const BOYUE_UPSTREAM_BY_MODEL: Record<string, string> = {};

export const BOYUE_OPENAI_CHAT_GATEWAY_PATH = '';

export type BoyueUpstreamOp = {
  sku: string;
  gatewayPath: string;
  operationId: string;
  method: 'POST';
  unitPriceUsd: number;
  sampleInput: Record<string, unknown>;
};

export const BOYUE_OPENAI_CHAT_OP: BoyueUpstreamOp = {
  sku: BOYUE_OPENAI_CHAT_SKU,
  gatewayPath: BOYUE_OPENAI_CHAT_GATEWAY_PATH,
  operationId: '',
  method: 'POST',
  unitPriceUsd: 0,
  sampleInput: {},
};

export function boyueEndpointPricing(): Array<{
  key: string;
  method: string;
  path: string;
  name: string;
  description: string;
  names: { zh: string; en: string };
  descriptions: { zh: string; en: string };
  groupId: string;
  groupNames: { zh: string; en: string };
  summary: string;
  operationId: string;
  openApiParams: unknown[];
  unitPriceUsd: number;
}> {
  return [];
}
