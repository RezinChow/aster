import {
  DIVISION_EDITION,
  DIVISION_ROWS,
  type DivisionLevel,
  type DivisionRow,
} from '@/data/divisions.data';

export type { DivisionLevel, DivisionRow };
export { DIVISION_EDITION };

export type Division = DivisionRow & {
  childCount: number;
};

export type DivisionCatalog = {
  edition: string;
  byId: Map<string, Division>;
  childrenOf: Map<string, Division[]>;
  counts: Record<DivisionLevel, number>;
};

const DIVISION_EDITS_KEY = 'kense.console.divisionEdits.v1';

export type DivisionEdits = {
  names: Record<string, string>;
  removed: string[];
  added: DivisionRow[];
};

const EMPTY_EDITS: DivisionEdits = { names: {}, removed: [], added: [] };

function isDivisionLevel(value: unknown): value is DivisionLevel {
  return value === 'province' || value === 'city' || value === 'county';
}

function isDivisionRow(value: unknown): value is DivisionRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as DivisionRow;
  return (
    typeof row.id === 'string' &&
    typeof row.code === 'string' &&
    typeof row.name === 'string' &&
    typeof row.parent === 'string' &&
    isDivisionLevel(row.level)
  );
}

function readDivisionEdits(): DivisionEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(DIVISION_EDITS_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<DivisionEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const baseIds = new Set(DIVISION_ROWS.map((row) => row.id));
    return {
      names,
      removed: Array.isArray(parsed.removed)
        ? parsed.removed.filter((id): id is string => typeof id === 'string')
        : [],
      added: Array.isArray(parsed.added)
        ? parsed.added.filter((row) => isDivisionRow(row) && !baseIds.has(row.id))
        : [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeDivisionEdits(edits: DivisionEdits) {
  localStorage.setItem(DIVISION_EDITS_KEY, JSON.stringify(edits));
  catalogCache = null;
}

export function applyDivisionEdits(base: readonly DivisionRow[], edits: DivisionEdits): DivisionRow[] {
  const removed = new Set(edits.removed);
  const combined = [...base, ...edits.added];
  const parentOf = new Map(combined.map((row) => [row.id, row.parent]));
  const dropped = new Set<string>();

  function isRemoved(id: string): boolean {
    if (dropped.has(id)) return true;
    const seen = new Set<string>();
    let current: string | undefined = id;
    while (current) {
      if (removed.has(current) || dropped.has(current)) {
        dropped.add(id);
        return true;
      }
      if (seen.has(current)) return false;
      seen.add(current);
      const parent = parentOf.get(current);
      current = parent ? parent : undefined;
    }
    return false;
  }

  const kept = combined.filter((row) => !isRemoved(row.id));
  const ids = new Set(kept.map((row) => row.id));
  return kept
    .filter((row) => row.parent === '' || ids.has(row.parent))
    .map((row) => {
      const name = edits.names[row.id];
      return name && name !== row.name ? { ...row, name } : row;
    });
}

function subtreeIds(rows: readonly DivisionRow[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    const siblings = childrenOf.get(row.parent);
    if (siblings) siblings.push(row.id);
    else childrenOf.set(row.parent, [row.id]);
  }
  const out: string[] = [];
  const pending = [id];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    const children = childrenOf.get(current);
    if (children) pending.push(...children);
  }
  return out;
}

function childLevel(level: DivisionLevel): DivisionLevel | null {
  if (level === 'province') return 'city';
  if (level === 'city') return 'county';
  return null;
}

export function renameDivision(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const edits = readDivisionEdits();
  const rows = applyDivisionEdits(DIVISION_ROWS, edits);
  const current = rows.find((row) => row.id === id);
  if (!current || current.name === trimmed) return Boolean(current);
  const added = edits.added.find((row) => row.id === id);
  const base = DIVISION_ROWS.find((row) => row.id === id);
  const original = added?.name ?? base?.name;
  if (trimmed === original) delete edits.names[id];
  else edits.names[id] = trimmed;
  writeDivisionEdits(edits);
  return true;
}

export function addDivisionChild(parentId: string, name: string): DivisionRow | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const edits = readDivisionEdits();
  const rows = applyDivisionEdits(DIVISION_ROWS, edits);
  const parent = rows.find((row) => row.id === parentId);
  const level = parent ? childLevel(parent.level) : null;
  if (!parent || !level) return null;
  const row: DivisionRow = {
    id: `cdiv_${crypto.randomUUID()}`,
    code: '',
    name: trimmed,
    level,
    parent: parentId,
  };
  edits.added.push(row);
  writeDivisionEdits(edits);
  return row;
}

export function removeDivision(id: string) {
  const edits = readDivisionEdits();
  const rows = applyDivisionEdits(DIVISION_ROWS, edits);
  if (!rows.some((row) => row.id === id)) return;
  const drop = new Set(subtreeIds(rows, id));
  const baseIds = new Set(DIVISION_ROWS.map((row) => row.id));
  for (const dropId of drop) {
    if (baseIds.has(dropId) && !edits.removed.includes(dropId)) edits.removed.push(dropId);
    delete edits.names[dropId];
  }
  edits.added = edits.added.filter((row) => !drop.has(row.id));
  writeDivisionEdits(edits);
}

function buildCatalog(rows: readonly DivisionRow[]): DivisionCatalog {
  const byId = new Map<string, Division>();
  const childrenOf = new Map<string, Division[]>();
  const counts: Record<DivisionLevel, number> = { province: 0, city: 0, county: 0 };
  for (const row of rows) {
    const division: Division = { ...row, childCount: 0 };
    byId.set(row.id, division);
    counts[row.level] += 1;
    const siblings = childrenOf.get(row.parent);
    if (siblings) siblings.push(division);
    else childrenOf.set(row.parent, [division]);
  }
  for (const division of byId.values()) {
    division.childCount = childrenOf.get(division.id)?.length ?? 0;
  }
  return { edition: DIVISION_EDITION, byId, childrenOf, counts };
}

let catalogCache: DivisionCatalog | null = null;

export function loadDivisionCatalog(): DivisionCatalog {
  catalogCache ??= buildCatalog(applyDivisionEdits(DIVISION_ROWS, readDivisionEdits()));
  return catalogCache;
}

export function divisionName(id: string): string {
  if (!id) return '';
  return loadDivisionCatalog().byId.get(id)?.name ?? '';
}

export type DivisionTreeRow = Division & {
  depth: number;
  branch: boolean;
};

function matchesDivision(division: Division, needle: string, level: DivisionLevel | 'all'): boolean {
  if (level !== 'all' && division.level !== level) return false;
  if (!needle) return level !== 'all';
  return division.name.toLowerCase().includes(needle) || division.code.includes(needle);
}

export function divisionTreeAutoOpen(
  catalog: DivisionCatalog,
  query: string,
  level: DivisionLevel | 'all',
): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle) return open;
  const roots = catalog.childrenOf.get('') ?? [];

  function mark(nodes: Division[]): boolean {
    let any = false;
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const childHit = mark(children);
      if (childHit) open.add(node.id);
      if (matchesDivision(node, needle, level) || childHit) any = true;
    }
    return any;
  }

  mark(roots);
  return open;
}

function compareDivision(a: Division, b: Division): number {
  if (a.code !== b.code) {
    if (!a.code) return 1;
    if (!b.code) return -1;
    return a.code < b.code ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'zh');
}

export function reloadDivisionCatalog(): DivisionCatalog {
  catalogCache = null;
  return loadDivisionCatalog();
}

export function visibleDivisionTree(
  catalog: DivisionCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  level: DivisionLevel | 'all',
): DivisionTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (level !== 'all') {
    const matched: DivisionTreeRow[] = [];
    for (const division of catalog.byId.values()) {
      if (division.level !== level) continue;
      if (needle && !division.name.toLowerCase().includes(needle) && !division.code.includes(needle)) continue;
      matched.push({ ...division, depth: 0, branch: false });
    }
    return matched.slice().sort(compareDivision);
  }
  const filtering = needle.length > 0;
  const roots = catalog.childrenOf.get('') ?? [];
  const matched = new Map<string, boolean>();

  function hasMatch(division: Division): boolean {
    const cached = matched.get(division.id);
    if (cached !== undefined) return cached;
    const self = matchesDivision(division, needle, level);
    const children = catalog.childrenOf.get(division.id) ?? [];
    const hit = self || children.some(hasMatch);
    matched.set(division.id, hit);
    return hit;
  }

  function walk(nodes: Division[], depth: number): DivisionTreeRow[] {
    const rows: DivisionTreeRow[] = [];
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const visibleChildren = filtering ? children.filter(hasMatch) : children;
      if (filtering && !matchesDivision(node, needle, level) && visibleChildren.length === 0) continue;
      rows.push({ ...node, depth, branch: visibleChildren.length > 0 });
      if (openIds.has(node.id)) rows.push(...walk(visibleChildren, depth + 1));
    }
    return rows;
  }

  return walk(roots, 0);
}
