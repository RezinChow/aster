import { loadDivisionCatalog, type Division } from '@/data/divisions';
import {
  ADMIN_SEEDS,
  LOCAL_DEPARTMENTS,
  LOCAL_GROUP_LABEL,
  LOCAL_GROUP_ORDER,
  localGroupOf,
  type AdminOrganType,
  type AdminRank,
  type AdminSeed,
  type LocalTier,
  type LocalTitle,
} from '@/data/administration.data';

export type { AdminOrganType, AdminRank, AdminSeed };

export type AdminNode = {
  id: string;
  name: string;
  kind: 'group' | 'organ';
  rank: AdminRank | '';
  organType: AdminOrganType | '';
  parentId: string;
  derived: boolean;
  childCount: number;
  /** Empty means the organ applies nationwide. */
  scopeId: string;
  scopeName: string;
  scopePath: string[];
};

export type AdminCatalog = {
  byId: Map<string, AdminNode>;
  childrenOf: Map<string, AdminNode[]>;
  counts: Record<AdminRank, number>;
};

export type AdminTreeRow = AdminNode & {
  depth: number;
  branch: boolean;
};

type AdminEdits = {
  names: Record<string, string>;
  ranks: Record<string, AdminRank>;
  removed: string[];
  added: AdminSeed[];
};

const STORAGE_KEY = 'kense.console.administration.v1';
const EMPTY_EDITS: AdminEdits = { names: {}, ranks: {}, removed: [], added: [] };
export const ADMIN_SCOPE_NATIONWIDE = 'nationwide';
const RANKS: readonly AdminRank[] = ['central', 'provincial', 'municipal', 'county'];
const BUCKET_NAMES = new Set(['市辖区', '省直辖县级行政区划', '自治区直辖县级行政区划']);
const TOP_ONLY = new Set(['710000', '810000', '820000']);
const MUNICIPALITIES = new Set(['110000', '120000', '310000', '500000']);

function isRank(value: unknown): value is AdminRank {
  return typeof value === 'string' && (RANKS as readonly string[]).includes(value);
}

function isOrganType(value: unknown): value is AdminOrganType {
  return (
    value === 'general' ||
    value === 'constituent' ||
    value === 'special' ||
    value === 'direct' ||
    value === 'staff' ||
    value === 'institution' ||
    value === 'bureau' ||
    value === 'government' ||
    value === 'prefecture' ||
    value === 'sar' ||
    value === 'ting' ||
    value === 'ju' ||
    value === 'wei' ||
    value === 'office' ||
    value === 'public' ||
    value === 'mass'
  );
}

function isSeed(value: unknown): value is AdminSeed {
  if (!value || typeof value !== 'object') return false;
  const row = value as AdminSeed;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.parent === 'string' &&
    (row.kind === 'group' || row.kind === 'organ') &&
    (row.rank === '' || isRank(row.rank)) &&
    (row.organType === '' || isOrganType(row.organType))
  );
}

function readEdits(): AdminEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<AdminEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const ranks: Record<string, AdminRank> = {};
    if (parsed.ranks && typeof parsed.ranks === 'object') {
      for (const [id, rank] of Object.entries(parsed.ranks)) {
        if (isRank(rank)) ranks[id] = rank;
      }
    }
    const removed = Array.isArray(parsed.removed) ? parsed.removed.filter((id) => typeof id === 'string') : [];
    const added = Array.isArray(parsed.added) ? parsed.added.filter(isSeed) : [];
    return { names, ranks, removed, added };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeEdits(edits: AdminEdits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  catalogCache = null;
}

function governmentTitle(division: Division): { name: string; organType: AdminOrganType } {
  if (division.id === '810000' || division.id === '820000') {
    return { name: `${division.name}政府`, organType: 'sar' };
  }
  if (division.name.endsWith('地区') || division.name.endsWith('盟')) {
    return { name: `${division.name}行政公署`, organType: 'prefecture' };
  }
  return { name: `${division.name}人民政府`, organType: 'government' };
}

function rankOf(division: Division): AdminRank {
  if (division.level === 'province') return 'provincial';
  if (division.level === 'city') return 'municipal';
  return 'county';
}

function tierOf(division: Division): LocalTier | null {
  if (TOP_ONLY.has(division.id)) return null;
  if (division.level === 'province') return MUNICIPALITIES.has(division.id) ? 'municipality' : 'province';
  if (division.name.endsWith('地区') || division.name.endsWith('盟')) return 'prefecture';
  if (division.level === 'city') return 'city';
  return 'county';
}

function buildCatalog(edits: AdminEdits): AdminCatalog {
  const removed = new Set(edits.removed);
  const byId = new Map<string, AdminNode>();
  const childrenOf = new Map<string, AdminNode[]>();
  const counts: Record<AdminRank, number> = { central: 0, provincial: 0, municipal: 0, county: 0 };

  function add(row: AdminSeed, derived: boolean, scopeId = '') {
    if (removed.has(row.id) || byId.has(row.id)) return;
    if (row.parent && !byId.has(row.parent)) return;
    const rank = row.kind === 'organ' ? edits.ranks[row.id] ?? row.rank : '';
    const scope = scopeId ? scopeOf(scopeId) : { scopeId: '', scopeName: '', scopePath: [] as string[] };
    const node: AdminNode = {
      id: row.id,
      name: edits.names[row.id] ?? row.name,
      kind: row.kind,
      rank: rank === '' || isRank(rank) ? rank : row.rank,
      organType: row.organType,
      parentId: row.parent,
      derived,
      childCount: 0,
      scopeId: scope.scopeId,
      scopeName: scope.scopeName,
      scopePath: scope.scopePath,
    };
    byId.set(node.id, node);
    const siblings = childrenOf.get(row.parent);
    if (siblings) siblings.push(node);
    else childrenOf.set(row.parent, [node]);
    if (node.kind === 'organ' && isRank(node.rank)) counts[node.rank] += 1;
  }

  for (const row of ADMIN_SEEDS) add(row, false);

  const divisions = loadDivisionCatalog();
  const scopeCache = new Map<string, { scopeId: string; scopeName: string; scopePath: string[] }>();

  function scopeOf(divisionId: string) {
    const cached = scopeCache.get(divisionId);
    if (cached) return cached;
    const chain: Division[] = [];
    const seen = new Set<string>();
    let current = divisions.byId.get(divisionId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.unshift(current);
      current = current.parent ? divisions.byId.get(current.parent) : undefined;
    }
    const visible = chain.filter((row) => !BUCKET_NAMES.has(row.name));
    const scope = {
      scopeId: visible.length > 0 ? divisionId : '',
      scopeName: visible.map((row) => row.name).join(' / '),
      scopePath: visible.map((row) => row.id),
    };
    scopeCache.set(divisionId, scope);
    return scope;
  }

  function visit(division: Division, withChildren: boolean) {
    if (BUCKET_NAMES.has(division.name)) {
      for (const child of divisions.childrenOf.get(division.id) ?? []) visit(child, withChildren);
      return;
    }
    const titled = governmentTitle(division);
    add(
      {
        id: `gov:${division.id}`,
        name: titled.name,
        parent: division.level === 'province' ? 'local' : governmentParent(division),
        kind: 'organ',
        rank: rankOf(division),
        organType: titled.organType,
      },
      true,
      division.id,
    );
    const tier = tierOf(division);
    if (tier && byId.has(`gov:${division.id}`)) addDepartments(division, tier);
    if (!withChildren) return;
    for (const child of divisions.childrenOf.get(division.id) ?? []) visit(child, true);
  }

  function realParent(division: Division): Division | undefined {
    let parent = division.parent ? divisions.byId.get(division.parent) : undefined;
    while (parent && BUCKET_NAMES.has(parent.name)) {
      parent = parent.parent ? divisions.byId.get(parent.parent) : undefined;
    }
    return parent;
  }

  function formalPlace(division: Division): string {
    const parent = realParent(division);
    const urbanDistrict =
      division.name.endsWith('区') && !division.name.endsWith('林区') && !division.name.endsWith('特区');
    if (parent && urbanDistrict) return `${parent.name}${division.name}`;
    return division.name;
  }

  function legalName(division: Division, stem: string, title?: LocalTitle): string {
    const place = formalPlace(division);
    if (title === 'tax') return `国家税务总局${place}税务局`;
    if (title === 'forex') return `国家外汇管理局${division.name}分局`;
    if (title === 'formal') return `${place}${stem}`;
    return `${division.name}${stem}`;
  }

  function addDepartments(division: Division, tier: LocalTier) {
    const govId = `gov:${division.id}`;
    const grouped = new Map<string, { code: string; stem: string; organType: AdminOrganType; title?: LocalTitle }[]>();
    for (const item of LOCAL_DEPARTMENTS) {
      const stem = item.names[tier];
      if (!stem) continue;
      const id = `${govId}:${item.code}`;
      if (removed.has(id)) continue;
      const organType = localGroupOf(stem, item.kind);
      const list = grouped.get(organType) ?? [];
      list.push({ code: item.code, stem, organType, title: item.title });
      grouped.set(organType, list);
    }
    for (const group of LOCAL_GROUP_ORDER) {
      const items = grouped.get(group);
      if (!items?.length) continue;
      const groupId = `${govId}:g:${group}`;
      add({ id: groupId, name: LOCAL_GROUP_LABEL[group], parent: govId, kind: 'group', rank: '', organType: '' }, true, division.id);
      for (const item of items) {
        add(
          {
            id: `${govId}:${item.code}`,
            name: legalName(division, item.stem, item.title),
            parent: groupId,
            kind: 'organ',
            rank: rankOf(division),
            organType: item.organType,
          },
          true,
          division.id,
        );
      }
    }
  }

  function governmentParent(division: Division): string {
    let parent = division.parent ? divisions.byId.get(division.parent) : undefined;
    while (parent && BUCKET_NAMES.has(parent.name)) {
      parent = parent.parent ? divisions.byId.get(parent.parent) : undefined;
    }
    return parent ? `gov:${parent.id}` : 'local';
  }

  for (const province of divisions.childrenOf.get('') ?? []) {
    visit(province, !TOP_ONLY.has(province.id));
  }

  for (const row of edits.added) add({ ...row, kind: 'organ' }, false, byId.get(row.parent)?.scopeId ?? '');

  for (const node of byId.values()) node.childCount = childrenOf.get(node.id)?.length ?? 0;
  return { byId, childrenOf, counts };
}

let catalogCache: AdminCatalog | null = null;

export function loadAdministrationCatalog(): AdminCatalog {
  catalogCache ??= buildCatalog(readEdits());
  return catalogCache;
}

export function reloadAdministrationCatalog(): AdminCatalog {
  catalogCache = null;
  return loadAdministrationCatalog();
}

export function renameOrgan(id: string, name: string): boolean {
  const trimmed = name.trim();
  const current = loadAdministrationCatalog().byId.get(id);
  if (!current || current.kind !== 'organ' || !trimmed || trimmed === current.name) return false;
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  if (added) added.name = trimmed;
  else edits.names[id] = trimmed;
  writeEdits(edits);
  return true;
}

export function setOrganRank(id: string, rank: AdminRank): boolean {
  if (!isRank(rank)) return false;
  const current = loadAdministrationCatalog().byId.get(id);
  if (!current || current.kind !== 'organ' || current.rank === rank) return Boolean(current);
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  if (added) added.rank = rank;
  else edits.ranks[id] = rank;
  writeEdits(edits);
  return true;
}

function inheritedRank(parent: AdminNode | undefined, catalog: AdminCatalog): AdminRank {
  let current = parent;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.kind === 'organ' && isRank(current.rank)) return current.rank;
    if (current.id === 'local') return 'provincial';
    current = current.parentId ? catalog.byId.get(current.parentId) : undefined;
  }
  return 'central';
}

export function addOrgan(parentId: string, name: string): AdminSeed | null {
  const trimmed = name.trim();
  const catalog = loadAdministrationCatalog();
  const parent = catalog.byId.get(parentId);
  if (!trimmed || !parent) return null;
  const row: AdminSeed = {
    id: `cadmin_${crypto.randomUUID()}`,
    name: trimmed,
    parent: parentId,
    kind: 'organ',
    rank: inheritedRank(parent, catalog),
    organType: '',
  };
  const edits = readEdits();
  edits.added.push(row);
  writeEdits(edits);
  return row;
}

export function removeOrgan(id: string) {
  const current = loadAdministrationCatalog().byId.get(id);
  if (!current || current.kind !== 'organ' || current.childCount > 0) return;
  const edits = readEdits();
  const baseIds = new Set(ADMIN_SEEDS.map((row) => row.id));
  if ((baseIds.has(id) || id.startsWith('gov:')) && !edits.removed.includes(id)) edits.removed.push(id);
  delete edits.names[id];
  delete edits.ranks[id];
  edits.added = edits.added.filter((row) => row.id !== id);
  writeEdits(edits);
}

const RANK_ORDER: Record<AdminRank | '', number> = { central: 0, provincial: 1, municipal: 2, county: 3, '': 4 };

function compareNode(a: AdminNode, b: AdminNode): number {
  const rankDelta = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  if (rankDelta !== 0) return rankDelta;
  return a.name.localeCompare(b.name, 'zh');
}

function matches(node: AdminNode, needle: string, rank: AdminRank | 'all'): boolean {
  if (rank !== 'all' && node.rank !== rank) return false;
  if (!needle) return rank !== 'all';
  return node.name.toLowerCase().includes(needle);
}

function scopeMatches(node: AdminNode, scope: string): boolean {
  if (!scope) return true;
  if (scope === ADMIN_SCOPE_NATIONWIDE) return node.scopeId === '';
  if (!node.scopeId) return false;
  return node.scopePath.includes(scope);
}

export function administrationTreeAutoOpen(catalog: AdminCatalog, query: string, rank: AdminRank | 'all'): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle && rank === 'all') return open;

  function mark(id: string): boolean {
    const node = catalog.byId.get(id);
    if (!node) return false;
    const children = catalog.childrenOf.get(id) ?? [];
    let childHit = false;
    for (const child of children) {
      if (mark(child.id)) childHit = true;
    }
    if (childHit) open.add(id);
    return matches(node, needle, rank) || childHit;
  }

  for (const root of catalog.childrenOf.get('') ?? []) mark(root.id);
  return open;
}

export function visibleAdministrationTree(
  catalog: AdminCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  rank: AdminRank | 'all',
  scope = '',
): AdminTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (rank !== 'all' || scope) {
    const matched: AdminTreeRow[] = [];
    for (const node of catalog.byId.values()) {
      if (scope && node.kind !== 'organ') continue;
      if (!scopeMatches(node, scope)) continue;
      if (rank !== 'all' && node.rank !== rank) continue;
      if (needle && !node.name.toLowerCase().includes(needle)) continue;
      matched.push({ ...node, depth: 0, branch: false });
    }
    return matched.sort(compareNode);
  }

  const filtering = needle.length > 0;
  const matched = new Map<string, boolean>();

  function hasMatch(node: AdminNode): boolean {
    const cached = matched.get(node.id);
    if (cached !== undefined) return cached;
    const self = needle ? matches(node, needle, 'all') : true;
    const children = catalog.childrenOf.get(node.id) ?? [];
    const hit = self || children.some(hasMatch);
    matched.set(node.id, hit);
    return hit;
  }

  function walk(nodes: AdminNode[], depth: number): AdminTreeRow[] {
    const rows: AdminTreeRow[] = [];
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const visibleChildren = filtering ? children.filter(hasMatch) : children;
      if (filtering && !hasMatch(node)) continue;
      rows.push({ ...node, depth, branch: visibleChildren.length > 0 });
      if (openIds.has(node.id)) rows.push(...walk(visibleChildren, depth + 1));
    }
    return rows;
  }

  return walk(catalog.childrenOf.get('') ?? [], 0);
}
