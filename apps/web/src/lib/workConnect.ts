/**
 * Work Connect / Try It endpoint resolution.
 *
 * Priority for Gateway baseURL:
 *   1. Settings local override
 *   2. Build env `PUBLIC_GATEWAY_BASE_URL`
 *   3. Local a3s-gateway `http://127.0.0.1:8080` (docker compose)
 *   4. Docs placeholder `https://gw.example.com` (last resort)
 *
 * a3s-api management JSON is reached via relative `/api`
 * (rsbuild → host a3s-api :3000). Gateway :8080 is the data plane.
 * Never treat Console origin as the Work Gateway baseURL.
 */

const DEFAULT_GATEWAY_HOST = 'https://gw.example.com';
/** Local a3s-gateway public entry (docker compose :8080). */
export const LOCAL_GATEWAY_LISTEN = 'http://127.0.0.1:8080';
const OVERRIDE_KEY = 'kense.gatewayBaseUrl.v1';
/** Upstream process started by `just api`. Browser traffic does not hit this port. */
export const LOCAL_API_LISTEN = 'http://127.0.0.1:3000';

/** Local demo Capability Key for Try It / preview attribution. */
export const LOCAL_GATEWAY_DEV_KEY =
  'a3s_sk_devlocalgateway00000000000001';

export type GatewayBaseSource =
  | 'override'
  | 'env'
  | 'local'
  | 'placeholder';

export type WorkConnectDiscovery = {
  gatewayBaseUrl: string;
  gatewayOrigin: string;
  gatewaySource: GatewayBaseSource;
  /** Browser-facing Console API prefix (usually `/api`). */
  apiProxyBase: string;
  /** Absolute URL shown for ops when API is local. */
  apiListenHint: string;
  apiReachable: boolean | null;
  gatewayReachable: boolean | null;
};

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url.includes('://') ? url : `http://${url}`).hostname;
  } catch {
    return null;
  }
}

function readOverride(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY)?.trim() ?? '';
    if (!raw) return '';
    if (hostnameOf(raw) === 'gw.example.com') {
      localStorage.removeItem(OVERRIDE_KEY);
      return '';
    }
    return raw;
  } catch {
    return '';
  }
}

function envGatewayBase(): string {
  return import.meta.env.PUBLIC_GATEWAY_BASE_URL?.trim() || '';
}

function browserOrigin(): string {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  if (
    window.location.protocol === 'http:' ||
    window.location.protocol === 'https:'
  ) {
    return window.location.origin;
  }
  return '';
}

function isLocalConsoleHost(): boolean {
  const host = hostnameOf(browserOrigin());
  return host === 'localhost' || host === '127.0.0.1';
}

function normalizeBase(raw: string): string {
  const trimmed = stripTrailingSlash(raw);
  if (trimmed.endsWith('/v1')) return trimmed;
  return `${trimmed}/v1`;
}

function classifySource(
  override: string,
  env: string,
  local: boolean,
): GatewayBaseSource {
  if (override) return 'override';
  if (env) {
    return hostnameOf(env) === 'gw.example.com' ? 'placeholder' : 'env';
  }
  if (local) return 'local';
  return 'placeholder';
}

/** Local Console override (Settings → Debug). Empty = auto. */
export function getGatewayBaseUrlOverride(): string {
  return readOverride();
}

export function setGatewayBaseUrlOverride(url: string | null): void {
  if (typeof localStorage === 'undefined') return;
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    localStorage.removeItem(OVERRIDE_KEY);
  } else {
    localStorage.setItem(OVERRIDE_KEY, stripTrailingSlash(trimmed));
  }
  emitGatewayBaseListeners();
}

const listeners = new Set<() => void>();

function emitGatewayBaseListeners() {
  for (const listener of listeners) listener();
}

export function subscribeGatewayBaseUrl(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolveRawGatewayHost(): string {
  return (
    readOverride() ||
    envGatewayBase() ||
    (isLocalConsoleHost() ? LOCAL_GATEWAY_LISTEN : '') ||
    DEFAULT_GATEWAY_HOST
  );
}

export function resolveGatewayBase(): {
  baseUrl: string;
  origin: string;
  source: GatewayBaseSource;
} {
  const override = readOverride();
  const env = envGatewayBase();
  const local = !override && !env && isLocalConsoleHost();
  const raw = resolveRawGatewayHost();
  const baseUrl = normalizeBase(raw);
  return {
    baseUrl,
    origin: stripTrailingSlash(baseUrl.replace(/\/v1$/, '')),
    source: classifySource(override, env, local),
  };
}

/**
 * OpenAI-compatible Connect baseURL — always ends with `/v1`.
 */
export function gatewayBaseUrl(): string {
  return resolveGatewayBase().baseUrl;
}

export function gatewayOrigin(): string {
  return resolveGatewayBase().origin;
}

export function isPlaceholderGatewayBase(): boolean {
  return hostnameOf(gatewayOrigin()) === 'gw.example.com';
}

/**
 * True when Work tool invoke must not pretend to be a live Gateway hop.
 * Local a3s-gateway is the real entry; `/v1` Function routes may still be
 * unpublished — callers should fall back to explicit preview.
 */
export function isConsoleToolInvokePreview(): boolean {
  const { source } = resolveGatewayBase();
  if (source === 'placeholder') return true;
  if (isPlaceholderGatewayBase()) return true;
  return false;
}

export function gatewayAbsoluteUrl(path: string): string {
  const origin = gatewayOrigin();
  let p = path.startsWith('/') ? path : `/${path}`;
  if (!p.startsWith('/v1/') && p !== '/v1') {
    p = `/v1${p === '/' ? '' : p}`;
  }
  return `${origin}${p}`;
}

export function gatewayPathUnderV1(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (p.startsWith('/v1/')) return p.slice(3) || '/';
  if (p === '/v1') return '/';
  return p;
}

export function parseToolSkuFromPath(path: string): string | null {
  const raw = path.split('?')[0] ?? path;
  const m = raw.match(/\/(?:v1\/)?tools\/([^/]+)\/invoke\/?$/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/** Parse opaque listing from `/v1/api/services/{kind}/invoke/{sku}`. */
export function parseServiceInvokeFromPath(
  path: string,
): { kind: 'model' | 'tool' | 'api' | 'feed'; sku: string } | null {
  const raw = path.split('?')[0] ?? path;
  const m = raw.match(
    /\/(?:v1\/)?api\/services\/(model|tool|api|feed)\/invoke\/([^/]+)\/?$/i,
  );
  if (!m?.[1] || !m[2]) return null;
  let sku = m[2];
  try {
    sku = decodeURIComponent(sku);
  } catch {
    /* keep */
  }
  return {
    kind: m[1].toLowerCase() as 'model' | 'tool' | 'api' | 'feed',
    sku,
  };
}

export function consoleApiProxyBase(): string {
  return (
    (import.meta.env.PUBLIC_A3S_API_BASE ?? '/v1/api/admin').replace(/\/$/, '') ||
    '/v1/api/admin'
  );
}

/**
 * Absolute hint for where Console `/api` is sent.
 * Locally that is a3s-gateway, which proxies to a3s-api.
 */
export function consoleApiListenHint(): string {
  const origin = browserOrigin();
  if (!origin) return LOCAL_GATEWAY_LISTEN;
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return LOCAL_GATEWAY_LISTEN;
    }
    return `${u.origin}${consoleApiProxyBase()}`;
  } catch {
    return LOCAL_GATEWAY_LISTEN;
  }
}

export async function probeGatewayHealth(
  origin = gatewayOrigin(),
): Promise<boolean> {
  const base = stripTrailingSlash(origin);
  // a3s-gateway has no bare /health route (404). Local spine readiness is
  // /v1/api/health → Function; /v1/api/admin/health → a3s-api. Prefer /v1 for Work plane.
  for (const path of [
    '/v1/api/health',
    '/v1/api/admin/health',
    '/api/health',
    '/health',
    '/health/ready',
    '/health/live',
  ]) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) return true;
    } catch {
      // try next probe path
    }
  }
  return false;
}

/** Probe a3s-api via Console proxy and resolve Gateway base in one shot. */
export async function discoverWorkConnect(): Promise<WorkConnectDiscovery> {
  const resolved = resolveGatewayBase();
  const apiProxyBase = consoleApiProxyBase();
  let apiReachable: boolean | null = null;
  try {
    const res = await fetch(`${apiProxyBase}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    apiReachable = res.ok || res.status === 503;
  } catch {
    apiReachable = false;
  }
  const gatewayReachable = await probeGatewayHealth(resolved.origin);
  return {
    gatewayBaseUrl: resolved.baseUrl,
    gatewayOrigin: resolved.origin,
    gatewaySource: resolved.source,
    apiProxyBase,
    apiListenHint: consoleApiListenHint(),
    apiReachable,
    gatewayReachable,
  };
}

export function formatWorkConnectSnippet(
  opts?: { apiKey?: string; baseURL?: string } | string,
  apiKeyLegacy?: string,
): string {
  let baseURL = gatewayBaseUrl();
  let apiKey = 'a3s_sk_••••••••';
  if (typeof opts === 'string') {
    baseURL = opts;
    if (apiKeyLegacy) apiKey = apiKeyLegacy;
  } else if (opts) {
    if (opts.baseURL) baseURL = opts.baseURL;
    if (opts.apiKey) apiKey = opts.apiKey;
  }
  return `# Work Connect
baseURL: ${baseURL}
api_key: ${apiKey}`;
}

export function formatOpenAiEnvExports(opts?: {
  apiKey?: string;
  baseURL?: string;
}): string {
  const baseURL = opts?.baseURL ?? gatewayBaseUrl();
  const apiKey = opts?.apiKey ?? 'a3s_sk_••••••••';
  return `export OPENAI_BASE_URL="${baseURL}"
export OPENAI_API_KEY="${apiKey}"`;
}
