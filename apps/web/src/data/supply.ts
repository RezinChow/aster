/** Supply chain: pipeline, artifact, and market release. No seeded products. */

export type PackageKind =
  | 'skill'
  | 'knowledge'
  | 'applet'
  | 'api'
  | 'connector'
  | 'tool'
  | 'agent'
  | 'workflow'
  | 'model';

export type ArtifactBuildStatus = 'success' | 'failed' | 'building';

export type SupplyArtifact = {
  id: string;
  kind: PackageKind;
  /** Package slug (skill.slug / kb.slug) */
  packageSlug: string;
  repoId: string;
  version: string;
  digest: string;
  sourceRevision: string;
  pipelineRunId: string;
  status: ArtifactBuildStatus;
  signed: boolean;
  builtAt: string;
};

export type MarketReleaseStatus = 'listed' | 'unlisted';

export type MarketRelease = {
  id: string;
  kind: PackageKind;
  /** Skill id or knowledge-base id */
  packageId: string;
  /**
   * Engineering artifact id when this SKU was published from a build.
   * Listing-only products (no eng binding yet) omit this.
   */
  artifactId?: string;
  version: string;
  digest: string;
  publishedAt: string;
  status: MarketReleaseStatus;
  unlistedAt?: string;
  /** Ops cost / list price (USD). Missing on older fixtures → treated as 0. */
  costPriceUsd?: number;
  salePriceUsd?: number;
  /** Optional sale window (YYYY-MM-DD or YYYY-MM-DDTHH:mm). */
  saleStartsAt?: string;
  saleEndsAt?: string;
  /**
   * Remaining sellable units (API listings = call quota).
   * Undefined / omitted = unlimited.
   */
  inventoryLimit?: number;
  /** Markup multiplier applied to unit/sale price. Min 0.01; default 1. */
  priceMultiplier?: number;
  /** Per-operation pricing for API packages (unit × multiplier). */
  endpointPricing?: MarketEndpointPricing[];
  /**
   * Optional API rate limit (sliding window + optional daily cap).
   * Modeled after World Monitor public/plan limits.
   * Undefined = no product-level rate limit.
   */
  rateLimit?: MarketRateLimit;
};

/** Sliding-window burst + optional UTC-day hard cap for API listings. */
export type MarketRateLimit = {
  /** Max requests in the sliding window. */
  requestsPerWindow: number;
  /** Window length in seconds (typically 60). */
  windowSeconds: number;
  /** Optional daily hard cap (UTC day). Omit = unlimited. */
  requestsPerDay?: number;
};

export type MarketEndpointParamIn = 'path' | 'query' | 'header' | 'body';

/** Merchandised OpenAPI parameter for a Gateway endpoint SKU. */
export type MarketEndpointParam = {
  name: string;
  in: MarketEndpointParamIn;
  /** JSON Schema-ish type label: string | number | boolean | object | array */
  type: string;
  required?: boolean;
  description?: string;
  descriptionEn?: string;
  example?: string;
};

export type LocaleCopy = {
  zh: string;
  en: string;
};

export type MarketEndpointPricing = {
  /** Stable key: `${method}:${path}` */
  key: string;
  method: string;
  path: string;
  /** Ops-facing display name (editable). Defaults to Chinese. */
  name?: string;
  /** Ops-facing description (editable). Defaults to Chinese. */
  description?: string;
  /** Localized name. `name` stays the Chinese copy for older readers. */
  names?: LocaleCopy;
  /** Localized description. `description` stays the Chinese copy. */
  descriptions?: LocaleCopy;
  /**
   * Family / category for product-page endpoint tabs.
   * Prefer explicit ids from upstream catalogs (`openai`, `perplexity`, …).
   */
  groupId?: string;
  /** Localized group label. Falls back to `groupId` when omitted. */
  groupNames?: LocaleCopy;
  /** Technical summary from OpenAPI / upstream (fallback label). */
  summary?: string;
  operationId?: string;
  /** Declared OpenAPI parameters for this endpoint. */
  openApiParams?: MarketEndpointParam[];
  /** Per-call unit price override (USD). Inherit product sale when omitted. */
  unitPriceUsd?: number;
  /** Multiplier override. Inherit product multiplier when omitted. */
  multiplier?: number;
  /**
   * Per-endpoint rate limit override.
   * Omit to inherit the product-level rateLimit (or no limit).
   */
  rateLimit?: MarketRateLimit;
};

function cloneEndpointPricing(e: MarketEndpointPricing): MarketEndpointPricing {
  return {
    ...e,
    rateLimit: e.rateLimit ? { ...e.rateLimit } : undefined,
    names: e.names ? { ...e.names } : undefined,
    descriptions: e.descriptions ? { ...e.descriptions } : undefined,
    groupNames: e.groupNames ? { ...e.groupNames } : undefined,
    openApiParams: e.openApiParams?.map((p) => ({ ...p })),
  };
}

function localeCopy(pair?: LocaleCopy): LocaleCopy | undefined {
  if (!pair) return undefined;
  const zh = pair.zh.trim();
  const en = pair.en.trim();
  if (!zh && !en) return undefined;
  return { zh, en };
}

export function endpointText(
  row: MarketEndpointPricing,
  locale: 'zh' | 'en',
  field: 'name' | 'description',
): string {
  const localized =
    field === 'name' ? row.names?.[locale] : row.descriptions?.[locale];
  const zh =
    field === 'name' ? row.names?.zh || row.name : row.descriptions?.zh || row.description;
  const picked = (locale === 'en' ? localized : zh)?.trim();
  if (picked) return picked;
  if (locale === 'en') return (zh || row.summary || '').trim();
  return (field === 'name' ? row.name : row.description)?.trim() || row.summary?.trim() || '';
}

function normalizeEndpointPricingRow(
  row: MarketEndpointPricing,
): MarketEndpointPricing {
  const rateLimit = normalizeRateLimit(row.rateLimit);
  const openApiParams = row.openApiParams
    ?.map((p) => ({
      name: p.name.trim(),
      in: p.in,
      type: (p.type || 'string').trim() || 'string',
      ...(p.required ? { required: true as const } : {}),
      ...(p.description?.trim()
        ? { description: p.description.trim() }
        : {}),
      ...(p.descriptionEn?.trim()
        ? { descriptionEn: p.descriptionEn.trim() }
        : {}),
      ...(p.example?.trim() ? { example: p.example.trim() } : {}),
    }))
    .filter((p) => p.name.length > 0);
  const item: MarketEndpointPricing = {
    key: row.key,
    method: row.method,
    path: row.path,
    summary: row.summary,
    operationId: row.operationId,
    unitPriceUsd:
      row.unitPriceUsd === undefined
        ? undefined
        : Math.max(0, row.unitPriceUsd),
    multiplier:
      row.multiplier === undefined
        ? undefined
        : Math.max(0.01, row.multiplier),
  };
  if (row.name?.trim()) item.name = row.name.trim();
  if (row.description?.trim()) item.description = row.description.trim();
  const names = localeCopy(row.names);
  const descriptions = localeCopy(row.descriptions);
  if (names) item.names = names;
  if (descriptions) item.descriptions = descriptions;
  if (row.groupId?.trim()) {
    item.groupId = row.groupId.trim();
    const groupNames = localeCopy(row.groupNames);
    if (groupNames) item.groupNames = groupNames;
  }
  if (openApiParams?.length) item.openApiParams = openApiParams;
  if (rateLimit) item.rateLimit = rateLimit;
  return item;
}

/** Resolve the tab group for a subdivided endpoint. */
export function endpointGroupOf(row: MarketEndpointPricing): {
  id: string;
  names: LocaleCopy;
} {
  const explicit = row.groupId?.trim();
  if (explicit) {
    return {
      id: explicit,
      names: localeCopy(row.groupNames) ?? { zh: explicit, en: explicit },
    };
  }
  // `supplier.family.capability` → family (SiliconFlow / Boyue)
  const oid = (row.operationId || '').trim();
  const parts = oid.split('.');
  if (parts.length >= 3 && parts[1]) {
    const family = parts[1];
    return { id: family, names: { zh: family, en: family } };
  }
  return { id: 'default', names: { zh: '接口', en: 'Endpoints' } };
}

/** Stable ordered unique groups for product endpoint tabs. */
export function listEndpointGroups(
  rows: MarketEndpointPricing[],
): Array<{ id: string; names: LocaleCopy; count: number }> {
  const order: string[] = [];
  const map = new Map<string, { id: string; names: LocaleCopy; count: number }>();
  for (const row of rows) {
    const g = endpointGroupOf(row);
    const hit = map.get(g.id);
    if (hit) {
      hit.count += 1;
      continue;
    }
    order.push(g.id);
    map.set(g.id, { id: g.id, names: g.names, count: 1 });
  }
  return order.map((id) => map.get(id)!);
}

export type PipelineRun = {
  id: string;
  repoId: string;
  packageSlug: string;
  kind: PackageKind;
  sourceRevision: string;
  status: 'success' | 'failed' | 'running';
  artifactId?: string;
  startedAt: string;
};

let artifacts: SupplyArtifact[] = [];

let releases: MarketRelease[] = [];

let pipelineRuns: PipelineRun[] = [];

function cloneArtifact(a: SupplyArtifact): SupplyArtifact {
  return { ...a };
}

function cloneRelease(r: MarketRelease): MarketRelease {
  return {
    ...r,
    costPriceUsd: r.costPriceUsd ?? 0,
    salePriceUsd: r.salePriceUsd ?? 0,
    priceMultiplier: r.priceMultiplier ?? 1,
    endpointPricing: r.endpointPricing?.map(cloneEndpointPricing),
    rateLimit: r.rateLimit ? { ...r.rateLimit } : undefined,
  };
}

export function listArtifacts(filter?: {
  kind?: PackageKind;
  packageSlug?: string;
  repoId?: string;
}): SupplyArtifact[] {
  return artifacts
    .filter((a) => {
      if (filter?.kind && a.kind !== filter.kind) return false;
      if (filter?.packageSlug && a.packageSlug !== filter.packageSlug)
        return false;
      if (filter?.repoId && a.repoId !== filter.repoId) return false;
      return true;
    })
    .map(cloneArtifact);
}

export function findArtifact(id: string): SupplyArtifact | undefined {
  const found = artifacts.find((a) => a.id === id);
  return found ? cloneArtifact(found) : undefined;
}

export function listMarketReleases(filter?: {
  kind?: PackageKind;
  packageId?: string;
  status?: MarketReleaseStatus;
}): MarketRelease[] {
  return releases
    .filter((r) => {
      if (filter?.kind && r.kind !== filter.kind) return false;
      if (filter?.packageId && r.packageId !== filter.packageId) return false;
      if (filter?.status && r.status !== filter.status) return false;
      return true;
    })
    .map(cloneRelease);
}

export function findMarketRelease(id: string): MarketRelease | undefined {
  const found = releases.find((r) => r.id === id);
  return found ? cloneRelease(found) : undefined;
}

export function latestMarketRelease(
  packageId: string,
): MarketRelease | undefined {
  const list = listMarketReleases({ packageId, status: 'listed' }).sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  );
  return list[0];
}

export type MarketProductSummary = {
  packageId: string;
  kind: PackageKind;
  latestListed?: MarketRelease;
  versions: MarketRelease[];
  versionCount: number;
  listedCount: number;
};

/** Group market releases into products for ops catalog. */
export function listMarketProducts(kind: PackageKind): MarketProductSummary[] {
  const byPackage = new Map<string, MarketRelease[]>();
  for (const release of listMarketReleases({ kind })) {
    const list = byPackage.get(release.packageId) ?? [];
    list.push(release);
    byPackage.set(release.packageId, list);
  }
  return [...byPackage.entries()]
    .map(([packageId, versions]) => {
      const sorted = [...versions].sort((a, b) =>
        b.publishedAt.localeCompare(a.publishedAt),
      );
      const listed = sorted.filter((v) => v.status === 'listed');
      return {
        packageId,
        kind,
        latestListed: listed[0],
        versions: sorted,
        versionCount: sorted.length,
        listedCount: listed.length,
      };
    })
    .sort((a, b) => {
      const aAt = a.latestListed?.publishedAt ?? a.versions[0]?.publishedAt ?? '';
      const bAt = b.latestListed?.publishedAt ?? b.versions[0]?.publishedAt ?? '';
      return bAt.localeCompare(aAt);
    });
}

/** Successful signed builds not yet released to market for this package. */
export function listPublishableArtifacts(input: {
  kind: PackageKind;
  packageId: string;
  packageSlug: string;
}): SupplyArtifact[] {
  const released = new Set(
    listMarketReleases({
      kind: input.kind,
      packageId: input.packageId,
    })
      .map((r) => r.artifactId)
      .filter((id): id is string => Boolean(id)),
  );
  return listArtifacts({
    kind: input.kind,
    packageSlug: input.packageSlug,
  }).filter(
    (a) => a.status === 'success' && a.signed && !released.has(a.id),
  );
}

export function publishMarketRelease(input: {
  kind: PackageKind;
  packageId: string;
  /** When set, SKU version/digest come from this signed artifact. */
  artifactId?: string;
  /** Used when publishing a listing-only SKU (no eng artifact). */
  version?: string;
  costPriceUsd?: number;
  salePriceUsd?: number;
  priceMultiplier?: number;
  saleStartsAt?: string;
  saleEndsAt?: string;
  inventoryLimit?: number;
  endpointPricing?: MarketEndpointPricing[];
  rateLimit?: MarketRateLimit;
}): MarketRelease | undefined {
  const artifactId = input.artifactId?.trim() || undefined;
  let version: string;
  let digest: string;
  let resolvedArtifactId: string | undefined;

  if (artifactId) {
    const artifact = findArtifact(artifactId);
    if (!artifact || artifact.status !== 'success' || !artifact.signed) {
      return undefined;
    }
    if (artifact.kind !== input.kind) return undefined;
    if (
      releases.some(
        (r) =>
          r.packageId === input.packageId && r.artifactId === artifactId,
      )
    ) {
      return undefined;
    }
    version = artifact.version;
    digest = artifact.digest;
    resolvedArtifactId = artifact.id;
  } else {
    version = input.version?.trim() || '0.1.0';
    digest = `sha256:listing_${input.packageId}_${version.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    if (
      releases.some(
        (r) =>
          r.packageId === input.packageId &&
          !r.artifactId &&
          r.version === version,
      )
    ) {
      return undefined;
    }
  }

  const costPriceUsd = Math.max(0, input.costPriceUsd ?? 0);
  const salePriceUsd = Math.max(0, input.salePriceUsd ?? 0);
  const priceMultiplier = Math.max(0.01, input.priceMultiplier ?? 1);
  const saleStartsAt = input.saleStartsAt?.trim() || undefined;
  const saleEndsAt = input.saleEndsAt?.trim() || undefined;
  const inventoryLimit =
    input.inventoryLimit === undefined || input.inventoryLimit === null
      ? undefined
      : Math.max(0, Math.floor(input.inventoryLimit));
  const endpointPricing = input.endpointPricing?.map(normalizeEndpointPricingRow);
  const rateLimit = normalizeRateLimit(input.rateLimit);
  const release: MarketRelease = {
    id: `rel_${Date.now().toString(36)}`,
    kind: input.kind,
    packageId: input.packageId,
    ...(resolvedArtifactId ? { artifactId: resolvedArtifactId } : {}),
    version,
    digest,
    publishedAt: new Date().toISOString().slice(0, 10),
    status: 'listed',
    costPriceUsd,
    salePriceUsd,
    priceMultiplier,
    ...(saleStartsAt ? { saleStartsAt } : {}),
    ...(saleEndsAt ? { saleEndsAt } : {}),
    ...(inventoryLimit !== undefined ? { inventoryLimit } : {}),
    ...(endpointPricing?.length ? { endpointPricing } : {}),
    ...(rateLimit ? { rateLimit } : {}),
  };
  releases = [release, ...releases];
  return cloneRelease(release);
}

function normalizeRateLimit(
  input?: MarketRateLimit,
): MarketRateLimit | undefined {
  if (!input) return undefined;
  const requestsPerWindow = Math.floor(input.requestsPerWindow);
  const windowSeconds = Math.floor(input.windowSeconds);
  if (
    !Number.isFinite(requestsPerWindow) ||
    requestsPerWindow < 1 ||
    !Number.isFinite(windowSeconds) ||
    windowSeconds < 1
  ) {
    return undefined;
  }
  const requestsPerDay =
    input.requestsPerDay === undefined || input.requestsPerDay === null
      ? undefined
      : Math.max(1, Math.floor(input.requestsPerDay));
  return {
    requestsPerWindow,
    windowSeconds,
    ...(requestsPerDay !== undefined ? { requestsPerDay } : {}),
  };
}

function bumpPatch(version: string): string {
  const parts = version.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return '0.1.0';
  }
  return `${parts[0]}.${parts[1]}.${(parts[2] ?? 0) + 1}`;
}

function nextVersion(packageSlug: string, kind: PackageKind): string {
  const existing = listArtifacts({ packageSlug, kind })
    .map((a) => a.version)
    .sort()
    .reverse();
  return existing[0] ? bumpPatch(existing[0]) : '0.1.0';
}

/** Mock: trigger pipeline on current HEAD → success artifact. */
export function triggerPackageBuild(input: {
  kind: PackageKind;
  packageSlug: string;
  repoId: string;
  sourceRevision: string;
}): { run: PipelineRun; artifact: SupplyArtifact } {
  const version = nextVersion(input.packageSlug, input.kind);
  const runId = `pr_${Date.now().toString(36)}`;
  const artId = `art_${Date.now().toString(36)}`;
  const today = new Date().toISOString().slice(0, 10);
  const digest = `sha256:${artId.padEnd(64, '0').slice(0, 64)}`;
  const artifact: SupplyArtifact = {
    id: artId,
    kind: input.kind,
    packageSlug: input.packageSlug,
    repoId: input.repoId,
    version,
    digest,
    sourceRevision: input.sourceRevision,
    pipelineRunId: runId,
    status: 'success',
    signed: true,
    builtAt: today,
  };
  const run: PipelineRun = {
    id: runId,
    repoId: input.repoId,
    packageSlug: input.packageSlug,
    kind: input.kind,
    sourceRevision: input.sourceRevision,
    status: 'success',
    artifactId: artId,
    startedAt: today,
  };
  artifacts = [artifact, ...artifacts];
  pipelineRuns = [run, ...pipelineRuns];
  return { run: { ...run }, artifact: cloneArtifact(artifact) };
}

export function listPipelineRuns(filter?: {
  repoId?: string;
  packageSlug?: string;
}): PipelineRun[] {
  return pipelineRuns
    .filter((r) => {
      if (filter?.repoId && r.repoId !== filter.repoId) return false;
      if (filter?.packageSlug && r.packageSlug !== filter.packageSlug)
        return false;
      return true;
    })
    .map((r) => ({ ...r }));
}

export function shortDigest(digest: string): string {
  const raw = digest.replace(/^sha256:/, '');
  return raw.slice(0, 12);
}

/** Soft-unlist a market release (keeps history for ops). */
export function unlistMarketRelease(releaseId: string): boolean {
  const idx = releases.findIndex((r) => r.id === releaseId);
  if (idx < 0) return false;
  const current = releases[idx]!;
  if (current.status === 'unlisted') return true;
  const next: MarketRelease = {
    ...current,
    status: 'unlisted',
    unlistedAt: new Date().toISOString().slice(0, 10),
  };
  releases = [
    ...releases.slice(0, idx),
    next,
    ...releases.slice(idx + 1),
  ];
  return true;
}

/** Re-list a previously unlisted market release. */
export function relistMarketRelease(releaseId: string): boolean {
  const idx = releases.findIndex((r) => r.id === releaseId);
  if (idx < 0) return false;
  const current = releases[idx]!;
  if (current.status === 'listed') return true;
  const { unlistedAt: _removed, ...rest } = current;
  const next: MarketRelease = { ...rest, status: 'listed' };
  releases = [
    ...releases.slice(0, idx),
    next,
    ...releases.slice(idx + 1),
  ];
  return true;
}

/** Patch commercial params on a market release (ops inline edit). */
export function updateMarketRelease(
  releaseId: string,
  patch: {
    costPriceUsd?: number;
    salePriceUsd?: number;
    priceMultiplier?: number;
    /** Pass null to clear (= unlimited). */
    inventoryLimit?: number | null;
    /** Pass null to clear product-level rate limit. */
    rateLimit?: MarketRateLimit | null;
    saleStartsAt?: string | null;
    saleEndsAt?: string | null;
    endpointPricing?: MarketEndpointPricing[];
  },
): MarketRelease | undefined {
  const idx = releases.findIndex((r) => r.id === releaseId);
  if (idx < 0) return undefined;
  const current = releases[idx]!;
  const next: MarketRelease = { ...current };

  if (patch.costPriceUsd !== undefined) {
    next.costPriceUsd = Math.max(0, patch.costPriceUsd);
  }
  if (patch.salePriceUsd !== undefined) {
    next.salePriceUsd = Math.max(0, patch.salePriceUsd);
  }
  if (patch.priceMultiplier !== undefined) {
    next.priceMultiplier = Math.max(0.01, patch.priceMultiplier);
  }
  if (patch.inventoryLimit !== undefined) {
    if (patch.inventoryLimit === null) {
      delete next.inventoryLimit;
    } else {
      next.inventoryLimit = Math.max(0, Math.floor(patch.inventoryLimit));
    }
  }
  if (patch.rateLimit !== undefined) {
    if (patch.rateLimit === null) {
      delete next.rateLimit;
    } else {
      const normalized = normalizeRateLimit(patch.rateLimit);
      if (normalized) next.rateLimit = normalized;
      else delete next.rateLimit;
    }
  }
  if (patch.saleStartsAt !== undefined) {
    if (patch.saleStartsAt === null || !patch.saleStartsAt.trim()) {
      delete next.saleStartsAt;
    } else {
      next.saleStartsAt = patch.saleStartsAt.trim();
    }
  }
  if (patch.saleEndsAt !== undefined) {
    if (patch.saleEndsAt === null || !patch.saleEndsAt.trim()) {
      delete next.saleEndsAt;
    } else {
      next.saleEndsAt = patch.saleEndsAt.trim();
    }
  }
  if (patch.endpointPricing !== undefined) {
    next.endpointPricing = patch.endpointPricing.map(normalizeEndpointPricingRow);
    if (!next.endpointPricing.length) delete next.endpointPricing;
  }

  releases = [
    ...releases.slice(0, idx),
    next,
    ...releases.slice(idx + 1),
  ];
  return cloneRelease(next);
}
