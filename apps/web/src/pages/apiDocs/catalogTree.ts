import type { Locale } from '@/prefs/store';
import type { ApiOperation } from '@/lib/openapi';
import { groupLabel, operationTitle } from './labels';

export type CatalogNode = {
  id: string;
  label: string;
  operation?: ApiOperation;
  children: CatalogNode[];
};

const PLANE_FIRST = ['admin', 'org'];

export type DocsPlane = 'front' | 'back';

/** 前台 is `/v1/api/org`. Everything else in this spec is 后台, including host git and probes. */
export function docsPlaneForPath(path: string): DocsPlane {
  return path === '/v1/api/org' || path.startsWith('/v1/api/org/') ? 'front' : 'back';
}

/** Skip the doubled `/v1/api/admin/v1/api/admin` prefix when choosing a default operation. */
export function preferCatalogOp(ops: ApiOperation[], plane: DocsPlane): ApiOperation | undefined {
  if (!ops.length) return undefined;
  if (plane === 'back') {
    return ops.find((op) => !op.path.includes('/v1/api/admin/v1/api/')) ?? ops[0];
  }
  return ops[0];
}

function planeLabel(key: string, locale: Locale): string {
  if (key === 'admin') return locale === 'zh' ? '管理' : 'Admin';
  if (key === 'org') return locale === 'zh' ? '成员' : 'Member';
  return groupLabel(key, locale);
}

function resourceLabel(plane: string, resource: string, locale: Locale): string {
  const full = groupLabel(`${plane}/${resource}`, locale);
  const split = full.split(' · ');
  return split.length > 1 ? split[split.length - 1] : full;
}

function operationNode(op: ApiOperation, locale: Locale): CatalogNode {
  return {
    id: op.id,
    label: operationTitle(op, locale),
    operation: op,
    children: [],
  };
}

/** Segments after the module. A doubled `/v1/api/admin/v1/api/admin` prefix is skipped once. */
function restSegments(path: string): string[] {
  let parts = path.split('/').filter(Boolean);
  if (
    parts[0] === 'v1' &&
    parts[1] === 'api' &&
    parts[2] === 'admin' &&
    parts[3] === 'v1' &&
    parts[4] === 'api' &&
    parts[5] === 'admin'
  ) {
    parts = ['v1', 'api', 'admin', ...parts.slice(6)];
  }
  if (parts[0] === 'v1' && parts[1] === 'api' && (parts[2] === 'admin' || parts[2] === 'org')) {
    return parts.slice(4);
  }
  return parts.slice(1);
}

/**
 * A segment is a namespace when every path continues into at least two
 * different static children (`identity/cloud/nodes`, `identity/cloud/skills`).
 * A collection that owns its own root (`conversations`, `suppliers`) is not one.
 */
function namespaceSegments(items: ApiOperation[]): Set<string> {
  const hasRoot = new Map<string, boolean>();
  const nextStatic = new Map<string, Set<string>>();
  for (const op of items) {
    const rest = restSegments(op.path);
    const first = rest.find((seg) => !seg.startsWith('{'));
    if (!first) continue;
    const idx = rest.indexOf(first);
    const only = rest.slice(idx + 1).every((seg) => seg.startsWith('{'));
    hasRoot.set(first, (hasRoot.get(first) ?? false) || only);
    const next = rest[idx + 1];
    if (next && !next.startsWith('{')) {
      const seen = nextStatic.get(first) ?? new Set<string>();
      seen.add(next);
      nextStatic.set(first, seen);
    }
  }
  const namespaces = new Set<string>();
  for (const [seg, root] of hasRoot) {
    if (!root && (nextStatic.get(seg)?.size ?? 0) >= 2) namespaces.add(seg);
  }
  return namespaces;
}

/** Second menu level: the resource noun under a module. */
function subgroupKey(path: string, namespaces: Set<string>): string {
  const rest = restSegments(path);
  let index = 0;
  while (index < rest.length && rest[index].startsWith('{')) index += 1;
  if (index >= rest.length) return '';
  const key = rest[index];
  const next = rest[index + 1];
  if (!next) return key;
  if (!next.startsWith('{')) return namespaces.has(key) ? next : key;
  if (next === '{org_id}') {
    const after = rest[index + 2];
    if (after && !after.startsWith('{')) return after;
  }
  return key;
}

function nestOperations(
  planeKey: string,
  resourceKey: string,
  items: ApiOperation[],
  locale: Locale,
): CatalogNode[] {
  const namespaces = namespaceSegments(items);
  const buckets = new Map<string, ApiOperation[]>();
  const order: string[] = [];
  for (const op of items) {
    const key = subgroupKey(op.path, namespaces);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(op);
  }
  const named = order.filter(Boolean);
  if (named.length === 0 || (named.length === 1 && !buckets.has(''))) {
    return items.map((op) => operationNode(op, locale));
  }
  const nodes: CatalogNode[] = (buckets.get('') ?? []).map((op) => operationNode(op, locale));
  for (const key of named) {
    nodes.push({
      id: resourceKey ? `${planeKey}/${resourceKey}/${key}` : `${planeKey}/${key}`,
      label: resourceLabel('admin', key, locale),
      children: buckets.get(key)!.map((op) => operationNode(op, locale)),
    });
  }
  return nodes;
}

/** Nest `admin/model-service` groups into plane → resource → operation. */
export function buildCatalogTree(
  groups: Array<{ group: string; items: ApiOperation[] }>,
  locale: Locale,
): CatalogNode[] {
  const planes = new Map<string, Map<string, ApiOperation[]>>();
  const order: string[] = [];
  for (const { group, items } of groups) {
    const planeMatch = /^(admin|org)\/(.+)$/.exec(group);
    const planeKey = planeMatch ? planeMatch[1] : group;
    const resourceKey = planeMatch ? planeMatch[2] : '';
    if (!planes.has(planeKey)) {
      planes.set(planeKey, new Map());
      order.push(planeKey);
    }
    const resources = planes.get(planeKey)!;
    const existing = resources.get(resourceKey) ?? [];
    resources.set(resourceKey, existing.concat(items));
  }

  order.sort((a, b) => {
    const ai = PLANE_FIRST.indexOf(a);
    const bi = PLANE_FIRST.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    }
    return planeLabel(a, locale).localeCompare(planeLabel(b, locale), locale === 'zh' ? 'zh' : 'en');
  });

  return order.map((planeKey) => {
    const resources = planes.get(planeKey)!;
    const children: CatalogNode[] = [];
    for (const [resourceKey, items] of resources) {
      const nested = nestOperations(planeKey, resourceKey, items, locale);
      if (!resourceKey) {
        children.push(...nested);
      } else {
        children.push({
          id: `${planeKey}/${resourceKey}`,
          label: resourceLabel(planeKey, resourceKey, locale),
          children: nested,
        });
      }
    }
    return {
      id: planeKey,
      label: planeLabel(planeKey, locale),
      children,
    };
  });
}

/** Left menu. Drops the redundant 管理 / 成员 root once a plane is already selected. */
export function buildSideCatalog(
  groups: Array<{ group: string; items: ApiOperation[] }>,
  locale: Locale,
): CatalogNode[] {
  const nodes: CatalogNode[] = [];
  for (const node of buildCatalogTree(groups, locale)) {
    if (node.id === 'admin' || node.id === 'org') nodes.push(...node.children);
    else nodes.push(node);
  }
  return nodes;
}

export function catalogBranchIds(nodes: CatalogNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (!node.operation && node.children.length) {
      ids.push(node.id);
      ids.push(...catalogBranchIds(node.children));
    }
  }
  return ids;
}

export function catalogAncestorIds(nodes: CatalogNode[], operationId: string): string[] {
  const found = walk(nodes, operationId, []);
  return found ?? [];
}

function walk(nodes: CatalogNode[], operationId: string, trail: string[]): string[] | null {
  for (const node of nodes) {
    if (node.operation?.id === operationId) return trail;
    if (node.children.length) {
      const nested = walk(node.children, operationId, [...trail, node.id]);
      if (nested) return nested;
    }
  }
  return null;
}

export function countCatalogOperations(node: CatalogNode): number {
  if (node.operation) return 1;
  return node.children.reduce((sum, child) => sum + countCatalogOperations(child), 0);
}
