/**
 * Sync Console-held upstream credentials into local @a3s/runtime vault.
 *
 * First principles:
 * 1. Prefer providerSecrets (in-memory bind) over supplier localStorage pool.
 * 2. Plaintext crosses only loopback materialize — never the NATS queue.
 * 3. Queue carries secret_ref + version + scope only; apply writes a receipt.
 * 4. Scope follows Console Cloud org/project/env when present.
 */

import {
  BOYUE_PROVIDER_ID,
  SILICONFLOW_PROVIDER_ID,
  WORLD_MONITOR_PROVIDER_IDS,
  getProviderSecretView,
  resolveProviderPlaintextForRuntime,
} from '@/data/providerSecrets';
import { resolveBoyueCredential } from '@/data/boyueRuntime';
import { resolveSiliconflowCredential } from '@/data/siliconflowRuntime';
import {
  defaultVaultScope,
  type VaultProviderId,
  type VaultScope,
} from '@/data/vaultScope';

export const LOCAL_RUNTIME_LISTEN = 'http://127.0.0.1:8787';

export type SyncUpstreamResult =
  | {
      ok: true;
      detail: string;
      source: string;
      secret_ref?: string | null;
      receipt_id?: string;
    }
  | { ok: false; detail: string; code?: string; source?: string };

export type SyncBoyueResult = SyncUpstreamResult;

type ResolvedCred = {
  apiKey: string;
  baseUrl: string;
  secret_ref: string;
  version: number;
  source: string;
};

function readStored(key: string): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
}

/** Resolve Console Cloud scope for vault apply; falls back to local defaults. */
export function resolveConsoleVaultScope(): VaultScope {
  const fallback = defaultVaultScope();
  const organization_id =
    readStored('kense.os.cloudOrganizationId') ||
    readStored('a3s_user_org') ||
    fallback.organization_id;
  const project_id =
    readStored('kense.os.cloudProjectId') || fallback.project_id;
  const environment_id =
    readStored('kense.os.cloudEnvId') || fallback.environment_id;
  return { organization_id, project_id, environment_id };
}

let scopeOverride: VaultScope | null = null;

/** Test helper / explicit caller override. */
export function setVaultScopeOverride(scope: VaultScope | null): void {
  scopeOverride = scope;
}

function scope(): VaultScope {
  return scopeOverride ?? resolveConsoleVaultScope();
}

async function materialize(input: {
  provider: VaultProviderId;
  secret_ref: string;
  version: number;
  apiKey: string;
  baseUrl: string;
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    const res = await fetch(`${LOCAL_RUNTIME_LISTEN}/__local/vault/materialize`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: scope(),
        provider: input.provider,
        secret_ref: input.secret_ref,
        version: input.version,
        apiKey: input.apiKey,
        baseUrl: input.baseUrl,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, detail: text || `materialize HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : 'materialize failed',
    };
  }
}

async function enqueueApply(input: {
  provider: VaultProviderId;
  secret_ref: string | null;
  version: number;
  baseUrl?: string;
}): Promise<SyncUpstreamResult | null> {
  try {
    const res = await fetch(`${LOCAL_RUNTIME_LISTEN}/__local/queue/vault-apply`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'vault.apply',
        scope: scope(),
        provider: input.provider,
        secret_ref: input.secret_ref,
        version: input.version,
        ...(input.baseUrl ? { base_url: input.baseUrl } : {}),
        requested_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(4000),
    });
    const text = await res.text();
    let parsed: {
      message?: string;
      detail?: string;
      code?: number;
      data?: {
        queued?: boolean;
        detail?: string;
        receipt?: { receipt_id?: string };
      } | null;
    } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      /* keep */
    }
    if (!res.ok) {
      if (parsed.message?.includes('plaintext')) return null;
      return null;
    }
    return {
      ok: true,
      detail:
        parsed.data?.detail ||
        parsed.detail ||
        parsed.message ||
        'enqueued vault.apply',
      source: parsed.data?.queued === false ? 'direct-apply' : 'queue',
      secret_ref: input.secret_ref,
      receipt_id: parsed.data?.receipt?.receipt_id,
    };
  } catch {
    return null;
  }
}

/** Legacy plaintext PUT — last resort when materialize/queue unavailable. */
async function putVaultLegacy(body: {
  boyue?: { apiKey: string; baseUrl: string } | null;
  siliconflow?: { apiKey: string; baseUrl: string } | null;
  worldmonitor?: { apiKey: string; baseUrl: string } | null;
}): Promise<SyncUpstreamResult> {
  try {
    const res = await fetch(
      `${LOCAL_RUNTIME_LISTEN}/__local/upstream-secrets`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      },
    );
    const text = await res.text();
    let parsed: { message?: string; detail?: string } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      /* keep */
    }
    if (!res.ok) {
      return {
        ok: false,
        detail:
          parsed.message ||
          parsed.detail ||
          `Runtime vault HTTP ${res.status}`,
        code: 'runtime.sync_failed',
      };
    }
    return {
      ok: true,
      detail: parsed.detail || parsed.message || 'synced (legacy)',
      source: 'runtime-vault-legacy',
    };
  } catch (err) {
    return {
      ok: false,
      detail:
        err instanceof Error
          ? err.message
          : 'Runtime not reachable on :8787',
      code: 'runtime.unreachable',
    };
  }
}

function resolveProviderCred(
  provider: VaultProviderId,
): ResolvedCred | null {
  if (provider === 'worldmonitor') {
    const providerId = WORLD_MONITOR_PROVIDER_IDS[0];
    const view = getProviderSecretView(providerId);
    const plaintext = resolveProviderPlaintextForRuntime(providerId);
    if (view.status === 'bound' && plaintext) {
      return {
        apiKey: plaintext,
        baseUrl: view.baseUrl,
        secret_ref:
          view.envBindings.find((b) => b.ref.startsWith('secret://'))?.ref ||
          view.envBindings[0]?.ref ||
          `secret://wm`,
        version: view.version,
        source: `provider-secret:${providerId}`,
      };
    }
    return null;
  }

  const providerId =
    provider === 'boyue' ? BOYUE_PROVIDER_ID : SILICONFLOW_PROVIDER_ID;
  const view = getProviderSecretView(providerId);
  const plaintext = resolveProviderPlaintextForRuntime(providerId);
  if (view.status === 'bound' && plaintext && view.envBindings[0]?.ref) {
    return {
      apiKey: plaintext,
      baseUrl: view.baseUrl,
      secret_ref: view.envBindings.find((b) => b.ref.startsWith('secret://'))
        ?.ref || view.envBindings[0].ref,
      version: view.version,
      source: `provider-secret:${providerId}`,
    };
  }

  const cred =
    provider === 'boyue'
      ? resolveBoyueCredential()
      : resolveSiliconflowCredential();
  if (!cred.ok) return null;
  const ref = `supplier://${provider}/${cred.source}`;
  return {
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    secret_ref: ref,
    version: 1,
    source: cred.source,
  };
}

function legacyBodyFor(
  provider: VaultProviderId,
  entry: { apiKey: string; baseUrl: string } | null,
): {
  boyue?: { apiKey: string; baseUrl: string } | null;
  siliconflow?: { apiKey: string; baseUrl: string } | null;
  worldmonitor?: { apiKey: string; baseUrl: string } | null;
} {
  if (provider === 'boyue') return { boyue: entry };
  if (provider === 'siliconflow') return { siliconflow: entry };
  return { worldmonitor: entry };
}

async function syncProvider(
  provider: VaultProviderId,
): Promise<SyncUpstreamResult> {
  const cred = resolveProviderCred(provider);
  if (!cred) {
    const cleared = await enqueueApply({
      provider,
      secret_ref: null,
      version: 0,
    });
    if (cleared) {
      return {
        ok: false,
        detail: 'credential missing; vault clear enqueued',
        code: 'provider.credential_missing',
      };
    }
    const legacy = await putVaultLegacy(legacyBodyFor(provider, null));
    if (!legacy.ok) {
      return {
        ok: false,
        detail: `credential missing; vault clear failed: ${legacy.detail}`,
        code: 'provider.credential_missing',
      };
    }
    return {
      ok: false,
      detail: 'credential missing; vault cleared',
      code: 'provider.credential_missing',
    };
  }

  const sealed = await materialize({
    provider,
    secret_ref: cred.secret_ref,
    version: cred.version,
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
  });
  if (!sealed.ok) {
    return putVaultLegacy(
      legacyBodyFor(provider, {
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
      }),
    );
  }

  const applied = await enqueueApply({
    provider,
    secret_ref: cred.secret_ref,
    version: cred.version,
    baseUrl: cred.baseUrl,
  });
  if (applied) {
    return {
      ...applied,
      source: `${cred.source}+${applied.source}`,
    };
  }

  return putVaultLegacy(
    legacyBodyFor(provider, {
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
    }),
  );
}

async function clearProvider(
  provider: VaultProviderId,
): Promise<SyncUpstreamResult> {
  const queued = await enqueueApply({
    provider,
    secret_ref: null,
    version: 0,
  });
  if (queued) return queued;
  return putVaultLegacy(legacyBodyFor(provider, null));
}

export async function syncBoyueUpstreamToRuntime(): Promise<SyncBoyueResult> {
  return syncProvider('boyue');
}

export async function clearBoyueUpstreamOnRuntime(): Promise<SyncBoyueResult> {
  return clearProvider('boyue');
}

export async function syncSiliconflowUpstreamToRuntime(): Promise<SyncUpstreamResult> {
  return syncProvider('siliconflow');
}

export async function clearSiliconflowUpstreamOnRuntime(): Promise<SyncUpstreamResult> {
  return clearProvider('siliconflow');
}

export async function syncWorldMonitorUpstreamToRuntime(): Promise<SyncUpstreamResult> {
  return syncProvider('worldmonitor');
}

export async function clearWorldMonitorUpstreamOnRuntime(): Promise<SyncUpstreamResult> {
  return clearProvider('worldmonitor');
}

/** @deprecated use syncBoyueUpstreamToRuntime */
export const syncBoyueUpstreamToFunction = syncBoyueUpstreamToRuntime;
/** @deprecated use clearBoyueUpstreamOnRuntime */
export const clearBoyueUpstreamOnFunction = clearBoyueUpstreamOnRuntime;
/** @deprecated use LOCAL_RUNTIME_LISTEN */
export const LOCAL_FUNCTION_LISTEN = LOCAL_RUNTIME_LISTEN;
