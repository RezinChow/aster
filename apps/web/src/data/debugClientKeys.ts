/**
 * Debug client API keys — local Console vault for Try It / playground auth.
 * Secrets are system-generated (`a3s_sk_…`) and stay in this browser only.
 * Not an authority for Gateway ACL.
 */

const STORAGE_KEY = 'kense.debugClientKeys.v1';

export type DebugClientKey = {
  id: string;
  /** Ops-facing label, e.g. "local-work" / "staging". */
  label: string;
  /** Full Capability Key / client secret (local only). */
  secret: string;
  /** When false, hidden from Try It pickers. */
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type Persisted = {
  keys: DebugClientKey[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `dck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Same shape as Console Capability Keys (`a3s_sk_` + random hex). */
export function generateDebugClientSecret(): string {
  const body = Array.from(crypto.getRandomValues(new Uint8Array(18)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `a3s_sk_${body}`;
}

function readAll(): DebugClientKey[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || !Array.isArray(parsed.keys)) return [];
    return parsed.keys
      .filter(
        (k) =>
          k &&
          typeof k.id === 'string' &&
          typeof k.label === 'string' &&
          typeof k.secret === 'string',
      )
      .map((k) => ({
        id: k.id,
        label: k.label,
        secret: k.secret,
        enabled: k.enabled !== false,
        createdAt: k.createdAt || nowIso(),
        updatedAt: k.updatedAt || k.createdAt || nowIso(),
      }));
  } catch {
    return [];
  }
}

function writeAll(keys: DebugClientKey[]): void {
  if (typeof localStorage === 'undefined') return;
  const payload: Persisted = { keys };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function maskDebugClientSecret(secret: string): string {
  const v = secret.trim();
  if (!v) return '—';
  if (v.length <= 12) return `${v.slice(0, 4)}…`;
  return `${v.slice(0, 10)}…${v.slice(-4)}`;
}

export function listDebugClientKeys(): DebugClientKey[] {
  ensureLocalGatewayDebugKey();
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Ensure a local demo Capability Key exists for Try It pickers. */
export function ensureLocalGatewayDebugKey(): DebugClientKey {
  const { LOCAL_GATEWAY_DEV_KEY } = requireLocalGatewayKey();
  const existing = readAll().find((k) => k.secret === LOCAL_GATEWAY_DEV_KEY);
  if (existing) return existing;
  const stamp = nowIso();
  const row: DebugClientKey = {
    id: 'dck_local_gateway',
    label: 'local-demo',
    secret: LOCAL_GATEWAY_DEV_KEY,
    enabled: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  writeAll([row, ...readAll().filter((k) => k.id !== row.id)]);
  return row;
}

function requireLocalGatewayKey(): { LOCAL_GATEWAY_DEV_KEY: string } {
  return {
    LOCAL_GATEWAY_DEV_KEY: 'a3s_sk_devlocalgateway00000000000001',
  };
}

/** Enabled keys with non-empty secrets — for Try It pickers. */
export function listEnabledDebugClientKeys(): DebugClientKey[] {
  return listDebugClientKeys().filter(
    (k) => k.enabled && k.secret.trim().length > 0,
  );
}

export function findDebugClientKey(id: string): DebugClientKey | undefined {
  return readAll().find((k) => k.id === id);
}

export function createDebugClientKey(input: {
  label: string;
}): DebugClientKey {
  const stamp = nowIso();
  const row: DebugClientKey = {
    id: newId(),
    label: input.label.trim() || 'Debug key',
    secret: generateDebugClientSecret(),
    enabled: true,
    createdAt: stamp,
    updatedAt: stamp,
  };
  writeAll([row, ...readAll()]);
  return { ...row };
}

export function updateDebugClientKey(
  id: string,
  patch: Partial<Pick<DebugClientKey, 'label' | 'enabled'>>,
): DebugClientKey | undefined {
  const keys = readAll();
  const idx = keys.findIndex((k) => k.id === id);
  if (idx < 0) return undefined;
  const prev = keys[idx]!;
  const next: DebugClientKey = {
    ...prev,
    label:
      patch.label !== undefined
        ? patch.label.trim() || prev.label
        : prev.label,
    enabled: patch.enabled !== undefined ? patch.enabled : prev.enabled,
    updatedAt: nowIso(),
  };
  keys[idx] = next;
  writeAll(keys);
  return { ...next };
}

/** Issue a new secret for an existing row (local regenerate). */
export function regenerateDebugClientSecret(
  id: string,
): DebugClientKey | undefined {
  const keys = readAll();
  const idx = keys.findIndex((k) => k.id === id);
  if (idx < 0) return undefined;
  const prev = keys[idx]!;
  const next: DebugClientKey = {
    ...prev,
    secret: generateDebugClientSecret(),
    updatedAt: nowIso(),
  };
  keys[idx] = next;
  writeAll(keys);
  return { ...next };
}

export function removeDebugClientKey(id: string): boolean {
  const keys = readAll();
  const next = keys.filter((k) => k.id !== id);
  if (next.length === keys.length) return false;
  writeAll(next);
  return true;
}
