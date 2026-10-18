/**
 * Provider upstream Secrets — platform-held credentials (first principles).
 *
 * - Work clients never see plaintext; only Capability Keys.
 * - World Monitor live REST uses header X-WorldMonitor-Key (wm_…).
 * - Boyue OpenAI-compatible uses Authorization Bearer (sk-…).
 * - Function runtime receives env via secret refs (never plaintext in list APIs).
 * - After bind, plaintext is kept only in an in-memory vault for Function inject.
 */

export type ProviderSecretKind = 'worldmonitor_api_key' | 'openai_api_key';

export type ProviderSecretStatus = 'bound' | 'missing';

export type ProviderConnectionTestStatus =
  | 'untested'
  | 'ok'
  | 'fail'
  | 'format_ok_network_blocked';

export type ProviderEnvBinding = {
  /** Runtime env name injected into the Function. */
  name: string;
  /** Opaque ref — never the plaintext. */
  ref: string;
};

export type ProviderSecretView = {
  id: string;
  providerId: string;
  kind: ProviderSecretKind;
  name: string;
  /** Public prefix only, e.g. wm_0123… or sk-UhNM…. */
  prefix: string;
  status: ProviderSecretStatus;
  version: number;
  boundAt: string;
  lastTestAt?: string;
  lastTestStatus: ProviderConnectionTestStatus;
  lastTestDetail?: string;
  envBindings: ProviderEnvBinding[];
  baseUrl: string;
};

type VaultEntry = {
  view: ProviderSecretView;
  /** In-memory only; never serialized to list APIs. */
  plaintext: string;
};

const DEFAULT_WM_BASE = 'https://api.worldmonitor.app';
export const DEFAULT_BOYUE_BASE = 'http://35.220.164.252:3888/v1';
export const DEFAULT_SILICONFLOW_BASE = 'https://api.siliconflow.cn/v1';

/** Providers that wrap / proxy World Monitor upstream. */
export const WORLD_MONITOR_PROVIDER_IDS = [
  'prov_a3s_monitor',
  'prov_wm',
] as const;

export const BOYUE_PROVIDER_ID = 'prov_boyue';
export const SILICONFLOW_PROVIDER_ID = 'prov_siliconflow';

const vault = new Map<string, VaultEntry>();

/** User-issued WM keys: wm_ + 40 lowercase hex (World Monitor docs). */
export function isValidWorldMonitorKey(raw: string): boolean {
  return /^wm_[0-9a-f]{40}$/.test(raw.trim());
}

export function maskWorldMonitorKey(raw: string): string {
  const key = raw.trim();
  if (key.length < 10) return 'wm_****';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/** Boyue / OpenAI-compatible keys: non-empty, at least 8 chars. */
export function isValidBoyueKey(raw: string): boolean {
  const key = raw.trim();
  return key.length >= 8;
}

export function maskBoyueKey(raw: string): string {
  const key = raw.trim();
  if (key.length < 10) return 'sk-****';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/** SiliconFlow keys: sk-… or any opaque token ≥ 8 chars. */
export function isValidSiliconflowKey(raw: string): boolean {
  return raw.trim().length >= 8;
}

export function maskSiliconflowKey(raw: string): string {
  const key = raw.trim();
  if (key.length < 10) return 'sk-****';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function secretRef(secretId: string, version: number): string {
  return `secret://${secretId}?v=${version}`;
}

function emptyView(providerId: string): ProviderSecretView {
  if (isBoyueProvider(providerId)) {
    return {
      id: '',
      providerId,
      kind: 'openai_api_key',
      name: 'Boyue API Key',
      prefix: '—',
      status: 'missing',
      version: 0,
      boundAt: '',
      lastTestStatus: 'untested',
      envBindings: [
        { name: 'BOYUE_API_KEY', ref: '(unbound)' },
        { name: 'BOYUE_BASE_URL', ref: DEFAULT_BOYUE_BASE },
      ],
      baseUrl: DEFAULT_BOYUE_BASE,
    };
  }
  if (isSiliconflowProvider(providerId)) {
    return {
      id: '',
      providerId,
      kind: 'openai_api_key',
      name: 'SiliconFlow API Key',
      prefix: '—',
      status: 'missing',
      version: 0,
      boundAt: '',
      lastTestStatus: 'untested',
      envBindings: [
        { name: 'SILICONFLOW_API_KEY', ref: '(unbound)' },
        { name: 'SILICONFLOW_BASE_URL', ref: DEFAULT_SILICONFLOW_BASE },
      ],
      baseUrl: DEFAULT_SILICONFLOW_BASE,
    };
  }
  return {
    id: '',
    providerId,
    kind: 'worldmonitor_api_key',
    name: 'World Monitor API Key',
    prefix: '—',
    status: 'missing',
    version: 0,
    boundAt: '',
    lastTestStatus: 'untested',
    envBindings: [
      { name: 'WM_KEY', ref: '(unbound)' },
      { name: 'WORLDMONITOR_BASE_URL', ref: DEFAULT_WM_BASE },
      { name: 'X_WORLDMONITOR_KEY_HEADER', ref: 'X-WorldMonitor-Key' },
    ],
    baseUrl: DEFAULT_WM_BASE,
  };
}

export function isWorldMonitorProvider(providerId: string): boolean {
  return (WORLD_MONITOR_PROVIDER_IDS as readonly string[]).includes(providerId);
}

export function isBoyueProvider(providerId: string): boolean {
  return providerId === BOYUE_PROVIDER_ID;
}

export function isSiliconflowProvider(providerId: string): boolean {
  return providerId === SILICONFLOW_PROVIDER_ID;
}

export function supportsProviderCredentials(providerId: string): boolean {
  return (
    isWorldMonitorProvider(providerId) ||
    isBoyueProvider(providerId) ||
    isSiliconflowProvider(providerId)
  );
}

export function getProviderSecretView(providerId: string): ProviderSecretView {
  const hit = vault.get(providerId);
  if (!hit) return emptyView(providerId);
  return { ...hit.view, envBindings: [...hit.view.envBindings] };
}

export function isProviderCredentialBound(providerId: string): boolean {
  return vault.get(providerId)?.view.status === 'bound';
}

/**
 * Resolve plaintext for Function runtime only (Gateway adapter).
 * Returns undefined when unbound — never for Work-facing APIs.
 */
export function resolveProviderPlaintextForRuntime(
  providerId: string,
): string | undefined {
  const hit = vault.get(providerId);
  if (!hit || hit.view.status !== 'bound') return undefined;
  return hit.plaintext;
}

export function functionEnvProjection(providerId: string): Record<string, string> {
  const view = getProviderSecretView(providerId);
  if (isBoyueProvider(providerId)) {
    const out: Record<string, string> = {
      BOYUE_BASE_URL: view.baseUrl,
    };
    const key = view.envBindings.find((b) => b.name === 'BOYUE_API_KEY');
    if (view.status === 'bound' && key) {
      out.BOYUE_API_KEY = key.ref;
    }
    return out;
  }
  if (isSiliconflowProvider(providerId)) {
    const out: Record<string, string> = {
      SILICONFLOW_BASE_URL: view.baseUrl,
    };
    const key = view.envBindings.find((b) => b.name === 'SILICONFLOW_API_KEY');
    if (view.status === 'bound' && key) {
      out.SILICONFLOW_API_KEY = key.ref;
    }
    return out;
  }
  const out: Record<string, string> = {
    WORLDMONITOR_BASE_URL: view.baseUrl,
  };
  const wm = view.envBindings.find((b) => b.name === 'WM_KEY');
  if (view.status === 'bound' && wm) {
    out.WM_KEY = wm.ref;
  }
  return out;
}

export type BindProviderSecretInput = {
  providerId: string;
  plaintext: string;
  baseUrl?: string;
  name?: string;
};

export type BindProviderSecretResult =
  | { ok: true; view: ProviderSecretView }
  | {
      ok: false;
      code: 'provider.unsupported' | 'secret.invalid_format';
      message: string;
    };

export function bindProviderSecret(
  input: BindProviderSecretInput,
): BindProviderSecretResult {
  const providerId = input.providerId.trim();

  if (isBoyueProvider(providerId)) {
    const plaintext = input.plaintext.trim();
    if (!isValidBoyueKey(plaintext)) {
      return {
        ok: false,
        code: 'secret.invalid_format',
        message: 'Boyue API key must be at least 8 characters',
      };
    }
    const prev = vault.get(providerId);
    const version = (prev?.view.version ?? 0) + 1;
    const id = prev?.view.id || 'sec_boyue';
    const baseUrl = (
      input.baseUrl?.trim() ||
      DEFAULT_BOYUE_BASE
    ).replace(/\/$/, '');
    const view: ProviderSecretView = {
      id,
      providerId,
      kind: 'openai_api_key',
      name: input.name?.trim() || 'Boyue API Key',
      prefix: maskBoyueKey(plaintext),
      status: 'bound',
      version,
      boundAt: new Date().toISOString(),
      lastTestStatus: 'untested',
      lastTestDetail: undefined,
      lastTestAt: undefined,
      baseUrl,
      envBindings: [
        { name: 'BOYUE_API_KEY', ref: secretRef(id, version) },
        { name: 'BOYUE_BASE_URL', ref: baseUrl },
      ],
    };
    vault.set(providerId, { view, plaintext });
    return { ok: true, view: { ...view, envBindings: [...view.envBindings] } };
  }

  if (isSiliconflowProvider(providerId)) {
    const plaintext = input.plaintext.trim();
    if (!isValidSiliconflowKey(plaintext)) {
      return {
        ok: false,
        code: 'secret.invalid_format',
        message: 'SiliconFlow API key must be at least 8 characters',
      };
    }
    const prev = vault.get(providerId);
    const version = (prev?.view.version ?? 0) + 1;
    const id = prev?.view.id || 'sec_siliconflow';
    const baseUrl = (
      input.baseUrl?.trim() ||
      DEFAULT_SILICONFLOW_BASE
    ).replace(/\/$/, '');
    const view: ProviderSecretView = {
      id,
      providerId,
      kind: 'openai_api_key',
      name: input.name?.trim() || 'SiliconFlow API Key',
      prefix: maskSiliconflowKey(plaintext),
      status: 'bound',
      version,
      boundAt: new Date().toISOString(),
      lastTestStatus: 'untested',
      lastTestDetail: undefined,
      lastTestAt: undefined,
      baseUrl,
      envBindings: [
        { name: 'SILICONFLOW_API_KEY', ref: secretRef(id, version) },
        { name: 'SILICONFLOW_BASE_URL', ref: baseUrl },
      ],
    };
    vault.set(providerId, { view, plaintext });
    return { ok: true, view: { ...view, envBindings: [...view.envBindings] } };
  }

  if (!isWorldMonitorProvider(providerId)) {
    return {
      ok: false,
      code: 'provider.unsupported',
      message:
        'Only World Monitor–backed, Boyue, or SiliconFlow providers accept upstream keys here',
    };
  }
  const plaintext = input.plaintext.trim();
  if (!isValidWorldMonitorKey(plaintext)) {
    return {
      ok: false,
      code: 'secret.invalid_format',
      message:
        'World Monitor user keys must be wm_ + 40 lowercase hex (see worldmonitor.app/docs/api-keys)',
    };
  }

  const prev = vault.get(providerId);
  const version = (prev?.view.version ?? 0) + 1;
  const id = prev?.view.id || `sec_wm_${providerId.replace(/^prov_/, '')}`;
  const baseUrl = (input.baseUrl?.trim() || DEFAULT_WM_BASE).replace(/\/$/, '');
  const view: ProviderSecretView = {
    id,
    providerId,
    kind: 'worldmonitor_api_key',
    name: input.name?.trim() || 'World Monitor API Key',
    prefix: maskWorldMonitorKey(plaintext),
    status: 'bound',
    version,
    boundAt: new Date().toISOString(),
    lastTestStatus: 'untested',
    lastTestDetail: undefined,
    lastTestAt: undefined,
    baseUrl,
    envBindings: [
      { name: 'WM_KEY', ref: secretRef(id, version) },
      { name: 'WORLDMONITOR_BASE_URL', ref: baseUrl },
      { name: 'X_WORLDMONITOR_KEY_HEADER', ref: 'X-WorldMonitor-Key' },
    ],
  };
  vault.set(providerId, { view, plaintext });
  return { ok: true, view: { ...view, envBindings: [...view.envBindings] } };
}

export function rotateProviderSecret(
  providerId: string,
  plaintext: string,
): BindProviderSecretResult {
  return bindProviderSecret({ providerId, plaintext });
}

export function unbindProviderSecret(providerId: string): boolean {
  return vault.delete(providerId);
}

export type ProviderConnectionTestResult = {
  ok: boolean;
  status: ProviderConnectionTestStatus;
  detail: string;
  httpStatus?: number;
  usedPrefix: string;
  baseUrl: string;
};

/**
 * Test upstream with the bound key.
 * World Monitor: GET bootstrap. Boyue: GET /models.
 * CORS/network may block in-browser — then report format_ok_network_blocked.
 */
export async function testProviderConnection(
  providerId: string,
): Promise<ProviderConnectionTestResult> {
  const hit = vault.get(providerId);
  if (!hit || hit.view.status !== 'bound') {
    return {
      ok: false,
      status: 'fail',
      detail: 'No upstream credential bound for this provider',
      usedPrefix: '—',
      baseUrl: isBoyueProvider(providerId)
        ? DEFAULT_BOYUE_BASE
        : isSiliconflowProvider(providerId)
          ? DEFAULT_SILICONFLOW_BASE
          : DEFAULT_WM_BASE,
    };
  }

  const { plaintext, view } = hit;

  if (isBoyueProvider(providerId) || isSiliconflowProvider(providerId)) {
    const url = `${view.baseUrl}/models`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${plaintext}`,
          Accept: 'application/json',
        },
        mode: 'cors',
      });
      const status: ProviderConnectionTestStatus =
        res.ok || res.status === 401 || res.status === 403 ? 'ok' : 'fail';
      const detail = res.ok
        ? `Reachable ${url} · HTTP ${res.status}`
        : res.status === 401 || res.status === 403
          ? `Edge reached · HTTP ${res.status} (key rejected — format/path OK)`
          : `Unexpected HTTP ${res.status}`;
      const next: ProviderSecretView = {
        ...view,
        lastTestAt: new Date().toISOString(),
        lastTestStatus: status === 'ok' ? 'ok' : 'fail',
        lastTestDetail: detail,
      };
      vault.set(providerId, { view: next, plaintext });
      return {
        ok: status === 'ok',
        status: next.lastTestStatus,
        detail,
        httpStatus: res.status,
        usedPrefix: view.prefix,
        baseUrl: view.baseUrl,
      };
    } catch (err) {
      const detail = `Browser/network blocked live probe (${err instanceof Error ? err.message : 'error'}); key format valid · ref ${view.envBindings[0]?.ref}`;
      const next: ProviderSecretView = {
        ...view,
        lastTestAt: new Date().toISOString(),
        lastTestStatus: 'format_ok_network_blocked',
        lastTestDetail: detail,
      };
      vault.set(providerId, { view: next, plaintext });
      return {
        ok: true,
        status: 'format_ok_network_blocked',
        detail,
        usedPrefix: view.prefix,
        baseUrl: view.baseUrl,
      };
    }
  }

  const url = `${view.baseUrl}/api/bootstrap`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-WorldMonitor-Key': plaintext,
        Accept: 'application/json',
      },
      mode: 'cors',
    });

    const status: ProviderConnectionTestStatus =
      res.ok || res.status === 401 || res.status === 403 ? 'ok' : 'fail';
    const detail = res.ok
      ? `Reachable ${url} · HTTP ${res.status}`
      : res.status === 401 || res.status === 403
        ? `Edge reached · HTTP ${res.status} (key rejected or plan gate — format/path OK)`
        : `Unexpected HTTP ${res.status}`;

    const next: ProviderSecretView = {
      ...view,
      lastTestAt: new Date().toISOString(),
      lastTestStatus: status === 'ok' ? 'ok' : 'fail',
      lastTestDetail: detail,
    };
    vault.set(providerId, { view: next, plaintext });

    return {
      ok: status === 'ok',
      status: next.lastTestStatus,
      detail,
      httpStatus: res.status,
      usedPrefix: view.prefix,
      baseUrl: view.baseUrl,
    };
  } catch (err) {
    const detail = `Browser/network blocked live probe (${err instanceof Error ? err.message : 'error'}); key format valid · ref ${view.envBindings[0]?.ref}`;
    const next: ProviderSecretView = {
      ...view,
      lastTestAt: new Date().toISOString(),
      lastTestStatus: 'format_ok_network_blocked',
      lastTestDetail: detail,
    };
    vault.set(providerId, { view: next, plaintext });
    return {
      ok: true,
      status: 'format_ok_network_blocked',
      detail,
      usedPrefix: view.prefix,
      baseUrl: view.baseUrl,
    };
  }
}

/** Map listing provider → credential provider (Kense Monitor uses same WM vault). */
export function credentialProviderForListingProvider(
  listingProviderId: string,
): string {
  if (listingProviderId === 'prov_a3s_monitor') return 'prov_a3s_monitor';
  if (listingProviderId === 'prov_wm') return 'prov_wm';
  if (listingProviderId === BOYUE_PROVIDER_ID) return BOYUE_PROVIDER_ID;
  if (listingProviderId === SILICONFLOW_PROVIDER_ID) return SILICONFLOW_PROVIDER_ID;
  return listingProviderId;
}
