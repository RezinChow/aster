/**
 * Relay services on a commerce supplier.
 *
 * A supplier is one connection. What it relays is a list of services:
 * model interfaces (any protocol id), non-model HTTP groups, and MCP.
 * Protocol ids are open. A path belongs to one interface, not to the supplier.
 */

export type RelayServiceClass = 'model' | 'api' | 'mcp';

export const RELAY_SERVICE_CLASSES: readonly RelayServiceClass[] = ['model', 'api', 'mcp'];

export const RELAY_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type RelayMethod = (typeof RELAY_METHODS)[number];

export const RELAY_INTERFACE_CAP = 32;
export const RELAY_GROUP_CAP = 16;
export const RELAY_OPERATION_CAP = 32;

/** Known ids only fill a suggested path. Any other id is stored as typed. */
export const RELAY_PROTOCOL_PRESETS = ['openai', 'anthropic', 'gemini', 'cohere', 'mistral'] as const;

const SUGGESTED_PATH: Record<string, string> = {
  openai: '/chat/completions',
  anthropic: '/messages',
  cohere: '/chat',
  mistral: '/chat/completions',
};

export type RelayInterface = {
  id: string;
  protocol: string;
  /** Stable label key, or free text when it is not a known key. */
  name: string;
  method: RelayMethod;
  path: string;
};

export type RelayOperation = {
  id: string;
  name: string;
  method: RelayMethod;
  path: string;
};

export type RelayApiGroup = {
  id: string;
  /** Stable label key, or a free group name. */
  name: string;
  operations: RelayOperation[];
};

export type RelayService = {
  id: string;
  class: RelayServiceClass;
  name: string;
  interfaces?: RelayInterface[];
  groups?: RelayApiGroup[];
  path?: string;
};

export function isRelayProtocolId(raw: string): boolean {
  return /^[a-z][a-z0-9._-]{0,31}$/.test(raw.trim().toLowerCase());
}

function isRelayPath(raw: string): boolean {
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://') || /\s/.test(path)) return false;
  return path.length <= 200;
}

export function isRelayInterfacePath(raw: string): boolean {
  return isRelayPath(raw);
}

export function suggestedRelayPath(protocol: string): string {
  return SUGGESTED_PATH[protocol.trim().toLowerCase()] ?? '';
}

/** Identity of one interface slot. The name is not part of it. */
export function relayInterfaceSlot(protocol: string, method: string, path: string): string {
  return `${protocol.trim().toLowerCase()}\n${method}\n${path.trim()}`;
}

/**
 * Keep the first interface for each protocol, method, and path.
 * A blank protocol stays, so an unfinished new row is not dropped.
 */
export function collapseRelayInterfaceSlots(rows: readonly RelayInterface[]): RelayInterface[] {
  const seen = new Set<string>();
  const out: RelayInterface[] = [];
  let changed = false;
  for (const row of rows) {
    const protocol = row.protocol.trim().toLowerCase();
    if (!protocol) {
      out.push(row);
      continue;
    }
    const key = relayInterfaceSlot(protocol, row.method, row.path);
    if (seen.has(key)) {
      changed = true;
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  return changed ? out : (rows as RelayInterface[]);
}

function isClass(value: string): value is RelayServiceClass {
  return value === 'model' || value === 'api' || value === 'mcp';
}

function isMethod(value: string): value is RelayMethod {
  return (RELAY_METHODS as readonly string[]).includes(value);
}

function freshId(prefix: string, used: Set<string>): string {
  let n = used.size + 1;
  let id = `${prefix}_${n}`;
  while (used.has(id)) {
    n += 1;
    id = `${prefix}_${n}`;
  }
  used.add(id);
  return id;
}

function keepId(raw: string, prefix: string, used: Set<string>): string {
  const id = raw.trim();
  if (id && !used.has(id) && id.length <= 40) {
    used.add(id);
    return id;
  }
  return freshId(prefix, used);
}

function normalizeInterfaces(raw: readonly RelayInterface[] | undefined): RelayInterface[] {
  const out: RelayInterface[] = [];
  const used = new Set<string>();
  const seen = new Set<string>();
  for (const row of raw ?? []) {
    if (out.length >= RELAY_INTERFACE_CAP) break;
    if (!row || typeof row !== 'object') continue;
    const protocol = typeof row.protocol === 'string' ? row.protocol.trim().toLowerCase() : '';
    if (!isRelayProtocolId(protocol)) continue;
    const path = typeof row.path === 'string' ? row.path.trim() : '';
    if (path && !isRelayPath(path)) continue;
    const method = isMethod(row.method) ? row.method : 'POST';
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '';
    const key = `${protocol}\n${method}\n${path}\n${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: keepId(typeof row.id === 'string' ? row.id : '', 'if', used),
      protocol,
      name,
      method,
      path,
    });
  }
  return out;
}

function normalizeOperations(raw: readonly RelayOperation[] | undefined): RelayOperation[] {
  const out: RelayOperation[] = [];
  const used = new Set<string>();
  const seen = new Set<string>();
  for (const row of raw ?? []) {
    if (out.length >= RELAY_OPERATION_CAP) break;
    if (!row || typeof row !== 'object') continue;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '';
    const path = typeof row.path === 'string' ? row.path.trim() : '';
    if (!name || !path || !isRelayPath(path)) continue;
    const method = isMethod(row.method) ? row.method : 'GET';
    const key = `${method}\n${path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: keepId(typeof row.id === 'string' ? row.id : '', 'op', used),
      name,
      method,
      path,
    });
  }
  return out;
}

function normalizeGroups(raw: readonly RelayApiGroup[] | undefined): RelayApiGroup[] {
  const out: RelayApiGroup[] = [];
  const used = new Set<string>();
  const seen = new Set<string>();
  for (const row of raw ?? []) {
    if (out.length >= RELAY_GROUP_CAP) break;
    if (!row || typeof row !== 'object') continue;
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '';
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      id: keepId(typeof row.id === 'string' ? row.id : '', 'grp', used),
      name,
      operations: normalizeOperations(row.operations),
    });
  }
  return out;
}

/** One service per class. Model keeps interfaces, API keeps groups, MCP keeps a path. */
export function normalizeRelayServices(raw: readonly RelayService[] | undefined): RelayService[] {
  const out: RelayService[] = [];
  const used = new Set<string>();
  const seen = new Set<RelayServiceClass>();
  for (const row of raw ?? []) {
    if (!row || typeof row !== 'object' || !isClass(row.class) || seen.has(row.class)) continue;
    seen.add(row.class);
    const name = typeof row.name === 'string' ? row.name.trim().slice(0, 64) : '';
    const id = keepId(typeof row.id === 'string' ? row.id : '', 'svc', used);
    if (row.class === 'model') {
      out.push({ id, class: 'model', name, interfaces: normalizeInterfaces(row.interfaces) });
    } else if (row.class === 'api') {
      out.push({ id, class: 'api', name, groups: normalizeGroups(row.groups) });
    } else {
      const path = typeof row.path === 'string' ? row.path.trim() : '';
      out.push({
        id,
        class: 'mcp',
        name,
        path: path && isRelayPath(path) ? path : '',
      });
    }
  }
  return out;
}

export function relayServicesEqual(
  left: readonly RelayService[] | undefined,
  right: readonly RelayService[] | undefined,
): boolean {
  return JSON.stringify(normalizeRelayServices(left)) === JSON.stringify(normalizeRelayServices(right));
}

/** AIsa relays models on several protocols, plus data APIs and MCP. Paths stay relative. */
export const AISA_RELAY_SERVICES: RelayService[] = [
  {
    id: 'svc_model',
    class: 'model',
    name: 'model',
    interfaces: [
      { id: 'if_chat', protocol: 'openai', name: 'chat', method: 'POST', path: '/chat/completions' },
      { id: 'if_messages', protocol: 'anthropic', name: 'messages', method: 'POST', path: '/messages' },
      { id: 'if_gemini', protocol: 'gemini', name: 'generate', method: 'POST', path: '' },
    ],
  },
  {
    id: 'svc_api',
    class: 'api',
    name: 'api',
    groups: [
      { id: 'grp_search', name: 'search', operations: [] },
      { id: 'grp_finance', name: 'finance', operations: [] },
      { id: 'grp_scholar', name: 'scholar', operations: [] },
      { id: 'grp_social', name: 'social', operations: [] },
      { id: 'grp_prediction', name: 'prediction', operations: [] },
    ],
  },
  { id: 'svc_mcp', class: 'mcp', name: 'mcp', path: '/mcp' },
];

/** World Monitor relays data APIs and MCP, not a model chat protocol. */
export const WORLD_MONITOR_RELAY_SERVICES: RelayService[] = [
  { id: 'svc_api', class: 'api', name: 'api', groups: [] },
  { id: 'svc_mcp', class: 'mcp', name: 'mcp', path: '/mcp' },
];

/** SiliconFlow exposes more than one model interface. Paths stay relative and editable. */
export const SILICONFLOW_RELAY_SERVICES: RelayService[] = [
  {
    id: 'svc_model',
    class: 'model',
    name: 'model',
    interfaces: [
      { id: 'if_chat', protocol: 'openai', name: 'chat', method: 'POST', path: '/chat/completions' },
      { id: 'if_messages', protocol: 'anthropic', name: 'messages', method: 'POST', path: '/messages' },
      { id: 'if_embed', protocol: 'openai', name: 'embeddings', method: 'POST', path: '/embeddings' },
      { id: 'if_rerank', protocol: 'openai', name: 'rerank', method: 'POST', path: '/rerank' },
    ],
  },
];
