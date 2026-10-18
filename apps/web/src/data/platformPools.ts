/** Platform dashboard — resource pools. Counts stay empty until a pool ledger is wired. */

export type PoolKind = 'cpu' | 'gpu' | 'object' | 'volume' | 'network';
export type PoolHealth = 'healthy' | 'saturated' | 'degraded' | 'unreachable';
export type ClaimState = 'bound' | 'pending' | 'failed' | 'releasing';

export type ResourcePool = {
  id: string;
  kind: PoolKind;
  name: string;
  region: string;
  health: PoolHealth;
  /** 0–1 utilization of the scarce resource */
  usedRatio: number;
  /** Human summary of capacity ledger */
  capacityLabel: string;
  allocatableLabel: string;
  pendingClaims: number;
  failedClaims: number;
  href: string;
  note?: string;
};

export type DriftItem = {
  id: string;
  plane: 'edge' | 'workload' | 'inference' | 'pool';
  title: string;
  desired: string;
  observed: string;
  href: string;
  severity: 'warn' | 'danger';
};

export type PlacementFailure = {
  id: string;
  at: string;
  poolId: string;
  workload: string;
  reason: string;
};

/** Pool → Claim → consumer ledger snapshot */
export const platformPools: ResourcePool[] = [];

export const platformDrift: DriftItem[] = [];

export const placementFailures: PlacementFailure[] = [];

export const platformGatewaySignals = {
  trafficRpm: '0',
  latencyP99Ms: 0,
  errorRate: '0%',
  saturationLabel: '',
};

export function poolsByKind(kind: PoolKind): ResourcePool[] {
  return platformPools.filter((p) => p.kind === kind);
}

export function poolSummary() {
  const cpu = poolsByKind('cpu');
  const gpu = poolsByKind('gpu');
  const object = poolsByKind('object');
  const avg = (list: ResourcePool[]) =>
    list.length === 0
      ? 0
      : list.reduce((s, p) => s + p.usedRatio, 0) / list.length;
  return {
    cpuUsed: avg(cpu),
    gpuUsed: avg(gpu),
    objectUsed: avg(object),
    saturated: platformPools.filter(
      (p) => p.health === 'saturated' || p.health === 'unreachable',
    ).length,
    pendingClaims: platformPools.reduce((s, p) => s + p.pendingClaims, 0),
  };
}

function worstHealth(list: ResourcePool[]): PoolHealth {
  if (list.some((p) => p.health === 'unreachable')) return 'unreachable';
  if (list.some((p) => p.health === 'saturated')) return 'saturated';
  if (list.some((p) => p.health === 'degraded')) return 'degraded';
  return 'healthy';
}

export type ClusterKind = 'cpu' | 'gpu' | 'object';

export type ClusterCard = {
  kind: ClusterKind;
  href: string;
  health: PoolHealth;
  /** Compute utilization 0–1; null when kind has no cores (object) */
  computeUsedRatio: number | null;
  memoryUsedRatio: number;
  /** Capacity without SKU/model — e.g. 768 vCPU / 12 GPU */
  computeLabel: string | null;
  memoryLabel: string;
  computeFreeLabel: string | null;
  memoryFreeLabel: string;
  /** Object storage only — used capacity human label */
  storageUsedLabel?: string;
  pendingClaims: number;
  poolCount: number;
};

export function clusterCards(): ClusterCard[] {
  return [
    {
      kind: 'cpu',
      href: '/fleet?role=Runtime',
      health: worstHealth(poolsByKind('cpu')),
      computeUsedRatio: 0,
      memoryUsedRatio: 0,
      computeLabel: '0',
      memoryLabel: '0',
      computeFreeLabel: '0',
      memoryFreeLabel: '0',
      pendingClaims: poolsByKind('cpu').reduce((s, p) => s + p.pendingClaims, 0),
      poolCount: poolsByKind('cpu').length,
    },
    {
      kind: 'gpu',
      href: '/fleet?role=Power',
      health: worstHealth(poolsByKind('gpu')),
      computeUsedRatio: 0,
      memoryUsedRatio: 0,
      computeLabel: '0',
      memoryLabel: '0',
      computeFreeLabel: '0',
      memoryFreeLabel: '0',
      pendingClaims: poolsByKind('gpu').reduce((s, p) => s + p.pendingClaims, 0),
      poolCount: poolsByKind('gpu').length,
    },
    {
      kind: 'object',
      href: '/admin/settings/system',
      health: worstHealth(poolsByKind('object')),
      computeUsedRatio: null,
      memoryUsedRatio: poolSummary().objectUsed,
      computeLabel: null,
      memoryLabel: '0',
      computeFreeLabel: null,
      memoryFreeLabel: '0',
      storageUsedLabel: '0',
      pendingClaims: poolsByKind('object').reduce(
        (s, p) => s + p.pendingClaims,
        0,
      ),
      poolCount: poolsByKind('object').length,
    },
  ];
}
