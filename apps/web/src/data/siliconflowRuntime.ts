/**
 * SiliconFlow Console credential authority (mirrors Boyue).
 *
 * Prefer in-memory Provider Secret → supplier pool fallback → fail closed.
 * localStorage supplier keys are ops fallback, not the durable authority.
 */

import {
  DEFAULT_SILICONFLOW_BASE,
  SILICONFLOW_PROVIDER_ID,
  functionEnvProjection,
  getProviderSecretView,
  resolveProviderPlaintextForRuntime,
} from '@/data/providerSecrets';
import {
  SILICONFLOW_SUPPLIER_ID,
  getSupplierField,
  pickSupplierApiKey,
  recordSupplierApiKeyCall,
} from '@/data/suppliers';
import { supplierVaultEnvMissing } from '@/data/supplierVaultErrors';

export type SiliconflowCredentialOk = {
  ok: true;
  apiKey: string;
  baseUrl: string;
  source: string;
  runtimeEnv: Record<string, string>;
};

export type SiliconflowCredentialErr = {
  ok: false;
  code: 'provider.credential_missing';
  message: string;
};

export type SiliconflowCredential =
  | SiliconflowCredentialOk
  | SiliconflowCredentialErr;

export function resolveSiliconflowCredential(): SiliconflowCredential {
  const runtimeEnv = functionEnvProjection(SILICONFLOW_PROVIDER_ID);

  const plaintext = resolveProviderPlaintextForRuntime(SILICONFLOW_PROVIDER_ID);
  if (plaintext) {
    const view = getProviderSecretView(SILICONFLOW_PROVIDER_ID);
    const ref =
      view.envBindings.find((b) => b.name === 'SILICONFLOW_API_KEY')?.ref ??
      '(missing)';
    return {
      ok: true,
      apiKey: plaintext,
      baseUrl: view.baseUrl.replace(/\/$/, ''),
      source: ref,
      runtimeEnv,
    };
  }

  const supplierKey = pickSupplierApiKey(SILICONFLOW_SUPPLIER_ID);
  if (supplierKey) {
    const baseUrl =
      getSupplierField(SILICONFLOW_SUPPLIER_ID, 'baseUrl')?.trim() ||
      getProviderSecretView(SILICONFLOW_PROVIDER_ID).baseUrl ||
      DEFAULT_SILICONFLOW_BASE;
    return {
      ok: true,
      apiKey: supplierKey.value.trim(),
      baseUrl: baseUrl.replace(/\/$/, ''),
      source: `supplier-key:${supplierKey.id}`,
      runtimeEnv: {
        ...runtimeEnv,
        SILICONFLOW_API_KEY: `supplier://${supplierKey.id}`,
        SILICONFLOW_BASE_URL: baseUrl.replace(/\/$/, ''),
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

export function isSiliconflowCredentialBound(): boolean {
  return resolveSiliconflowCredential().ok;
}

export function markSiliconflowSupplierKeyUsed(source: string): void {
  if (!source.startsWith('supplier-key:')) return;
  recordSupplierApiKeyCall(SILICONFLOW_SUPPLIER_ID, source.slice('supplier-key:'.length));
}
