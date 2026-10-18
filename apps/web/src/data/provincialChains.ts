import { reloadDivisionCatalog, loadDivisionCatalog } from '@/data/divisions';
import {
  PROVINCIAL_CHAIN_SEEDS,
  type ProvincialChainSeed,
} from '@/data/provincialChains.data';

export type ChainLevel = 'province' | 'chain';

export type ChainNode = {
  id: string;
  name: string;
  level: ChainLevel;
  code: string;
  provinceId: string;
  provinceName: string;
  childCount: number;
};

export type ChainCatalog = {
  byId: Map<string, ChainNode>;
  childrenOf: Map<string, ChainNode[]>;
  counts: { province: number; chain: number };
};

export type ChainTreeRow = ChainNode & {
  depth: number;
  branch: boolean;
};

type ChainEdits = {
  names: Record<string, string>;
  removed: string[];
  added: ProvincialChainSeed[];
};

const STORAGE_KEY = 'kense.console.provincialChains.v1';
const EMPTY_EDITS: ChainEdits = { names: {}, removed: [], added: [] };

function isSeed(value: unknown): value is ProvincialChainSeed {
  if (!value || typeof value !== 'object') return false;
  const row = value as ProvincialChainSeed;
  return (
    typeof row.id === 'string' &&
    typeof row.provinceId === 'string' &&
    typeof row.name === 'string'
  );
}

function readEdits(): ChainEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<ChainEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const baseIds = new Set(PROVINCIAL_CHAIN_SEEDS.map((row) => row.id));
    return {
      names,
      removed: Array.isArray(parsed.removed)
        ? parsed.removed.filter((id): id is string => typeof id === 'string')
        : [],
      added: Array.isArray(parsed.added)
        ? parsed.added.filter((row) => isSeed(row) && !baseIds.has(row.id))
        : [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeEdits(edits: ChainEdits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  catalogCache = null;
}

function chainsForProvinces(provinceIds: ReadonlySet<string>): ProvincialChainSeed[] {
  const edits = readEdits();
  const removed = new Set(edits.removed);
  return [...PROVINCIAL_CHAIN_SEEDS, ...edits.added]
    .filter((row) => provinceIds.has(row.provinceId) && !removed.has(row.id))
    .map((row) => {
      const name = edits.names[row.id];
      return name && name !== row.name ? { ...row, name } : row;
    });
}

function compareChain(a: ChainNode, b: ChainNode): number {
  if (a.provinceId !== b.provinceId) return a.provinceId < b.provinceId ? -1 : 1;
  if (a.level !== b.level) return a.level === 'province' ? -1 : 1;
  return a.name.localeCompare(b.name, 'zh');
}

function buildCatalog(): ChainCatalog {
  const divisions = loadDivisionCatalog();
  const provinces = [...divisions.byId.values()]
    .filter((row) => row.level === 'province')
    .slice()
    .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
  const provinceIds = new Set(provinces.map((row) => row.id));
  const byId = new Map<string, ChainNode>();
  const childrenOf = new Map<string, ChainNode[]>();

  for (const province of provinces) {
    const node: ChainNode = {
      id: province.id,
      name: province.name,
      level: 'province',
      code: province.code,
      provinceId: province.id,
      provinceName: province.name,
      childCount: 0,
    };
    byId.set(node.id, node);
    const roots = childrenOf.get('');
    if (roots) roots.push(node);
    else childrenOf.set('', [node]);
  }

  for (const chain of chainsForProvinces(provinceIds)) {
    const province = byId.get(chain.provinceId);
    if (!province) continue;
    const node: ChainNode = {
      id: chain.id,
      name: chain.name,
      level: 'chain',
      code: '',
      provinceId: chain.provinceId,
      provinceName: province.name,
      childCount: 0,
    };
    byId.set(node.id, node);
    const siblings = childrenOf.get(chain.provinceId);
    if (siblings) siblings.push(node);
    else childrenOf.set(chain.provinceId, [node]);
  }

  for (const node of byId.values()) {
    const children = childrenOf.get(node.id);
    if (!children) continue;
    children.sort(compareChain);
    node.childCount = children.length;
  }

  let chainCount = 0;
  for (const node of byId.values()) {
    if (node.level === 'chain') chainCount += 1;
  }

  return {
    byId,
    childrenOf,
    counts: { province: provinces.length, chain: chainCount },
  };
}

let catalogCache: ChainCatalog | null = null;

export function loadChainCatalog(): ChainCatalog {
  catalogCache ??= buildCatalog();
  return catalogCache;
}

export function reloadChainCatalog(): ChainCatalog {
  catalogCache = null;
  reloadDivisionCatalog();
  return loadChainCatalog();
}

export function renameChain(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const catalog = loadChainCatalog();
  const current = catalog.byId.get(id);
  if (!current || current.level !== 'chain') return false;
  if (current.name === trimmed) return true;
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  const base = PROVINCIAL_CHAIN_SEEDS.find((row) => row.id === id);
  const original = added?.name ?? base?.name;
  if (trimmed === original) delete edits.names[id];
  else edits.names[id] = trimmed;
  writeEdits(edits);
  return true;
}

export function addChain(provinceId: string, name: string): ProvincialChainSeed | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const catalog = loadChainCatalog();
  const province = catalog.byId.get(provinceId);
  if (!province || province.level !== 'province') return null;
  const row: ProvincialChainSeed = {
    id: `cchain_${crypto.randomUUID()}`,
    provinceId,
    name: trimmed,
  };
  const edits = readEdits();
  edits.added.push(row);
  writeEdits(edits);
  return row;
}

export function removeChain(id: string) {
  const catalog = loadChainCatalog();
  const current = catalog.byId.get(id);
  if (!current || current.level !== 'chain') return;
  const edits = readEdits();
  const baseIds = new Set(PROVINCIAL_CHAIN_SEEDS.map((row) => row.id));
  if (baseIds.has(id) && !edits.removed.includes(id)) edits.removed.push(id);
  delete edits.names[id];
  edits.added = edits.added.filter((row) => row.id !== id);
  writeEdits(edits);
}

function matches(node: ChainNode, needle: string, level: ChainLevel | 'all'): boolean {
  if (level !== 'all' && node.level !== level) return false;
  if (!needle) return level !== 'all';
  return (
    node.name.toLowerCase().includes(needle) ||
    node.code.toLowerCase().includes(needle) ||
    (node.level === 'chain' && node.provinceName.toLowerCase().includes(needle))
  );
}

export function chainTreeAutoOpen(
  catalog: ChainCatalog,
  query: string,
  level: ChainLevel | 'all',
): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle) return open;
  const roots = catalog.childrenOf.get('') ?? [];
  for (const province of roots) {
    const children = catalog.childrenOf.get(province.id) ?? [];
    if (children.some((child) => matches(child, needle, level))) open.add(province.id);
  }
  return open;
}

export function visibleChainTree(
  catalog: ChainCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  level: ChainLevel | 'all',
): ChainTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (level !== 'all') {
    const matched: ChainTreeRow[] = [];
    for (const node of catalog.byId.values()) {
      if (!matches(node, needle, level)) continue;
      matched.push({ ...node, depth: 0, branch: false });
    }
    return matched.slice().sort(compareChain);
  }

  const filtering = needle.length > 0;
  const roots = catalog.childrenOf.get('') ?? [];
  const rows: ChainTreeRow[] = [];
  for (const province of roots) {
    const children = catalog.childrenOf.get(province.id) ?? [];
    const visibleChildren = filtering
      ? children.filter((child) => matches(child, needle, 'all') || matches(province, needle, 'all'))
      : children;
    const provinceHit = matches(province, needle, 'all');
    if (filtering && !provinceHit && visibleChildren.length === 0) continue;
    const shownChildren = filtering && !provinceHit ? children.filter((child) => matches(child, needle, 'all')) : visibleChildren;
    rows.push({ ...province, depth: 0, branch: shownChildren.length > 0 });
    if (openIds.has(province.id)) {
      for (const child of shownChildren) {
        rows.push({ ...child, depth: 1, branch: false });
      }
    }
  }
  return rows;
}
