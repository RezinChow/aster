import { loadDivisionCatalog, reloadDivisionCatalog } from '@/data/divisions';
import { UNIVERSITY_TAG_ASSIGNMENTS } from '@/data/universityTags.data';
import { UNIVERSITY_SEEDS, type UniversitySeed, type UniversityTier } from '@/data/universities.data';

export type { UniversitySeed, UniversityTier };

export type UniversityLevel = 'province' | 'city' | 'county' | 'university';

export type UniversityNode = {
  id: string;
  name: string;
  level: UniversityLevel;
  tier: UniversityTier | '';
  code: string;
  parentId: string;
  placeName: string;
  tagIds: readonly string[];
  childCount: number;
};

export type UniversityCatalog = {
  byId: Map<string, UniversityNode>;
  childrenOf: Map<string, UniversityNode[]>;
  counts: Record<UniversityLevel, number>;
  tierCounts: Record<UniversityTier, number>;
};

export type UniversityTreeRow = UniversityNode & {
  depth: number;
  branch: boolean;
};

type UniversityEdits = {
  names: Record<string, string>;
  tiers: Record<string, UniversityTier>;
  removed: string[];
  added: UniversitySeed[];
};

const STORAGE_KEY = 'kense.console.universities.v1';
const EMPTY_EDITS: UniversityEdits = { names: {}, tiers: {}, removed: [], added: [] };

const UNIVERSITY_TIERS: readonly UniversityTier[] = ['undergraduate', 'vocational', 'adult'];

function isUniversityTier(value: unknown): value is UniversityTier {
  return typeof value === 'string' && (UNIVERSITY_TIERS as readonly string[]).includes(value);
}

export function catalogUniversityTier(row: Pick<UniversitySeed, 'tier'>): UniversityTier {
  return row.tier;
}

function isSeed(value: unknown): value is UniversitySeed {
  if (!value || typeof value !== 'object') return false;
  const row = value as UniversitySeed;
  return (
    typeof row.id === 'string' &&
    typeof row.divisionId === 'string' &&
    typeof row.name === 'string' &&
    isUniversityTier(row.tier)
  );
}

function readEdits(): UniversityEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<UniversityEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const tiers: Record<string, UniversityTier> = {};
    if (parsed.tiers && typeof parsed.tiers === 'object') {
      for (const [id, tier] of Object.entries(parsed.tiers)) {
        if (isUniversityTier(tier)) tiers[id] = tier;
      }
    }
    const baseIds = new Set(UNIVERSITY_SEEDS.map((row) => row.id));
    return {
      names,
      tiers,
      removed: Array.isArray(parsed.removed)
        ? parsed.removed.filter((id): id is string => typeof id === 'string')
        : [],
      added: Array.isArray(parsed.added) ? parsed.added.filter((row) => isSeed(row) && !baseIds.has(row.id)) : [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeEdits(edits: UniversityEdits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  catalogCache = null;
}

function universitiesForDivisions(divisionIds: ReadonlySet<string>): UniversitySeed[] {
  const edits = readEdits();
  const removed = new Set(edits.removed);
  return [...UNIVERSITY_SEEDS, ...edits.added]
    .filter((row) => divisionIds.has(row.divisionId) && !removed.has(row.id))
    .map((row) => {
      const name = edits.names[row.id];
      const named = name && name !== row.name ? { ...row, name } : row;
      const tier = edits.tiers[row.id];
      return tier ? { ...named, tier } : named;
    });
}

function compareNode(a: UniversityNode, b: UniversityNode): number {
  if (a.level !== b.level) return a.level === 'university' ? 1 : b.level === 'university' ? -1 : 0;
  if (a.code !== b.code) {
    if (!a.code) return 1;
    if (!b.code) return -1;
    return a.code < b.code ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'zh');
}

function buildCatalog(): UniversityCatalog {
  const divisions = loadDivisionCatalog();
  const byId = new Map<string, UniversityNode>();
  const childrenOf = new Map<string, UniversityNode[]>();
  const counts: Record<UniversityLevel, number> = { province: 0, city: 0, county: 0, university: 0 };
  const tierCounts: Record<UniversityTier, number> = { undergraduate: 0, vocational: 0, adult: 0 };

  for (const division of divisions.byId.values()) {
    const parent = division.parent ? divisions.byId.get(division.parent) : undefined;
    const node: UniversityNode = {
      id: division.id,
      name: division.name,
      level: division.level,
      tier: '',
      code: division.code,
      parentId: division.parent,
      placeName: parent?.name ?? '',
      tagIds: [],
      childCount: 0,
    };
    byId.set(node.id, node);
    counts[division.level] += 1;
    const siblings = childrenOf.get(division.parent);
    if (siblings) siblings.push(node);
    else childrenOf.set(division.parent, [node]);
  }

  for (const school of universitiesForDivisions(new Set(byId.keys()))) {
    const place = byId.get(school.divisionId);
    if (!place || place.level === 'university') continue;
    const tier = catalogUniversityTier(school);
    const node: UniversityNode = {
      id: school.id,
      name: school.name,
      level: 'university',
      tier,
      code: '',
      parentId: school.divisionId,
      placeName: place.name,
      tagIds: UNIVERSITY_TAG_ASSIGNMENTS[school.id] ?? [],
      childCount: 0,
    };
    byId.set(node.id, node);
    counts.university += 1;
    tierCounts[tier] += 1;
    const siblings = childrenOf.get(school.divisionId);
    if (siblings) siblings.push(node);
    else childrenOf.set(school.divisionId, [node]);
  }

  for (const siblings of childrenOf.values()) siblings.sort(compareNode);
  for (const node of byId.values()) node.childCount = childrenOf.get(node.id)?.length ?? 0;

  return { byId, childrenOf, counts, tierCounts };
}

let catalogCache: UniversityCatalog | null = null;

export function loadUniversityCatalog(): UniversityCatalog {
  catalogCache ??= buildCatalog();
  return catalogCache;
}

export function reloadUniversityCatalog(): UniversityCatalog {
  catalogCache = null;
  reloadDivisionCatalog();
  return loadUniversityCatalog();
}

export function renameUniversity(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const current = loadUniversityCatalog().byId.get(id);
  if (!current || current.level !== 'university') return false;
  if (current.name === trimmed) return true;
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  const base = UNIVERSITY_SEEDS.find((row) => row.id === id);
  const original = added?.name ?? base?.name;
  if (trimmed === original) delete edits.names[id];
  else edits.names[id] = trimmed;
  writeEdits(edits);
  return true;
}

export function addUniversity(divisionId: string, name: string): UniversitySeed | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const place = loadUniversityCatalog().byId.get(divisionId);
  if (!place || place.level === 'university') return null;
  const row: UniversitySeed = {
    id: `cuniv_${crypto.randomUUID()}`,
    divisionId,
    name: trimmed,
    tier: 'undergraduate',
  };
  const edits = readEdits();
  edits.added.push(row);
  writeEdits(edits);
  return row;
}

export function removeUniversity(id: string) {
  const current = loadUniversityCatalog().byId.get(id);
  if (!current || current.level !== 'university') return;
  const edits = readEdits();
  const baseIds = new Set(UNIVERSITY_SEEDS.map((row) => row.id));
  if (baseIds.has(id) && !edits.removed.includes(id)) edits.removed.push(id);
  delete edits.names[id];
  delete edits.tiers[id];
  edits.added = edits.added.filter((row) => row.id !== id);
  writeEdits(edits);
}

export function setUniversityTier(id: string, tier: UniversityTier): boolean {
  if (!isUniversityTier(tier)) return false;
  const current = loadUniversityCatalog().byId.get(id);
  if (!current || current.level !== 'university' || current.tier === tier) return Boolean(current);
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  if (added) {
    added.tier = tier;
    delete edits.tiers[id];
  } else {
    const base = UNIVERSITY_SEEDS.find((row) => row.id === id);
    if (!base) return false;
    if (tier === catalogUniversityTier(base)) delete edits.tiers[id];
    else edits.tiers[id] = tier;
  }
  writeEdits(edits);
  return true;
}

function matches(
  node: UniversityNode,
  needle: string,
  level: UniversityLevel | 'all',
  tier: UniversityTier | 'all',
  tagIds: readonly string[],
): boolean {
  if (level !== 'all' && node.level !== level) return false;
  if (tier !== 'all' && node.tier !== tier) return false;
  if (tagIds.length > 0 && !tagIds.some((id) => node.tagIds.includes(id))) return false;
  if (!needle) return level !== 'all' || tier !== 'all' || tagIds.length > 0;
  return (
    node.name.toLowerCase().includes(needle) ||
    node.code.toLowerCase().includes(needle) ||
    (node.level === 'university' && node.placeName.toLowerCase().includes(needle))
  );
}

export function universityTreeAutoOpen(
  catalog: UniversityCatalog,
  query: string,
  level: UniversityLevel | 'all',
  tier: UniversityTier | 'all',
  tagIds: readonly string[],
): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle && level === 'all' && tier === 'all' && tagIds.length === 0) return open;

  function mark(id: string): boolean {
    const node = catalog.byId.get(id);
    if (!node) return false;
    const children = catalog.childrenOf.get(id) ?? [];
    let childHit = false;
    for (const child of children) {
      if (mark(child.id)) childHit = true;
    }
    if (childHit) open.add(id);
    return matches(node, needle, level, tier, tagIds) || childHit;
  }

  for (const root of catalog.childrenOf.get('') ?? []) mark(root.id);
  return open;
}

export function visibleUniversityTree(
  catalog: UniversityCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  level: UniversityLevel | 'all',
  tier: UniversityTier | 'all',
  tagIds: readonly string[],
): UniversityTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (level !== 'all' || tier !== 'all' || tagIds.length > 0) {
    const matched: UniversityTreeRow[] = [];
    for (const node of catalog.byId.values()) {
      if (!matches(node, needle, level, tier, tagIds)) continue;
      matched.push({ ...node, depth: 0, branch: false });
    }
    return matched.slice().sort(compareNode);
  }

  const filtering = needle.length > 0;
  const matched = new Map<string, boolean>();

  function hasMatch(node: UniversityNode): boolean {
    const cached = matched.get(node.id);
    if (cached !== undefined) return cached;
    const self = matches(node, needle, 'all', 'all', []);
    const children = catalog.childrenOf.get(node.id) ?? [];
    const hit = self || children.some(hasMatch);
    matched.set(node.id, hit);
    return hit;
  }

  function walk(nodes: UniversityNode[], depth: number, parentHit: boolean): UniversityTreeRow[] {
    const rows: UniversityTreeRow[] = [];
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const self = matches(node, needle, 'all', 'all', []);
      const showAllChildren = !filtering || parentHit || self;
      const visibleChildren = showAllChildren ? children : children.filter(hasMatch);
      if (filtering && !parentHit && !self && visibleChildren.length === 0) continue;
      rows.push({ ...node, depth, branch: visibleChildren.length > 0 });
      if (openIds.has(node.id)) rows.push(...walk(visibleChildren, depth + 1, showAllChildren));
    }
    return rows;
  }

  return walk(catalog.childrenOf.get('') ?? [], 0, false);
}
