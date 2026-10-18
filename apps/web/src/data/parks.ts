import { loadDivisionCatalog, reloadDivisionCatalog } from '@/data/divisions';
import { PARK_SEEDS, type ParkGrade, type ParkSeed } from '@/data/parks.data';

export type { ParkGrade, ParkSeed };

export type ParkLevel = 'province' | 'city' | 'county' | 'park';

export type ParkNode = {
  id: string;
  name: string;
  level: ParkLevel;
  grade: ParkGrade | '';
  code: string;
  parentId: string;
  placeName: string;
  childCount: number;
};

export type ParkCatalog = {
  byId: Map<string, ParkNode>;
  childrenOf: Map<string, ParkNode[]>;
  counts: Record<ParkLevel, number>;
  gradeCounts: Record<ParkGrade, number>;
};

export type ParkTreeRow = ParkNode & {
  depth: number;
  branch: boolean;
};

type ParkEdits = {
  names: Record<string, string>;
  grades: Record<string, ParkGrade>;
  removed: string[];
  added: ParkSeed[];
};

const STORAGE_KEY = 'kense.console.parks.v1';
const EMPTY_EDITS: ParkEdits = { names: {}, grades: {}, removed: [], added: [] };

const PARK_GRADES: readonly ParkGrade[] = ['national', 'provincial', 'municipal', 'county'];

function isParkGrade(value: unknown): value is ParkGrade {
  return typeof value === 'string' && (PARK_GRADES as readonly string[]).includes(value);
}

export function catalogParkGrade(row: Pick<ParkSeed, 'id' | 'grade'>): ParkGrade {
  if (row.grade) return row.grade;
  if (row.id.startsWith('G')) return 'national';
  if (row.id.startsWith('S')) return 'provincial';
  return 'provincial';
}

function isSeed(value: unknown): value is ParkSeed {
  if (!value || typeof value !== 'object') return false;
  const row = value as ParkSeed;
  return typeof row.id === 'string' && typeof row.divisionId === 'string' && typeof row.name === 'string';
}

function readEdits(): ParkEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<ParkEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const grades: Record<string, ParkGrade> = {};
    if (parsed.grades && typeof parsed.grades === 'object') {
      for (const [id, grade] of Object.entries(parsed.grades)) {
        if (isParkGrade(grade)) grades[id] = grade;
      }
    }
    const baseIds = new Set(PARK_SEEDS.map((row) => row.id));
    return {
      names,
      grades,
      removed: Array.isArray(parsed.removed)
        ? parsed.removed.filter((id): id is string => typeof id === 'string')
        : [],
      added: Array.isArray(parsed.added) ? parsed.added.filter((row) => isSeed(row) && !baseIds.has(row.id)) : [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeEdits(edits: ParkEdits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  catalogCache = null;
}

function parksForDivisions(divisionIds: ReadonlySet<string>): ParkSeed[] {
  const edits = readEdits();
  const removed = new Set(edits.removed);
  return [...PARK_SEEDS, ...edits.added]
    .filter((row) => divisionIds.has(row.divisionId) && !removed.has(row.id))
    .map((row) => {
      const name = edits.names[row.id];
      const named = name && name !== row.name ? { ...row, name } : row;
      const grade = edits.grades[row.id];
      return grade ? { ...named, grade } : named;
    });
}

function compareNode(a: ParkNode, b: ParkNode): number {
  if (a.level !== b.level) return a.level === 'park' ? 1 : b.level === 'park' ? -1 : 0;
  if (a.code !== b.code) {
    if (!a.code) return 1;
    if (!b.code) return -1;
    return a.code < b.code ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'zh');
}

function buildCatalog(): ParkCatalog {
  const divisions = loadDivisionCatalog();
  const byId = new Map<string, ParkNode>();
  const childrenOf = new Map<string, ParkNode[]>();
  const counts: Record<ParkLevel, number> = { province: 0, city: 0, county: 0, park: 0 };
  const gradeCounts: Record<ParkGrade, number> = { national: 0, provincial: 0, municipal: 0, county: 0 };

  for (const division of divisions.byId.values()) {
    const parent = division.parent ? divisions.byId.get(division.parent) : undefined;
    const node: ParkNode = {
      id: division.id,
      name: division.name,
      level: division.level,
      grade: '',
      code: division.code,
      parentId: division.parent,
      placeName: parent?.name ?? '',
      childCount: 0,
    };
    byId.set(node.id, node);
    counts[division.level] += 1;
    const siblings = childrenOf.get(division.parent);
    if (siblings) siblings.push(node);
    else childrenOf.set(division.parent, [node]);
  }

  for (const park of parksForDivisions(new Set(byId.keys()))) {
    const place = byId.get(park.divisionId);
    if (!place || place.level === 'park') continue;
    const grade = catalogParkGrade(park);
    const node: ParkNode = {
      id: park.id,
      name: park.name,
      level: 'park',
      grade,
      code: '',
      parentId: park.divisionId,
      placeName: place.name,
      childCount: 0,
    };
    byId.set(node.id, node);
    counts.park += 1;
    gradeCounts[grade] += 1;
    const siblings = childrenOf.get(park.divisionId);
    if (siblings) siblings.push(node);
    else childrenOf.set(park.divisionId, [node]);
  }

  for (const siblings of childrenOf.values()) siblings.sort(compareNode);
  for (const node of byId.values()) node.childCount = childrenOf.get(node.id)?.length ?? 0;

  return { byId, childrenOf, counts, gradeCounts };
}

let catalogCache: ParkCatalog | null = null;

export function loadParkCatalog(): ParkCatalog {
  catalogCache ??= buildCatalog();
  return catalogCache;
}

export function reloadParkCatalog(): ParkCatalog {
  catalogCache = null;
  reloadDivisionCatalog();
  return loadParkCatalog();
}

export function renamePark(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const current = loadParkCatalog().byId.get(id);
  if (!current || current.level !== 'park') return false;
  if (current.name === trimmed) return true;
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  const base = PARK_SEEDS.find((row) => row.id === id);
  const original = added?.name ?? base?.name;
  if (trimmed === original) delete edits.names[id];
  else edits.names[id] = trimmed;
  writeEdits(edits);
  return true;
}

export function addPark(divisionId: string, name: string): ParkSeed | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const place = loadParkCatalog().byId.get(divisionId);
  if (!place || place.level === 'park') return null;
  const row: ParkSeed = {
    id: `cpark_${crypto.randomUUID()}`,
    divisionId,
    name: trimmed,
    grade: 'provincial',
  };
  const edits = readEdits();
  edits.added.push(row);
  writeEdits(edits);
  return row;
}

export function removePark(id: string) {
  const current = loadParkCatalog().byId.get(id);
  if (!current || current.level !== 'park') return;
  const edits = readEdits();
  const baseIds = new Set(PARK_SEEDS.map((row) => row.id));
  if (baseIds.has(id) && !edits.removed.includes(id)) edits.removed.push(id);
  delete edits.names[id];
  delete edits.grades[id];
  edits.added = edits.added.filter((row) => row.id !== id);
  writeEdits(edits);
}

export function setParkGrade(id: string, grade: ParkGrade): boolean {
  if (!isParkGrade(grade)) return false;
  const current = loadParkCatalog().byId.get(id);
  if (!current || current.level !== 'park' || current.grade === grade) return Boolean(current);
  const edits = readEdits();
  const added = edits.added.find((row) => row.id === id);
  if (added) {
    added.grade = grade;
    delete edits.grades[id];
  } else {
    const base = PARK_SEEDS.find((row) => row.id === id);
    if (!base) return false;
    if (grade === catalogParkGrade(base)) delete edits.grades[id];
    else edits.grades[id] = grade;
  }
  writeEdits(edits);
  return true;
}

function matches(node: ParkNode, needle: string, level: ParkLevel | 'all', grade: ParkGrade | 'all'): boolean {
  if (level !== 'all' && node.level !== level) return false;
  if (grade !== 'all' && node.grade !== grade) return false;
  if (!needle) return level !== 'all' || grade !== 'all';
  return (
    node.name.toLowerCase().includes(needle) ||
    node.code.toLowerCase().includes(needle) ||
    (node.level === 'park' && node.placeName.toLowerCase().includes(needle))
  );
}

export function parkTreeAutoOpen(
  catalog: ParkCatalog,
  query: string,
  level: ParkLevel | 'all',
  grade: ParkGrade | 'all',
): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle && level === 'all' && grade === 'all') return open;

  function mark(id: string): boolean {
    const node = catalog.byId.get(id);
    if (!node) return false;
    const children = catalog.childrenOf.get(id) ?? [];
    let childHit = false;
    for (const child of children) {
      if (mark(child.id)) childHit = true;
    }
    if (childHit) open.add(id);
    return matches(node, needle, level, grade) || childHit;
  }

  for (const root of catalog.childrenOf.get('') ?? []) mark(root.id);
  return open;
}

export function visibleParkTree(
  catalog: ParkCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  level: ParkLevel | 'all',
  grade: ParkGrade | 'all',
): ParkTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (level !== 'all' || grade !== 'all') {
    const matched: ParkTreeRow[] = [];
    for (const node of catalog.byId.values()) {
      if (!matches(node, needle, level, grade)) continue;
      matched.push({ ...node, depth: 0, branch: false });
    }
    return matched.slice().sort(compareNode);
  }

  const filtering = needle.length > 0 || grade !== 'all';
  const matched = new Map<string, boolean>();

  function hasMatch(node: ParkNode): boolean {
    const cached = matched.get(node.id);
    if (cached !== undefined) return cached;
    const self = matches(node, needle, 'all', grade);
    const children = catalog.childrenOf.get(node.id) ?? [];
    const hit = self || children.some(hasMatch);
    matched.set(node.id, hit);
    return hit;
  }

  function walk(nodes: ParkNode[], depth: number, parentHit: boolean): ParkTreeRow[] {
    const rows: ParkTreeRow[] = [];
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const self = matches(node, needle, 'all', grade === 'all' ? 'all' : node.level === 'park' ? grade : 'all');
      const showAllChildren = grade === 'all' && (!filtering || parentHit || self);
      const visibleChildren = showAllChildren ? children : children.filter(hasMatch);
      if (filtering && !parentHit && !self && visibleChildren.length === 0) continue;
      if (node.level === 'park' && grade !== 'all' && node.grade !== grade) continue;
      rows.push({ ...node, depth, branch: visibleChildren.length > 0 });
      if (openIds.has(node.id)) rows.push(...walk(visibleChildren, depth + 1, showAllChildren));
    }
    return rows;
  }

  return walk(catalog.childrenOf.get('') ?? [], 0, false);
}
