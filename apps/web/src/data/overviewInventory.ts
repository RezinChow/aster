/** Home / 总览 — service inventory + capability resource projections (mock). */

export type OverviewServiceId = 'workflows' | 'functions' | 'cells' | 'inference';

export type OverviewServiceItem = {
  id: OverviewServiceId;
  href: string;
  count: number;
  ready: number;
  degraded: number;
};

/** Orchestration assets — deep-link to automate destinations. */
export const overviewServices: OverviewServiceItem[] = [
  {
    id: 'workflows',
    href: '/admin/workflows',
    count: 0,
    ready: 0,
    degraded: 0,
  },
  {
    id: 'functions',
    href: '/admin/functions',
    count: 0,
    ready: 0,
    degraded: 0,
  },
  {
    id: 'cells',
    href: '/admin/cells',
    count: 0,
    ready: 0,
    degraded: 0,
  },
  {
    id: 'inference',
    href: '/admin/assets/models',
    count: 0,
    ready: 0,
    degraded: 0,
  },
];

export type OverviewResourceKind =
  | 'agent'
  | 'workflow'
  | 'model'
  | 'api'
  | 'connector'
  | 'skill'
  | 'tool'
  | 'applet'
  | 'knowledge';

export type OverviewResourceItem = {
  kind: OverviewResourceKind;
  /** Category count within this capability kind. */
  categories: number;
  /** Resource count within this capability kind. */
  resources: number;
  /** Deep-link into Market catalog. */
  href: string;
  color: string;
};

/**
 * Capability resources — Market catalog kinds.
 */
export const overviewResources: OverviewResourceItem[] = [
  {
    kind: 'agent',
    categories: 0,
    resources: 0,
    href: '/admin/market/agents',
    color: '#4f46e5',
  },
  {
    kind: 'workflow',
    categories: 0,
    resources: 0,
    href: '/admin/market/workflows',
    color: '#0d9488',
  },
  {
    kind: 'model',
    categories: 0,
    resources: 0,
    href: '/admin/assets/models',
    color: '#475569',
  },
  {
    kind: 'api',
    categories: 0,
    resources: 0,
    href: '/admin/market/services',
    color: '#1f8a70',
  },
  {
    kind: 'connector',
    categories: 0,
    resources: 0,
    href: '/admin/assets/connectors',
    color: '#2f6fed',
  },
  {
    kind: 'skill',
    categories: 0,
    resources: 0,
    href: '/admin/assets/skills',
    color: '#c9872a',
  },
  {
    kind: 'tool',
    categories: 0,
    resources: 0,
    href: '/admin/market/tools',
    color: '#c45c3e',
  },
  {
    kind: 'applet',
    categories: 0,
    resources: 0,
    href: '/admin/market/applets',
    color: '#3d7a9a',
  },
  {
    kind: 'knowledge',
    categories: 0,
    resources: 0,
    href: '/admin/market/knowledge-bases',
    color: '#5c6b7a',
  },
];

export function resourceCategoryTotal(
  items: OverviewResourceItem[] = overviewResources,
) {
  return items.reduce((sum, item) => sum + item.categories, 0);
}

export function resourceCountTotal(
  items: OverviewResourceItem[] = overviewResources,
) {
  return items.reduce((sum, item) => sum + item.resources, 0);
}
