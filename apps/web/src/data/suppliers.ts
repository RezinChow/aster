/**
 * Ops suppliers — commerce partners that fulfill market products.
 * Config is either platform-owned (no fields) or free-form key/value
 * plus an optional multi–API-key pool for load-balanced upstream calls.
 */

import { CHERRY_MODEL_PROVIDERS } from './cherryModelProviders';
import {
  AISA_RELAY_SERVICES,
  normalizeRelayServices,
  SILICONFLOW_RELAY_SERVICES,
  WORLD_MONITOR_RELAY_SERVICES,
  type RelayService,
} from './relayServices';

export const PLATFORM_SUPPLIER_ID = 'sup_platform';
export const WORLD_MONITOR_SUPPLIER_ID = 'sup_world_monitor';
export const AISA_SUPPLIER_ID = 'sup_aisa';
export const BOYUE_SUPPLIER_ID = 'sup_boyue';
export const SILICONFLOW_SUPPLIER_ID = 'sup_siliconflow';

/** Official World Monitor mark (from worldmonitor.app / Mintlify docs logo). */
export const WORLD_MONITOR_AVATAR_URL = '/suppliers/world-monitor.png';

/** Static mark kept for records that are not the launch tenant. */
export const PLATFORM_LOGO_URL = '/logo/svg/a3s-icon-light-transparent.svg';

/** Platform supplier avatar. Rendered as the current launch-tenant logo. */
export const TENANT_LOGO_AVATAR = 'tenant:logo';

/** Official AIsa mark (orange icon, assets.aisaskills.com). */
export const AISA_AVATAR_URL = '/suppliers/aisa.svg';

/** SiliconFlow mark from the shared provider icon pack. */
export const SILICONFLOW_AVATAR_URL = 'icon:silicon';

export type PlatformSupplierConfig = {
  kind: 'platform';
};

export type SupplierConfigField = {
  key: string;
  value: string;
  secret?: boolean;
};

/**
 * Upstream API key slot — multiple keys enable weighted least-used LB.
 * `callCount` is independent per key and can be manually reset.
 */
export type SupplierApiKey = {
  id: string;
  /** Ops-facing label, e.g. "wm-primary" / "wm-backup". */
  label: string;
  /** Secret plaintext (vaulted in-memory for this console demo). */
  value: string;
  /** Relative weight for load balancing (≥ 1). */
  weight: number;
  enabled: boolean;
  /** Invokes since last reset. */
  callCount: number;
  lastUsedAt?: string;
  resetAt?: string;
  createdAt: string;
};

export type CustomSupplierConfig = {
  kind: 'custom';
  /** Free-form fields — shape differs per supplier. */
  fields: SupplierConfigField[];
  /** Load-balanced upstream API keys (optional). */
  apiKeys?: SupplierApiKey[];
};

export type SupplierConfig = PlatformSupplierConfig | CustomSupplierConfig;

/** Locale-facing supplier labels (Console zh / en). */
export type SupplierNames = {
  zh: string;
  en: string;
};

/** Closed upstream wire protocol. Gateway wires stay this pair. */
export type SupplierProtocol = 'openai' | 'anthropic';

/** One protocol path. The path is appended to the configured base URL. */
export type SupplierWire = {
  id: string;
  protocol: SupplierProtocol;
  /** Optional operator label. Empty falls back to the protocol name in the UI. */
  name: string;
  /** Absolute path beginning with `/`. Never a full URL. */
  path: string;
  enabled: boolean;
};

export const SUPPLIER_MODEL_CAP = 256;
export const SUPPLIER_WIRE_CAP = 16;

export type Supplier = {
  id: string;
  /**
   * Legacy single name — kept in sync with `names.zh` for older call sites.
   * Prefer `supplierDisplayName(supplier, locale)`.
   */
  name: string;
  names: SupplierNames;
  avatarUrl: string;
  /** Optional public website. */
  websiteUrl?: string;
  config: SupplierConfig;
  createdAt: string;
  /**
   * Upstream model ids. Absent until an operator saves the catalog.
   * The detail page treats absence as an empty list.
   */
  models?: string[];
  /**
   * Relay protocol. Absent until an operator saves it.
   * The detail page may preview one from a base URL or from a legacy wire list.
   */
  protocol?: SupplierProtocol;
  /**
   * Legacy path list. Read once to choose a single protocol, then dropped on save.
   */
  wires?: SupplierWire[];
  /**
   * Relay services. Absent until a seed or a save provides them.
   * An explicit empty list means the supplier relays nothing yet.
   */
  services?: RelayService[];
};

export function normalizeSupplierNames(
  input: Partial<SupplierNames> | undefined,
  fallbackName: string,
): SupplierNames {
  const fallback = fallbackName.trim();
  const zh = input?.zh?.trim() || fallback;
  const en = input?.en?.trim() || zh || fallback;
  return {
    zh: zh || en,
    en: en || zh,
  };
}

/** Locale-aware supplier title. */
export function supplierDisplayName(
  supplier: Pick<Supplier, 'name' | 'names'>,
  locale: 'zh' | 'en',
): string {
  const names = supplier.names;
  if (locale === 'en') {
    return (
      names?.en?.trim() || names?.zh?.trim() || supplier.name.trim() || '—'
    );
  }
  return names?.zh?.trim() || names?.en?.trim() || supplier.name.trim() || '—';
}

const STORAGE_KEY = 'kense.console.suppliers.v1';

function avatarMark(letter: string, bg: string, round = true): string {
  const radius = round ? 16 : 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${radius}" fill="${bg}"/><text x="16" y="21" text-anchor="middle" fill="#f8fafc" font-size="13" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="700">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function newApiKeyId(): string {
  return `sak_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptySupplierApiKey(
  label = '',
): SupplierApiKey {
  const now = new Date().toISOString();
  return {
    id: newApiKeyId(),
    label,
    value: '',
    weight: 1,
    enabled: true,
    callCount: 0,
    createdAt: now,
  };
}

function cloneApiKey(k: SupplierApiKey): SupplierApiKey {
  return { ...k };
}

const ANTHROPIC_DEFAULT_WIRE_IDS = new Set([
  'sup_cs_anthropic',
  'sup_cs_claude_code',
]);

export function isSupplierModelId(raw: string): boolean {
  const id = raw.trim();
  return id.length > 0 && id.length <= 128 && !/\s/.test(id);
}

/** Trim, drop blanks and whitespace, dedupe, keep order, cap at 256. */
export function normalizeSupplierModels(
  raw: readonly string[] | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw ?? []) {
    if (out.length >= SUPPLIER_MODEL_CAP) break;
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!isSupplierModelId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isSupplierWirePath(raw: string): boolean {
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://') || /\s/.test(path)) return false;
  return path.length <= 200;
}

function isSupplierProtocol(value: string): value is SupplierProtocol {
  return value === 'openai' || value === 'anthropic';
}

/** Drop invalid rows, dedupe protocol+path, cap at 16. Empty input stays empty. */
export function normalizeSupplierWires(
  raw: readonly SupplierWire[] | undefined,
): SupplierWire[] {
  const out: SupplierWire[] = [];
  const seen = new Set<string>();
  for (const row of raw ?? []) {
    if (out.length >= SUPPLIER_WIRE_CAP) break;
    if (!row || typeof row !== 'object') continue;
    if (!isSupplierProtocol(row.protocol)) continue;
    if (typeof row.path !== 'string' || !isSupplierWirePath(row.path)) continue;
    const path = row.path.trim();
    const key = `${row.protocol}\n${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id || out.some((wire) => wire.id === id)) {
      id = `wire_${out.length + 1}`;
    }
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '';
    out.push({
      id,
      protocol: row.protocol,
      name,
      path,
      enabled: row.enabled !== false,
    });
  }
  return out;
}

function hasBaseUrl(config: SupplierConfig): boolean {
  if (config.kind !== 'custom') return false;
  return config.fields.some(
    (field) => field.key === 'baseUrl' && field.value.trim().length > 0,
  );
}

export function supplierModelsDraft(
  supplier: Pick<Supplier, 'models'>,
): string[] {
  return normalizeSupplierModels(supplier.models);
}

/** Path owned by the protocol. Anthropic uses `/messages`. */
export function supplierProtocolPath(protocol: SupplierProtocol): string {
  return protocol === 'anthropic' ? '/messages' : '/chat/completions';
}

/** Enabled Anthropic wins. Otherwise the first enabled OpenAI entry. */
export function collapseSupplierWires(
  wires: readonly SupplierWire[],
): SupplierProtocol | undefined {
  const enabled = normalizeSupplierWires(wires).filter((wire) => wire.enabled);
  if (enabled.some((wire) => wire.protocol === 'anthropic')) return 'anthropic';
  return enabled.some((wire) => wire.protocol === 'openai') ? 'openai' : undefined;
}

/**
 * Saved protocol wins. A saved wire list collapses to one protocol, and an
 * explicit empty list stays unset. With neither, a base URL previews OpenAI,
 * except Anthropic and Claude Code.
 */
export function supplierProtocolDraft(
  supplier: Pick<Supplier, 'id' | 'config' | 'protocol' | 'wires'>,
): SupplierProtocol | undefined {
  if (supplier.protocol && isSupplierProtocol(supplier.protocol)) return supplier.protocol;
  if (supplier.wires !== undefined) return collapseSupplierWires(supplier.wires);
  if (!hasBaseUrl(supplier.config)) return undefined;
  return ANTHROPIC_DEFAULT_WIRE_IDS.has(supplier.id) ? 'anthropic' : 'openai';
}

/**
 * Saved services win, including an explicit empty list.
 * A legacy wire list becomes one interface per wire, so both protocols stay.
 * Otherwise a single preview interface follows the protocol draft.
 */
export function supplierServicesDraft(
  supplier: Pick<Supplier, 'id' | 'config' | 'protocol' | 'wires' | 'services'>,
): RelayService[] {
  if (supplier.services) return normalizeRelayServices(supplier.services);
  if (supplier.wires) {
    const wires = normalizeSupplierWires(supplier.wires).filter((wire) => wire.enabled);
    if (wires.length === 0) return [];
    return normalizeRelayServices([
      {
        id: 'svc_model',
        class: 'model',
        name: 'model',
        interfaces: wires.map((wire, index) => ({
          id: wire.id || `if_${index + 1}`,
          protocol: wire.protocol,
          name: wire.name || (wire.protocol === 'anthropic' ? 'messages' : 'chat'),
          method: 'POST' as const,
          path: wire.path,
        })),
      },
    ]);
  }
  const protocol = supplierProtocolDraft(supplier);
  if (!protocol) return [];
  return normalizeRelayServices([
    {
      id: 'svc_model',
      class: 'model',
      name: 'model',
      interfaces: [
        {
          id: 'if_1',
          protocol,
          name: protocol === 'anthropic' ? 'messages' : 'chat',
          method: 'POST',
          path: supplierProtocolPath(protocol),
        },
      ],
    },
  ]);
}

function cloneConfig(config: SupplierConfig): SupplierConfig {
  if (config.kind === 'platform') return { ...config };
  return {
    kind: 'custom',
    fields: config.fields.map((f) => ({ ...f })),
    apiKeys: config.apiKeys?.map(cloneApiKey),
  };
}

function clone(s: Supplier): Supplier {
  const names = normalizeSupplierNames(s.names, s.name);
  return {
    ...s,
    names,
    name: names.zh,
    websiteUrl: s.websiteUrl,
    config: cloneConfig(s.config),
    models: Array.isArray(s.models) ? normalizeSupplierModels(s.models) : undefined,
    protocol: isSupplierProtocol(s.protocol ?? '') ? s.protocol : undefined,
    wires: Array.isArray(s.wires) ? normalizeSupplierWires(s.wires) : undefined,
    services: Array.isArray(s.services) ? normalizeRelayServices(s.services) : undefined,
  };
}

function seedSuppliers(): Supplier[] {
  return [
    {
      id: PLATFORM_SUPPLIER_ID,
      name: '平台自营',
      names: { zh: '平台自营', en: 'Platform' },
      avatarUrl: TENANT_LOGO_AVATAR,
      websiteUrl: undefined,
      config: { kind: 'platform' },
      createdAt: '2026-01-01',
    },
    {
      id: WORLD_MONITOR_SUPPLIER_ID,
      name: 'World Monitor',
      names: { zh: 'World Monitor', en: 'World Monitor' },
      avatarUrl: WORLD_MONITOR_AVATAR_URL,
      websiteUrl: 'https://www.worldmonitor.app',
      config: {
        kind: 'custom',
        fields: [
          {
            key: 'baseUrl',
            value: 'https://api.worldmonitor.app',
            secret: true,
          },
          {
            key: 'apiKeyHeader',
            value: 'X-WorldMonitor-Key',
            secret: true,
          },
          {
            key: 'mcpUrl',
            value: 'https://www.worldmonitor.app/mcp',
            secret: true,
          },
          {
            key: 'sandboxBase',
            value: 'https://www.worldmonitor.app/sandbox',
            secret: true,
          },
          {
            key: 'docsUrl',
            value: 'https://www.worldmonitor.app/docs/zh/documentation',
            secret: true,
          },
          { key: 'defaultRateLimit', value: '600/60s', secret: true },
        ],
        apiKeys: [],
      },
      services: WORLD_MONITOR_RELAY_SERVICES,
      createdAt: '2026-03-01',
    },
    {
      id: AISA_SUPPLIER_ID,
      name: 'AIsa',
      names: { zh: 'AIsa', en: 'AIsa' },
      avatarUrl: AISA_AVATAR_URL,
      websiteUrl: 'https://aisa.one',
      config: {
        kind: 'custom',
        fields: [
          { key: 'baseUrl', value: 'https://api.aisa.one', secret: true },
          { key: 'apiKeyHeader', value: 'Authorization', secret: true },
          { key: 'authScheme', value: 'Bearer', secret: true },
          { key: 'keyPrefix', value: 'sk-aisa-', secret: true },
          { key: 'docsUrl', value: 'https://aisa.one/docs/zh/guides', secret: true },
          { key: 'mcpUrl', value: 'https://mcp.aisa.one/mcp', secret: true },
        ],
        apiKeys: [],
      },
      services: AISA_RELAY_SERVICES,
      createdAt: '2026-09-19',
    },
    {
      id: BOYUE_SUPPLIER_ID,
      name: 'Boyue',
      names: { zh: 'Boyue', en: 'Boyue' },
      avatarUrl: PLATFORM_LOGO_URL,
      websiteUrl: undefined,
      config: {
        kind: 'custom',
        fields: [
          {
            key: 'baseUrl',
            value: 'http://35.220.164.252:3888/v1',
            secret: true,
          },
          { key: 'apiKeyHeader', value: 'Authorization', secret: true },
          { key: 'authScheme', value: 'Bearer', secret: true },
          {
            key: 'notes',
            value:
              'OpenAI-compatible. Bind API keys here (or Marketplace → Provider Credentials); Console syncs into @a3s/runtime vault.',
            secret: true,
          },
        ],
        apiKeys: [],
      },
      createdAt: '2026-09-20',
    },
    {
      id: SILICONFLOW_SUPPLIER_ID,
      name: '硅基流动',
      names: { zh: '硅基流动', en: 'SiliconFlow' },
      avatarUrl: SILICONFLOW_AVATAR_URL,
      websiteUrl: 'https://siliconflow.cn',
      config: {
        kind: 'custom',
        fields: [
          {
            key: 'baseUrl',
            value: 'https://api.siliconflow.cn/v1',
            secret: true,
          },
          { key: 'apiKeyHeader', value: 'Authorization', secret: true },
          { key: 'authScheme', value: 'Bearer', secret: true },
          {
            key: 'docsUrl',
            value:
              'https://api-docs.siliconflow.cn/docs/userguide/introduction',
            secret: true,
          },
          {
            key: 'notes',
            value:
              'OpenAI + Anthropic compatible. Bind API keys here (or Marketplace → Provider Credentials); Console syncs into @a3s/runtime vault. Product covers chat / completions / messages / embeddings / rerank / image / video / speech / transcription / voice / models / batch / userinfo.',
            secret: true,
          },
        ],
        apiKeys: [],
      },
      services: SILICONFLOW_RELAY_SERVICES,
      createdAt: '2026-09-20',
    },
    ...CHERRY_MODEL_PROVIDERS,
  ];
}

const BUILTIN_SUPPLIER_IDS = new Set(seedSuppliers().map((supplier) => supplier.id));

/** Seeded suppliers, including 平台自营 and the Cherry provider set. */
export function isBuiltinSupplier(id: string): boolean {
  return BUILTIN_SUPPLIER_IDS.has(id);
}

function isSupplierRecord(value: unknown): value is Supplier {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<Supplier>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.avatarUrl === 'string' &&
    typeof row.createdAt === 'string' &&
    row.config != null &&
    typeof row.config === 'object'
  );
}

function readStored(): Supplier[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isSupplierRecord).map((row) => clone(row));
  } catch {
    return null;
  }
}

function persist(list: Supplier[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Quota or private mode — keep in-memory only.
  }
}

/** Rows previously imported from models.dev. They are not operators. */
function isCatalogImport(supplier: Supplier): boolean {
  if (supplier.id.startsWith('sup_md_')) return true;
  const raw = supplier as Supplier & { modelsDevId?: string };
  if (typeof raw.modelsDevId === 'string' && raw.modelsDevId.trim()) return true;
  if (supplier.config.kind !== 'custom') return false;
  return supplier.config.fields.some(
    (field) => field.key === 'source' && field.value === 'models.dev',
  );
}

function hydrate(): Supplier[] {
  const seeds = seedSuppliers();
  const stored = readStored()?.filter((row) => !isCatalogImport(row)) ?? null;
  if (!stored) return seeds.map(clone);
  const byId = new Map(stored.map((s) => [s.id, s]));
  for (const seed of seeds) {
    if (!byId.has(seed.id)) byId.set(seed.id, clone(seed));
  }
  const seedIds = new Set(seeds.map((s) => s.id));
  const extras = [...byId.values()]
    .filter((s) => !seedIds.has(s.id))
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name),
    );
  const next = [
    ...seeds.map((seed) => {
      const storedRow = byId.get(seed.id)!;
      // Keep official seed identity (names + mark) fresh.
      return clone({
        ...storedRow,
        names: seed.names,
        name: seed.names.zh,
        avatarUrl: seed.avatarUrl,
        services: Array.isArray(storedRow.services) ? storedRow.services : seed.services,
      });
    }),
    ...extras.map(clone),
  ];
  persist(next);
  return next;
}

let suppliers: Supplier[] = hydrate();

function commit(next: Supplier[]) {
  suppliers = next;
  persist(suppliers);
}

export function listSuppliers(): Supplier[] {
  return suppliers.map(clone);
}

export function findSupplier(id: string): Supplier | undefined {
  const hit = suppliers.find((s) => s.id === id);
  return hit ? clone(hit) : undefined;
}

export function resolveSupplier(id?: string | null): Supplier {
  return findSupplier(id || PLATFORM_SUPPLIER_ID) ?? findSupplier(PLATFORM_SUPPLIER_ID)!;
}

export function updateSupplier(
  id: string,
  patch: {
    name?: string;
    names?: Partial<SupplierNames>;
    avatarUrl?: string;
    websiteUrl?: string | null;
    config?: SupplierConfig;
    models?: string[];
    /** `null` clears a saved protocol. */
    protocol?: SupplierProtocol | null;
    /** `null` drops a legacy wire list. */
    wires?: SupplierWire[] | null;
    /** `null` clears relay services. */
    services?: RelayService[] | null;
  },
): Supplier | undefined {
  const idx = suppliers.findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  const prev = suppliers[idx]!;
  const websiteUrl =
    patch.websiteUrl === null
      ? undefined
      : patch.websiteUrl !== undefined
        ? patch.websiteUrl.trim() || undefined
        : prev.websiteUrl;
  const names = normalizeSupplierNames(
    {
      zh: patch.names?.zh ?? patch.name ?? prev.names?.zh ?? prev.name,
      en: patch.names?.en ?? prev.names?.en ?? patch.name ?? prev.name,
    },
    patch.name?.trim() || prev.name,
  );
  const next: Supplier = {
    ...prev,
    names,
    name: names.zh,
    avatarUrl:
      prev.id === PLATFORM_SUPPLIER_ID
        ? TENANT_LOGO_AVATAR
        : patch.avatarUrl?.trim() || prev.avatarUrl,
    websiteUrl,
    config: patch.config
      ? cloneConfig(patch.config)
      : prev.config,
    models:
      patch.models !== undefined
        ? normalizeSupplierModels(patch.models)
        : prev.models,
    protocol:
      patch.protocol === null
        ? undefined
        : patch.protocol !== undefined
          ? patch.protocol
          : prev.protocol,
    wires:
      patch.wires === null
        ? undefined
        : patch.wires !== undefined
          ? normalizeSupplierWires(patch.wires)
          : prev.wires,
    services:
      patch.services === null
        ? undefined
        : patch.services !== undefined
          ? normalizeRelayServices(patch.services)
          : prev.services,
  };
  commit(suppliers.map((s, i) => (i === idx ? next : s)));
  return clone(next);
}

/** Built-in suppliers stay in the catalog. Only operator-created rows can be removed. */
export function deleteSupplier(id: string): boolean {
  if (isBuiltinSupplier(id)) return false;
  const next = suppliers.filter((supplier) => supplier.id !== id);
  if (next.length === suppliers.length) return false;
  commit(next);
  return true;
}

export function createSupplier(input: {
  name?: string;
  names?: Partial<SupplierNames>;
  avatarUrl?: string;
  websiteUrl?: string;
  config: SupplierConfig;
}): Supplier {
  const names = normalizeSupplierNames(
    input.names,
    input.name?.trim() || input.names?.zh || input.names?.en || '',
  );
  if (!names.zh && !names.en) {
    throw new Error('supplier name required');
  }
  const id = `sup_${Date.now().toString(36)}`;
  const supplier: Supplier = {
    id,
    names,
    name: names.zh,
    avatarUrl:
      input.avatarUrl?.trim() ||
      avatarMark((names.zh[0] ?? names.en[0] ?? 'S').toUpperCase(), '#334155'),
    websiteUrl: input.websiteUrl?.trim() || undefined,
    config: cloneConfig(input.config),
    createdAt: new Date().toISOString().slice(0, 10),
  };
  commit([supplier, ...suppliers]);
  return clone(supplier);
}

export function defaultAvatarForName(name: string): string {
  return avatarMark((name.trim()[0] ?? 'S').toUpperCase(), '#334155');
}

export function listSupplierApiKeys(supplierId: string): SupplierApiKey[] {
  const s = suppliers.find((x) => x.id === supplierId);
  if (!s || s.config.kind !== 'custom') return [];
  return (s.config.apiKeys ?? []).map(cloneApiKey);
}

export function getSupplierField(
  supplierId: string,
  key: string,
): string | undefined {
  const s = suppliers.find((x) => x.id === supplierId);
  if (!s || s.config.kind !== 'custom') return undefined;
  return s.config.fields.find((f) => f.key === key)?.value;
}

/**
 * Weighted least-used pick among enabled keys with a non-empty value.
 * score = callCount / weight — lower wins (manual reset rebalances the pool).
 */
export function pickSupplierApiKey(
  supplierId: string,
): SupplierApiKey | undefined {
  const keys = listSupplierApiKeys(supplierId).filter(
    (k) => k.enabled && k.value.trim().length > 0,
  );
  if (keys.length === 0) return undefined;
  return keys.reduce((best, cur) => {
    const bestScore = best.callCount / Math.max(1, best.weight);
    const curScore = cur.callCount / Math.max(1, cur.weight);
    return curScore < bestScore ? cur : best;
  });
}

export function recordSupplierApiKeyCall(
  supplierId: string,
  keyId: string,
): SupplierApiKey | undefined {
  const idx = suppliers.findIndex((s) => s.id === supplierId);
  if (idx < 0) return undefined;
  const prev = suppliers[idx]!;
  if (prev.config.kind !== 'custom') return undefined;
  const keys = [...(prev.config.apiKeys ?? [])];
  const kIdx = keys.findIndex((k) => k.id === keyId);
  if (kIdx < 0) return undefined;
  const now = new Date().toISOString();
  const nextKey: SupplierApiKey = {
    ...keys[kIdx]!,
    callCount: keys[kIdx]!.callCount + 1,
    lastUsedAt: now,
  };
  keys[kIdx] = nextKey;
  commit(
    suppliers.map((s, i) =>
      i === idx
        ? {
            ...s,
            config: {
              kind: 'custom',
              fields: s.config.kind === 'custom' ? s.config.fields : [],
              apiKeys: keys,
            },
          }
        : s,
    ),
  );
  return cloneApiKey(nextKey);
}

export function resetSupplierApiKeyCalls(
  supplierId: string,
  keyId: string,
): SupplierApiKey | undefined {
  const idx = suppliers.findIndex((s) => s.id === supplierId);
  if (idx < 0) return undefined;
  const prev = suppliers[idx]!;
  if (prev.config.kind !== 'custom') return undefined;
  const keys = [...(prev.config.apiKeys ?? [])];
  const kIdx = keys.findIndex((k) => k.id === keyId);
  if (kIdx < 0) return undefined;
  const now = new Date().toISOString();
  const nextKey: SupplierApiKey = {
    ...keys[kIdx]!,
    callCount: 0,
    resetAt: now,
  };
  keys[kIdx] = nextKey;
  const fields = prev.config.fields;
  commit(
    suppliers.map((s, i) =>
      i === idx
        ? { ...s, config: { kind: 'custom', fields, apiKeys: keys } }
        : s,
    ),
  );
  return cloneApiKey(nextKey);
}

export function maskApiKeyValue(raw: string): string {
  const v = raw.trim();
  if (!v) return '—';
  if (v.length <= 10) return `${v.slice(0, 3)}…`;
  return `${v.slice(0, 7)}…${v.slice(-4)}`;
}

export function apiKeysEqual(
  a: SupplierApiKey[] | undefined,
  b: SupplierApiKey[] | undefined,
): boolean {
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((row, i) => {
    const other = right[i];
    if (!other) return false;
    return (
      row.id === other.id &&
      row.label === other.label &&
      row.value === other.value &&
      row.weight === other.weight &&
      row.enabled === other.enabled &&
      row.callCount === other.callCount
    );
  });
}
