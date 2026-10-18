import { loadDivisionCatalog, type Division } from '@/data/divisions';
import { TAG_SCOPE_NATIONWIDE, TAG_SEEDS, type TagGrade, type TagLevel, type TagSeed } from '@/data/tags.data';

export type { TagGrade, TagLevel, TagSeed };
export { TAG_SCOPE_NATIONWIDE };

export type Tag = TagSeed & {
  childCount: number;
  scopeName: string;
  scopePath: string[];
};

export type TagCatalog = {
  byId: Map<string, Tag>;
  childrenOf: Map<string, Tag[]>;
  counts: Record<TagLevel, number>;
  gradeCounts: Record<TagGrade, number>;
};

export type TagTreeRow = Tag & {
  depth: number;
  branch: boolean;
};

export type TagCodeResult = 'ok' | 'empty' | 'invalid' | 'duplicate';

type TagEdits = {
  names: Record<string, string>;
  codes: Record<string, string>;
  grades: Record<string, TagGrade>;
  scopes: Record<string, string>;
  removed: string[];
  added: TagSeed[];
};

const STORAGE_KEY = 'kense.console.tags.v2';
const EMPTY_EDITS: TagEdits = { names: {}, codes: {}, grades: {}, scopes: {}, removed: [], added: [] };
const CODE_PATTERN = /^[a-z][a-z0-9_.]{0,63}$/;
const TAG_GRADES: readonly TagGrade[] = ['national', 'provincial', 'municipal', 'county'];

function isTagGrade(value: unknown): value is TagGrade {
  return typeof value === 'string' && (TAG_GRADES as readonly string[]).includes(value);
}

function isTagLevel(value: unknown): value is TagLevel {
  return value === 'group' || value === 'tag';
}

function isTagSeed(value: unknown): value is TagSeed {
  if (!value || typeof value !== 'object') return false;
  const row = value as TagSeed;
  return (
    typeof row.id === 'string' &&
    typeof row.code === 'string' &&
    typeof row.name === 'string' &&
    typeof row.parent === 'string' &&
    isTagLevel(row.level) &&
    (row.scopeId === undefined || typeof row.scopeId === 'string') &&
    (row.level === 'group' ? row.grade === '' || row.grade === undefined : isTagGrade(row.grade))
  );
}

function readEdits(): TagEdits {
  if (typeof localStorage === 'undefined') return EMPTY_EDITS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_EDITS;
    const parsed = JSON.parse(raw) as Partial<TagEdits>;
    const names: Record<string, string> = {};
    if (parsed.names && typeof parsed.names === 'object') {
      for (const [id, name] of Object.entries(parsed.names)) {
        if (typeof name === 'string' && name.trim()) names[id] = name.trim();
      }
    }
    const codes: Record<string, string> = {};
    if (parsed.codes && typeof parsed.codes === 'object') {
      for (const [id, code] of Object.entries(parsed.codes)) {
        if (typeof code === 'string' && CODE_PATTERN.test(code)) codes[id] = code;
      }
    }
    const grades: Record<string, TagGrade> = {};
    if (parsed.grades && typeof parsed.grades === 'object') {
      for (const [id, grade] of Object.entries(parsed.grades)) {
        if (isTagGrade(grade)) grades[id] = grade;
      }
    }
    const scopes: Record<string, string> = {};
    if (parsed.scopes && typeof parsed.scopes === 'object') {
      for (const [id, scopeId] of Object.entries(parsed.scopes)) {
        if (typeof scopeId === 'string') scopes[id] = scopeId;
      }
    }
    const baseIds = new Set(TAG_SEEDS.map((row) => row.id));
    return {
      names,
      codes,
      grades,
      scopes,
      removed: Array.isArray(parsed.removed)
        ? parsed.removed.filter((id): id is string => typeof id === 'string')
        : [],
      added: Array.isArray(parsed.added)
        ? parsed.added.filter((row) => isTagSeed(row) && !baseIds.has(row.id) && CODE_PATTERN.test(row.code))
        : [],
    };
  } catch {
    return EMPTY_EDITS;
  }
}

function writeEdits(edits: TagEdits) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  catalogCache = null;
}

function applyEdits(edits: TagEdits): TagSeed[] {
  const removed = new Set(edits.removed);
  const combined = [...TAG_SEEDS, ...edits.added];
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
      const code = edits.codes[row.id];
      const grade = edits.grades[row.id];
      const scopeId = edits.scopes[row.id];
      const named = name && name !== row.name ? { ...row, name } : row;
      const coded = code && code !== named.code ? { ...named, code } : named;
      const graded = grade && grade !== coded.grade ? { ...coded, grade } : coded;
      if (graded.level !== 'group') return { ...graded, scopeId: '' };
      const baseScope = graded.scopeId ?? '';
      return scopeId !== undefined && scopeId !== baseScope ? { ...graded, scopeId } : { ...graded, scopeId: baseScope };
    });
}

function subtreeIds(rows: readonly TagSeed[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    const siblings = childrenOf.get(row.parent);
    if (siblings) siblings.push(row.id);
    else childrenOf.set(row.parent, [row.id]);
  }
  const ids: string[] = [];
  const stack = [id];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    for (const child of childrenOf.get(current) ?? []) stack.push(child);
  }
  return ids;
}

function uniqueCode(rows: readonly TagSeed[], prefix: string): string {
  const taken = new Set(rows.map((row) => row.code));
  for (let i = 0; i < 8; i += 1) {
    const code = `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    if (!taken.has(code)) return code;
  }
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function renameTag(id: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const edits = readEdits();
  const current = applyEdits(edits).find((row) => row.id === id);
  if (!current || current.name === trimmed) return Boolean(current);
  const added = edits.added.find((row) => row.id === id);
  const base = TAG_SEEDS.find((row) => row.id === id);
  const original = added?.name ?? base?.name;
  if (trimmed === original) delete edits.names[id];
  else edits.names[id] = trimmed;
  writeEdits(edits);
  return true;
}

export function setTagCode(id: string, code: string): TagCodeResult {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return 'empty';
  if (!CODE_PATTERN.test(normalized)) return 'invalid';
  const edits = readEdits();
  const rows = applyEdits(edits);
  const current = rows.find((row) => row.id === id);
  if (!current) return 'empty';
  if (current.code === normalized) return 'ok';
  if (rows.some((row) => row.id !== id && row.code === normalized)) return 'duplicate';
  const added = edits.added.find((row) => row.id === id);
  if (added) {
    added.code = normalized;
    delete edits.codes[id];
  } else {
    const base = TAG_SEEDS.find((row) => row.id === id);
    if (!base) return 'empty';
    if (normalized === base.code) delete edits.codes[id];
    else edits.codes[id] = normalized;
  }
  writeEdits(edits);
  return 'ok';
}

export function setTagGrade(id: string, grade: TagGrade): boolean {
  if (!isTagGrade(grade)) return false;
  const edits = readEdits();
  const current = applyEdits(edits).find((row) => row.id === id);
  if (!current || current.level !== 'tag' || current.grade === grade) return Boolean(current?.level === 'tag');
  const added = edits.added.find((row) => row.id === id);
  if (added) {
    added.grade = grade;
    delete edits.grades[id];
  } else {
    const base = TAG_SEEDS.find((row) => row.id === id);
    if (!base || base.level !== 'tag') return false;
    if (grade === base.grade) delete edits.grades[id];
    else edits.grades[id] = grade;
  }
  writeEdits(edits);
  return true;
}

export function setTagScope(id: string, scopeId: string): boolean {
  const edits = readEdits();
  const current = applyEdits(edits).find((row) => row.id === id);
  if (!current || current.level !== 'group') return false;
  const next = scopeId.trim();
  if (next && !loadDivisionCatalog().byId.has(next)) return false;
  if ((current.scopeId ?? '') === next) return true;
  const added = edits.added.find((row) => row.id === id);
  if (added) {
    added.scopeId = next;
    delete edits.scopes[id];
  } else {
    const base = TAG_SEEDS.find((row) => row.id === id);
    if (!base) return false;
    if (next === (base.scopeId ?? '')) delete edits.scopes[id];
    else edits.scopes[id] = next;
  }
  writeEdits(edits);
  return true;
}

export function addTag(parentId: string, name: string): TagSeed | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const edits = readEdits();
  const rows = applyEdits(edits);
  const parent = parentId ? rows.find((row) => row.id === parentId) : undefined;
  if (parentId && (!parent || parent.level !== 'group')) return null;
  const row: TagSeed = {
    id: `ctag_${crypto.randomUUID()}`,
    code: uniqueCode(rows, parent ? 'tag' : 'group'),
    name: trimmed,
    level: parent ? 'tag' : 'group',
    grade: parent ? 'provincial' : '',
    parent: parentId,
    scopeId: '',
  };
  edits.added.push(row);
  writeEdits(edits);
  return row;
}

export function removeTag(id: string) {
  const edits = readEdits();
  const rows = applyEdits(edits);
  if (!rows.some((row) => row.id === id)) return;
  const drop = new Set(subtreeIds(rows, id));
  const baseIds = new Set(TAG_SEEDS.map((row) => row.id));
  for (const dropId of drop) {
    if (baseIds.has(dropId) && !edits.removed.includes(dropId)) edits.removed.push(dropId);
    delete edits.names[dropId];
    delete edits.codes[dropId];
    delete edits.grades[dropId];
    delete edits.scopes[dropId];
  }
  edits.added = edits.added.filter((row) => !drop.has(row.id));
  writeEdits(edits);
}

const GRADE_ORDER: Record<TagGrade | '', number> = {
  national: 0,
  provincial: 1,
  municipal: 2,
  county: 3,
  '': 4,
};

function compareTag(a: Tag, b: Tag): number {
  const gradeDelta = GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade];
  if (gradeDelta !== 0) return gradeDelta;
  return a.name.localeCompare(b.name, 'zh');
}

function scopeOf(scopeId: string): { scopeName: string; scopePath: string[] } {
  if (!scopeId) return { scopeName: '', scopePath: [] };
  const divisions = loadDivisionCatalog();
  const chain: Division[] = [];
  const seen = new Set<string>();
  let current = divisions.byId.get(scopeId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parent ? divisions.byId.get(current.parent) : undefined;
  }
  if (chain.length === 0) return { scopeName: '', scopePath: [] };
  return {
    scopePath: chain.map((row) => row.id),
    scopeName: chain
      .filter((row) => row.name !== '市辖区')
      .map((row) => row.name)
      .join(' / '),
  };
}

function buildCatalog(rows: readonly TagSeed[]): TagCatalog {
  const byId = new Map<string, Tag>();
  const childrenOf = new Map<string, Tag[]>();
  const counts: Record<TagLevel, number> = { group: 0, tag: 0 };
  const gradeCounts: Record<TagGrade, number> = { national: 0, provincial: 0, municipal: 0, county: 0 };
  for (const row of rows) {
    const scope = row.level === 'group' ? scopeOf(row.scopeId ?? '') : { scopeName: '', scopePath: [] as string[] };
    const tag: Tag = {
      ...row,
      grade: row.grade ?? '',
      scopeId: row.level === 'group' && scope.scopePath.length > 0 ? row.scopeId : '',
      scopeName: scope.scopeName,
      scopePath: scope.scopePath,
      childCount: 0,
    };
    byId.set(row.id, tag);
    counts[row.level] += 1;
    if (tag.level === 'tag' && isTagGrade(tag.grade)) gradeCounts[tag.grade] += 1;
    const siblings = childrenOf.get(row.parent);
    if (siblings) siblings.push(tag);
    else childrenOf.set(row.parent, [tag]);
  }
  for (const tag of byId.values()) tag.childCount = childrenOf.get(tag.id)?.length ?? 0;
  for (const [parent, siblings] of childrenOf) {
    if (parent !== '') siblings.sort(compareTag);
  }
  return { byId, childrenOf, counts, gradeCounts };
}

let catalogCache: TagCatalog | null = null;

export function loadTagCatalog(): TagCatalog {
  catalogCache ??= buildCatalog(applyEdits(readEdits()));
  return catalogCache;
}

export function reloadTagCatalog(): TagCatalog {
  catalogCache = null;
  return loadTagCatalog();
}

function matches(tag: Tag, needle: string, level: TagLevel | 'all', grade: TagGrade | 'all'): boolean {
  if (level !== 'all' && tag.level !== level) return false;
  if (grade !== 'all' && tag.grade !== grade) return false;
  if (!needle) return level !== 'all' || grade !== 'all';
  return tag.name.toLowerCase().includes(needle) || tag.code.toLowerCase().includes(needle) || tag.scopeName.toLowerCase().includes(needle);
}

function groupOf(catalog: TagCatalog, tag: Tag): Tag | undefined {
  if (tag.level === 'group') return tag;
  const parent = catalog.byId.get(tag.parent);
  if (parent?.level === 'group') return parent;
  return undefined;
}

/** Empty scope shows every group. `nationwide` keeps groups with no region. A division id keeps groups scoped to that place or somewhere inside it. */
function scopeMatches(group: Tag | undefined, scope: string): boolean {
  if (!scope) return true;
  if (!group || group.level !== 'group') return false;
  if (scope === TAG_SCOPE_NATIONWIDE) return group.scopeId === '';
  if (!group.scopeId) return false;
  return group.scopePath.includes(scope);
}

export function tagTreeAutoOpen(
  catalog: TagCatalog,
  query: string,
  level: TagLevel | 'all',
  grade: TagGrade | 'all',
  scope = '',
): Set<string> {
  const needle = query.trim().toLowerCase();
  const open = new Set<string>();
  if (!needle && !scope) return open;

  function mark(nodes: Tag[]): boolean {
    let any = false;
    for (const node of nodes) {
      const children = catalog.childrenOf.get(node.id) ?? [];
      const childHit = mark(children);
      if (childHit) open.add(node.id);
      const scoped = scopeMatches(groupOf(catalog, node), scope);
      if (scope && node.level === 'group' && scoped && (!needle || matches(node, needle, level, grade) || childHit)) {
        open.add(node.id);
      }
      if ((scoped && matches(node, needle, level, grade)) || childHit) any = true;
    }
    return any;
  }

  mark(catalog.childrenOf.get('') ?? []);
  return open;
}

export function visibleTagTree(
  catalog: TagCatalog,
  openIds: ReadonlySet<string>,
  query: string,
  level: TagLevel | 'all',
  grade: TagGrade | 'all',
  scope = '',
): TagTreeRow[] {
  const needle = query.trim().toLowerCase();
  if (level !== 'all' || grade !== 'all') {
    const matched: TagTreeRow[] = [];
    for (const tag of catalog.byId.values()) {
      if (!scopeMatches(groupOf(catalog, tag), scope)) continue;
      if (!matches(tag, needle, level, grade)) continue;
      matched.push({ ...tag, depth: 0, branch: false });
    }
    return matched.slice().sort(compareTag);
  }

  const filtering = needle.length > 0 || scope.length > 0;
  const matched = new Map<string, boolean>();

  function hasMatch(tag: Tag): boolean {
    const cached = matched.get(tag.id);
    if (cached !== undefined) return cached;
    if (!scopeMatches(groupOf(catalog, tag), scope)) {
      matched.set(tag.id, false);
      return false;
    }
    const self = needle ? matches(tag, needle, 'all', 'all') : true;
    const children = catalog.childrenOf.get(tag.id) ?? [];
    const hit = self || children.some(hasMatch);
    matched.set(tag.id, hit);
    return hit;
  }

  function walk(nodes: Tag[], depth: number): TagTreeRow[] {
    const rows: TagTreeRow[] = [];
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
