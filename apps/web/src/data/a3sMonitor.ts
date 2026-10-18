/**
 * Kense Monitor API — Runtime / Console adapter over World Monitor.
 *
 * Live REST only. Unbound credentials fail closed (no invented sandbox bodies).
 */

import {
  functionEnvProjection,
  getProviderSecretView,
  isProviderCredentialBound,
  resolveProviderPlaintextForRuntime,
} from '@/data/providerSecrets';
import {
  WORLD_MONITOR_SUPPLIER_ID,
  getSupplierField,
  pickSupplierApiKey,
  recordSupplierApiKeyCall,
} from '@/data/suppliers';
import {
  A3S_MONITOR_SKUS,
  WM_API_KEY_HEADER,
  WM_USER_AGENT,
  isA3sMonitorSku,
  liveUrl,
  upstreamOpForSku,
  type A3sMonitorSku,
} from '@/data/worldMonitorUpstream';
import { supplierVaultEnvMissing } from '@/data/supplierVaultErrors';

export { A3S_MONITOR_SKUS, isA3sMonitorSku };
export type { A3sMonitorSku };

export type MonitorInvokeInput = {
  sku: string;
  input?: Record<string, unknown>;
};

export type MonitorInvokeResult = {
  ok: true;
  sku: string;
  upstream: string;
  mode: 'live';
  result: Record<string, unknown>;
  provenance: {
    source: string;
    as_of: string;
    confidence: number;
    mutation: 'forbid';
    operationId: string;
    path: string;
  };
  runtimeEnv: Record<string, string>;
  billableUnits: number;
};

export type MonitorInvokeError = {
  ok: false;
  code:
    | 'entitlement.denied'
    | 'auth.invalid_key'
    | 'request.invalid'
    | 'provider.credential_missing'
    | 'upstream.exhausted'
    | 'upstream.error'
    | 'quota.exceeded';
  message: string;
};

const PROVIDER_ID = 'prov_a3s_monitor';

async function fetchJson(
  url: string,
  headers: Record<string, string>,
): Promise<
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; detail: string }
> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': WM_USER_AGENT,
        ...headers,
      },
      mode: 'cors',
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    if (text) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          body = parsed as Record<string, unknown>;
        } else {
          body = { value: parsed as unknown };
        }
      } catch {
        body = { raw: text.slice(0, 2000) };
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        detail: `HTTP ${res.status}: ${typeof body.error === 'string' ? body.error : text.slice(0, 200)}`,
      };
    }
    return { ok: true, status: res.status, body };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : 'network error',
    };
  }
}

async function invokeLive(
  sku: A3sMonitorSku,
  input: Record<string, unknown>,
  plaintext: string,
  baseUrl: string,
  secretRef: string,
  runtimeEnv: Record<string, string>,
  apiKeyHeader = WM_API_KEY_HEADER,
): Promise<MonitorInvokeResult | MonitorInvokeError> {
  const op = upstreamOpForSku(sku);
  const url = liveUrl(op, input, baseUrl);
  const fetched = await fetchJson(url, {
    [apiKeyHeader]: plaintext,
  });
  if (!fetched.ok) {
    return {
      ok: false,
      code:
        fetched.status === 429
          ? 'upstream.exhausted'
          : fetched.status === 401 || fetched.status === 403
            ? 'auth.invalid_key'
            : 'upstream.error',
      message: `Live upstream failed: ${fetched.detail}`,
    };
  }

  const asOf = new Date().toISOString();
  return {
    ok: true,
    sku,
    upstream: `${url} via ${secretRef}`,
    mode: 'live',
    result: fetched.body,
    provenance: {
      source: `worldmonitor:${op.operationId}`,
      as_of: asOf,
      confidence: 0.9,
      mutation: 'forbid',
      operationId: op.operationId,
      path: op.path,
    },
    runtimeEnv,
    billableUnits: 1,
  };
}

/**
 * Monitor invoke — live only. Missing credentials → provider.credential_missing.
 */
export async function runA3sMonitorFunction(
  input: MonitorInvokeInput,
): Promise<MonitorInvokeResult | MonitorInvokeError> {
  const sku = input.sku?.trim();
  if (!sku || !isA3sMonitorSku(sku)) {
    return {
      ok: false,
      code: 'request.invalid',
      message: `unknown or unsupported Monitor SKU: ${sku || '(empty)'}`,
    };
  }

  const runtimeEnv = functionEnvProjection(PROVIDER_ID);
  const supplierKey = pickSupplierApiKey(WORLD_MONITOR_SUPPLIER_ID);
  const providerBound = isProviderCredentialBound(PROVIDER_ID);

  if (!supplierKey && !providerBound) {
    const missing = supplierVaultEnvMissing();
    return {
      ok: false,
      code: missing.code,
      message: missing.message,
    };
  }

  // Prefer in-memory Provider Secret over supplier localStorage pool.
  const plaintext = resolveProviderPlaintextForRuntime(PROVIDER_ID);
  if (plaintext) {
    const view = getProviderSecretView(PROVIDER_ID);
    const wmRef =
      view.envBindings.find((b) => b.name === 'WM_KEY')?.ref ?? '(missing)';
    return invokeLive(
      sku,
      input.input ?? {},
      plaintext,
      view.baseUrl,
      wmRef,
      runtimeEnv,
    );
  }

  if (supplierKey) {
    recordSupplierApiKeyCall(WORLD_MONITOR_SUPPLIER_ID, supplierKey.id);
    const baseUrl =
      getSupplierField(WORLD_MONITOR_SUPPLIER_ID, 'baseUrl')?.trim() ||
      getProviderSecretView(PROVIDER_ID).baseUrl;
    const header =
      getSupplierField(WORLD_MONITOR_SUPPLIER_ID, 'apiKeyHeader')?.trim() ||
      WM_API_KEY_HEADER;
    return invokeLive(
      sku,
      input.input ?? {},
      supplierKey.value,
      baseUrl,
      `supplier-key:${supplierKey.id}`,
      runtimeEnv,
      header,
    );
  }

  const missing = supplierVaultEnvMissing();
  return {
    ok: false,
    code: missing.code,
    message: missing.message,
  };
}
