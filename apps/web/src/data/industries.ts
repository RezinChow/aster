import {
  INDUSTRY_EDITION,
  INDUSTRY_ROWS,
  type IndustryLevel,
  type IndustryRow,
} from '@/data/industries.data';

export type { IndustryLevel, IndustryRow };
export { INDUSTRY_EDITION };

export type Industry = IndustryRow & {
  childCount: number;
};

export type IndustryCatalog = {
  edition: string;
  byId: Map<string, Industry>;
  childrenOf: Map<string, Industry[]>;
  counts: Record<IndustryLevel, number>;
};

const INDUSTRY_EDITS_KEY = 'kense.console.industryEdits.v1';

export type IndustryEdits = {
  names: Record<string, string>;
  removed: string[];
  added: IndustryRow[];
};

const EMPTY_EDITS: IndustryEdits = { names: {}, removed: [], added: [] };

function isIndustryLevel(value: unknown): value is IndustryLevel {
  return value === 'section' || value === 'division';
}

function isIndustryRow(value: unknown): value is IndustryRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as IndustryRow;
  return (
    typeof row.id === 'string' &&
    typeof row.code === 'string' &&
    typeof row.name === 'string' &&
    typeof row.parent === 'string' &&
    isIndustryLevel(row.level)
  );
}

function readIndustryEdits(): IndustryEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(INDUSTRY_EDITS_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<IndustryEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const baseIds = new Set(INDUSTRY_ROWS.map((row) => row.id));
    return {
      names,
      removed: Array.isArray(parsed.removed)
        ? parsed.removed.filter((id): id is string => typeof id === 'string')
        : [],
      added: Array.isArray(parsed.added)
        ? parsed.added.filter((row) => isIndustryRow(row) && !baseIds.has(row.id))
        : [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeIndustryEdits(edits: IndustryEdits) {
  localStorage.setItem(INDUSTRY_EDITS_KEY, JSON.stringify(edits));
  catalogCache = null;
}

export function applyIndustryEdits(
  base: readonly IndustryRow[],
  edits: IndustryEdits,
): IndustryRow[] {
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

function subtreeIds(rows: readonly IndustryRow[], id: string): string[] {
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

function childLevel(level: IndustryLevel): IndustryLevel | null {
  if (level === 'section') return 'division';
  return null;
}

export function renameIndustry(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const edits = readIndustryEdits();
  const rows = applyIndustryEdits(INDUSTRY_ROWS, edits);
  const current = rows.find((row) => row.id === id);
  if (!current || current.name === trimmed) return Boolean(current);
  const added = edits.added.find((row) => row.id === id);
  const base = INDUSTRY_ROWS.find((row) => row.id === id);
  const original = added?.name ?? base?.name;
  if (trimmed === original) delete edits.names[id];
  else edits.names[id] = trimmed;
  writeIndustryEdits(edits);
  return true;
}

export function addIndustryChild(parentId: string, name: string): IndustryRow | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const edits = readIndustryEdits();
  const rows = applyIndustryEdits(INDUSTRY_ROWS, edits);
  const parent = rows.find((row) => row.id === parentId);
  const level = parent ? childLevel(parent.level) : null;
  if (!parent || !level) return null;
  const row: IndustryRow = {
    id: `cind_${crypto.randomUUID()}`,
    code: '',
    name: trimmed,
    level,
    parent: parentId,
  };
  edits.added.push(row);
  writeIndustryEdits(edits);
  return row;
}

export function removeIndustry(id: string) {
  const edits = readIndustryEdits();
  const rows = applyIndustryEdits(INDUSTRY_ROWS, edits);
  if (!rows.some((row) => row.id === id)) return;
  const drop = new Set(subtreeIds(rows, id));
  const baseIds = new Set(INDUSTRY_ROWS.map((row) => row.id));
  for (const dropId of drop) {
    if (baseIds.has(dropId) && !edits.removed.includes(dropId)) edits.removed.push(dropId);
    delete edits.names[dropId];
  }
  edits.added = edits.added.filter((row) => !drop.has(row.id));
  writeIndustryEdits(edits);
}

function buildCatalog(rows: readonly IndustryRow[]): IndustryCatalog {
  const byId = new Map<string, Industry>();
  const childrenOf = new Map<string, Industry[]>();
  const counts: Record<IndustryLevel, number> = { section: 0, division: 0 };
  for (const row of rows) {
    const industry: Industry = { ...row, childCount: 0 };
    byId.set(row.id, industry);
    counts[row.level] += 1;
    const siblings = childrenOf.get(row.parent);
    if (siblings) siblings.push(industry);
    else childrenOf.set(row.parent, [industry]);
  }
  for (const industry of byId.values()) {
    industry.childCount = childrenOf.get(industry.id)?.length ?? 0;
  }
  for (const siblings of childrenOf.values()) siblings.sort(compareIndustry);
  return { edition: INDUSTRY_EDITION, byId, childrenOf, counts };
}

let catalogCache: IndustryCatalog | null = null;

export function loadIndustryCatalog(): IndustryCatalog {
  catalogCache ??= buildCatalog(applyIndustryEdits(INDUSTRY_ROWS, readIndustryEdits()));
  return catalogCache;
}

export function reloadIndustryCatalog(): IndustryCatalog {
  catalogCache = null;
  return loadIndustryCatalog();
}

export type IndustryTreeRow = Industry & {
  depth: number;
  branch: boolean;
};

function matchesIndustry(
  industry: Industry,
  needle: string,
  level: IndustryLevel | 'all',
): boolean {
  if (level !== 'all' && industry.level !== level) return false;
  if (!needle) return level !== 'all';
  return industry.name.toLowerCase().includes(needle) || industry.code.toLowerCase().includes(needle);
}

export function industryTreeAutoOpen(
  catalog: IndustryCatalog,
  query: string,
  level: IndustryLevel | 'all',
): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle) return open;
  const roots = catalog.childrenOf.get('') ?? [];

  function mark(nodes: Industry[]): boolean {
    let any = false;
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const childHit = mark(children);
      if (childHit) open.add(node.id);
      if (matchesIndustry(node, needle, level) || childHit) any = true;
    }
    return any;
  }

  mark(roots);
  return open;
}

function compareIndustry(a: Industry, b: Industry): number {
  if (a.code !== b.code) {
    if (!a.code) return 1;
    if (!b.code) return -1;
    return a.code < b.code ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'zh');
}

export function visibleIndustryTree(
  catalog: IndustryCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  level: IndustryLevel | 'all',
): IndustryTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (level !== 'all') {
    const matched: IndustryTreeRow[] = [];
    for (const industry of catalog.byId.values()) {
      if (industry.level !== level) continue;
      if (
        needle &&
        !industry.name.toLowerCase().includes(needle) &&
        !industry.code.toLowerCase().includes(needle)
      ) {
        continue;
      }
      matched.push({ ...industry, depth: 0, branch: false });
    }
    return matched.slice().sort(compareIndustry);
  }
  const filtering = needle.length > 0;
  const roots = catalog.childrenOf.get('') ?? [];
  const matched = new Map<string, boolean>();

  function hasMatch(industry: Industry): boolean {
    const cached = matched.get(industry.id);
    if (cached !== undefined) return cached;
    const self = matchesIndustry(industry, needle, level);
    const children = catalog.childrenOf.get(industry.id) ?? [];
    const hit = self || children.some(hasMatch);
    matched.set(industry.id, hit);
    return hit;
  }

  function walk(nodes: Industry[], depth: number): IndustryTreeRow[] {
    const rows: IndustryTreeRow[] = [];
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const visibleChildren = filtering ? children.filter(hasMatch) : children;
      if (filtering && !matchesIndustry(node, needle, level) && visibleChildren.length === 0) {
        continue;
      }
      rows.push({ ...node, depth, branch: visibleChildren.length > 0 });
      if (openIds.has(node.id)) rows.push(...walk(visibleChildren, depth + 1));
    }
    return rows;
  }

  return walk(roots, 0);
}
