/**
 * Boyue chat runtime — Console credential authority (mirrors Kense Monitor).
 *
 * Prefer in-memory Provider Secret (prov_boyue) → supplier pool fallback → fail closed.
 * Work only has Capability Key; never receives Boyue plaintext.
 * localStorage supplier keys are ops fallback, not the durable authority.
 */

import {
  BOYUE_PROVIDER_ID,
  DEFAULT_BOYUE_BASE,
  functionEnvProjection,
  getProviderSecretView,
  resolveProviderPlaintextForRuntime,
} from '@/data/providerSecrets';
import {
  BOYUE_SUPPLIER_ID,
  getSupplierField,
  pickSupplierApiKey,
  recordSupplierApiKeyCall,
} from '@/data/suppliers';
import {
  BOYUE_OPENAI_CHAT_OP,
  BOYUE_UPSTREAM_BY_MODEL,
  isBoyueModelName,
  type BoyueModelName,
} from '@/data/boyueUpstream';
import { supplierVaultEnvMissing } from '@/data/supplierVaultErrors';

export type BoyueCredentialOk = {
  ok: true;
  apiKey: string;
  baseUrl: string;
  source: string;
  runtimeEnv: Record<string, string>;
};

export type BoyueCredentialErr = {
  ok: false;
  code: 'provider.credential_missing';
  message: string;
};

export type BoyueCredential = BoyueCredentialOk | BoyueCredentialErr;

/** Resolve Boyue upstream credentials for Console / Function sync. */
export function resolveBoyueCredential(): BoyueCredential {
  const runtimeEnv = functionEnvProjection(BOYUE_PROVIDER_ID);

  const plaintext = resolveProviderPlaintextForRuntime(BOYUE_PROVIDER_ID);
  if (plaintext) {
    const view = getProviderSecretView(BOYUE_PROVIDER_ID);
    const ref =
      view.envBindings.find((b) => b.name === 'BOYUE_API_KEY')?.ref ??
      '(missing)';
    return {
      ok: true,
      apiKey: plaintext,
      baseUrl: view.baseUrl.replace(/\/$/, ''),
      source: ref,
      runtimeEnv,
    };
  }

  const supplierKey = pickSupplierApiKey(BOYUE_SUPPLIER_ID);
  if (supplierKey) {
    const baseUrl =
      getSupplierField(BOYUE_SUPPLIER_ID, 'baseUrl')?.trim() ||
      getProviderSecretView(BOYUE_PROVIDER_ID).baseUrl ||
      DEFAULT_BOYUE_BASE;
    return {
      ok: true,
      apiKey: supplierKey.value.trim(),
      baseUrl: baseUrl.replace(/\/$/, ''),
      source: `supplier-key:${supplierKey.id}`,
      runtimeEnv: {
        ...runtimeEnv,
        BOYUE_API_KEY: `supplier://${supplierKey.id}`,
        BOYUE_BASE_URL: baseUrl.replace(/\/$/, ''),
      },
    };
  }

  const missing = supplierVaultEnvMissing();
  return {
    ok: false,
    code: missing.code,
    message: missing.message,
  };
}

export function isBoyueCredentialBound(): boolean {
  return resolveBoyueCredential().ok;
}

export type BoyueChatInvokeInput = {
  /** Work-facing model name (body.model), e.g. deepseek-v4-flash. */
  model: string;
  messages: Array<{ role: string; content: string }>;
  extras?: Record<string, unknown>;
};

export type BoyueChatInvokeOk = {
  ok: true;
  model: BoyueModelName;
  completion: Record<string, unknown>;
  billableUnits: number;
  unitPriceUsd: number;
  upstream: string;
  source: string;
  runtimeEnv: Record<string, string>;
  preview: true;
};

export type BoyueChatInvokeErr = {
  ok: false;
  code:
    | 'entitlement.denied'
    | 'request.invalid'
    | 'provider.credential_missing'
    | 'upstream.exhausted';
  message: string;
};

function tokenTotal(usage: unknown): number {
  if (!usage || typeof usage !== 'object') return 0;
  const row = usage as Record<string, unknown>;
  const total = row.total_tokens;
  if (typeof total === 'number' && Number.isFinite(total) && total > 0) {
    return Math.round(total);
  }
  const prompt = typeof row.prompt_tokens === 'number' ? row.prompt_tokens : 0;
  const completion =
    typeof row.completion_tokens === 'number' ? row.completion_tokens : 0;
  const sum = prompt + completion;
  return sum > 0 ? Math.round(sum) : 1;
}

/**
 * Console preview adapter: call Boyue upstream with resolved Console credentials.
 * Marks callCount on supplier key when used.
 */
export async function runBoyueChatPreview(
  input: BoyueChatInvokeInput,
): Promise<BoyueChatInvokeOk | BoyueChatInvokeErr> {
  const model = input.model.trim();
  if (!isBoyueModelName(model)) {
    return {
      ok: false,
      code: 'request.invalid',
      message: `model must be a Boyue model name, got: ${model || '(empty)'}`,
    };
  }

  const cred = resolveBoyueCredential();
  if (!cred.ok) return cred;

  if (cred.source.startsWith('supplier-key:')) {
    const keyId = cred.source.slice('supplier-key:'.length);
    recordSupplierApiKeyCall(BOYUE_SUPPLIER_ID, keyId);
  }

  const upstreamModel = BOYUE_UPSTREAM_BY_MODEL[model];
  if (!upstreamModel) {
    return {
      ok: false,
      code: 'request.invalid',
      message: `model must be a Boyue model name, got: ${model || '(empty)'}`,
    };
  }
  const body = {
    ...(input.extras ?? {}),
    model: upstreamModel,
    messages: input.messages,
    stream: false,
  };

  let res: Response;
  try {
    res = await fetch(`${cred.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cred.apiKey}`,
        'User-Agent': 'KenseConsole/0.1 (+https://kense.dev)',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    return {
      ok: false,
      code: 'upstream.exhausted',
      message:
        err instanceof Error ? err.message : 'Boyue upstream request failed',
    };
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return {
      ok: false,
      code: 'upstream.exhausted',
      message: 'Boyue upstream returned non-JSON',
    };
  }

  if (!res.ok) {
    const detail =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      payload.error &&
      typeof payload.error === 'object' &&
      'message' in payload.error &&
      typeof (payload.error as { message?: unknown }).message === 'string'
        ? (payload.error as { message: string }).message
        : `Boyue upstream HTTP ${res.status}`;
    return {
      ok: false,
      code: 'upstream.exhausted',
      message: detail,
    };
  }

  if (!payload || typeof payload !== 'object') {
    return {
      ok: false,
      code: 'upstream.exhausted',
      message: 'Boyue upstream returned an empty completion',
    };
  }

  const completion = {
    ...(payload as Record<string, unknown>),
    model,
  };

  return {
    ok: true,
    model,
    completion,
    billableUnits: tokenTotal((payload as { usage?: unknown }).usage),
    unitPriceUsd: BOYUE_OPENAI_CHAT_OP.unitPriceUsd,
    upstream: upstreamModel,
    source: cred.source,
    runtimeEnv: cred.runtimeEnv,
    preview: true,
  };
}
