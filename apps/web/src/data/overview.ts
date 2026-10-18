/** Overview control-plane snapshot (mock). Aligns with ARCHITECTURE eight domains. */

export type OverviewSeverity = 'info' | 'warn' | 'danger';
export type OverviewHealth = 'healthy' | 'degraded' | 'down' | 'idle';

/** Notification / attention category (task type). */
export type OverviewAttentionKind =
  | 'task'
  | 'mail'
  | 'usage'
  | 'entitlement'
  | 'infra';

export type OverviewAttention = {
  id: string;
  kind: OverviewAttentionKind;
  severity: OverviewSeverity;
  href: string;
  /** i18n message key for the attention line */
  messageKey:
    | 'overview.attention.tasks'
    | 'overview.attention.mail'
    | 'overview.attention.provider'
    | 'overview.attention.fleet'
    | 'overview.attention.pool'
    | 'overview.attention.spend'
    | 'overview.attention.entitlement';
  count: number;
};

export type OverviewTask = {
  id: string;
  source: 'agent' | 'workflow';
  summary: string;
  scope: string;
  waiting: string;
  href: string;
};

export type OverviewHealthPlane = {
  id: string;
  href: string;
  status: OverviewHealth;
  labelKey:
    | 'overview.health.gateway'
    | 'overview.health.inference'
    | 'overview.health.marketplace'
    | 'overview.health.fleet'
    | 'overview.health.flows'
    | 'overview.health.identity';
  detailKey:
    | 'overview.health.gatewayDetail'
    | 'overview.health.inferenceDetail'
    | 'overview.health.marketplaceDetail'
    | 'overview.health.fleetDetail'
    | 'overview.health.flowsDetail'
    | 'overview.health.identityDetail';
};

export const overviewMeta = {
  installation: 'a3s-managed',
  org: '',
  env: '',
  asOf: '',
};

/** Notification center — pending tasks / delivery risks. */
export const overviewAttention: OverviewAttention[] = [];

const emptySeries: number[] = [];

export const overviewKpis = {
  tasks: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  gateway: { value: '0', tone: 'ok' as const },
  fleet: { value: '0', tone: 'ok' as const },
  usage: { value: '0', tone: 'ok' as const },
  activeUsers: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  payingUsers: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  customers: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  channels: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  paidSeats: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  revenue: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  orders: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
  tickets: {
    value: '0',
    tone: 'ok' as const,
    wow: 0,
    mom: 0,
    series: emptySeries,
  },
};

/** Subscription mix. Counts stay at zero until a ledger provides them. */
export const overviewPlanMix: Array<{
  id: 'free' | 'builder' | 'team' | 'enterprise';
  seats: number;
  customers: number;
  color: string;
}> = [
  { id: 'free', seats: 0, customers: 0, color: '#5c6b7a' },
  { id: 'builder', seats: 0, customers: 0, color: '#2f6fed' },
  { id: 'team', seats: 0, customers: 0, color: '#1f8a70' },
  { id: 'enterprise', seats: 0, customers: 0, color: '#c9872a' },
];

export const overviewPlanMeta = {
  trials: 0,
  annualShare: 0,
  collaboratorSeats: 0,
  paidSeats: 0,
};

/** User conversion funnel. */
export const overviewFunnel: Array<{
  id: 'visit' | 'signup' | 'trial' | 'paid' | 'annual';
  count: number;
}> = [
  { id: 'visit', count: 0 },
  { id: 'signup', count: 0 },
  { id: 'trial', count: 0 },
  { id: 'paid', count: 0 },
  { id: 'annual', count: 0 },
];

export const overviewTasks: OverviewTask[] = [];

export const overviewHealth: OverviewHealthPlane[] = [
  {
    id: 'gateway',
    href: '/admin/gateway',
    status: 'idle',
    labelKey: 'overview.health.gateway',
    detailKey: 'overview.health.gatewayDetail',
  },
  {
    id: 'inference',
    href: '/admin/assets/models',
    status: 'idle',
    labelKey: 'overview.health.inference',
    detailKey: 'overview.health.inferenceDetail',
  },
  {
    id: 'marketplace',
    href: '/admin/marketplace',
    status: 'idle',
    labelKey: 'overview.health.marketplace',
    detailKey: 'overview.health.marketplaceDetail',
  },
  {
    id: 'fleet',
    href: '/admin/fleet',
    status: 'idle',
    labelKey: 'overview.health.fleet',
    detailKey: 'overview.health.fleetDetail',
  },
  {
    id: 'flows',
    href: '/admin/workflows',
    status: 'idle',
    labelKey: 'overview.health.flows',
    detailKey: 'overview.health.flowsDetail',
  },
  {
    id: 'identity',
    href: '/admin/team/members',
    status: 'idle',
    labelKey: 'overview.health.identity',
    detailKey: 'overview.health.identityDetail',
  },
];

export const overviewCommercial = {
  entitled: 0,
  providers: 0,
  channels: 0,
  customers: 0,
  payingCustomers: 0,
  spendTodayUsd: 0,
  spendCapUsd: 0,
  spendPct: 0,
  nearCapCustomers: 0,
};

export const overviewUserSpendRank: Array<{
  id: string;
  name: string;
  org: string;
  spendUsd: number;
  avatarUrl: string;
  href: string;
}> = [];

export const overviewApiRevenueRank: Array<{
  id: string;
  name: string;
  provider: string;
  revenueUsd: number;
  calls: number;
  logoUrl: string;
  href: string;
}> = [];

export const overviewModelUsageRank: Array<{
  id: string;
  name: string;
  provider: string;
  tokens: number;
  requests: number;
  logoUrl: string;
  href: string;
}> = [];

export const overviewMcpUsageRank: Array<{
  id: string;
  name: string;
  provider: string;
  calls: number;
  tools: number;
  logoUrl: string;
  href: string;
}> = [];
