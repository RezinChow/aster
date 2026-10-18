/**
 * Ops plan catalog.
 * Seeded from the official pricing page (zh CNY, en USD).
 * Enterprise is custom — no numeric price. Edits stay in this session.
 */

export type PlanId = 'free' | 'builder' | 'team' | 'enterprise';
export type PlanUnit = 'seat_month';
export type PlanMeter = 'os_usage';

export type PlanCopy = {
  zh: string;
  en: string;
};

export type PlanPrices = {
  /** Null when the plan is custom and has no listed number. */
  monthly: number | null;
  annual: number | null;
};

export type CatalogPlan = {
  id: PlanId;
  /** Product name. Same in both locales. */
  name: string;
  audience: PlanCopy;
  description: PlanCopy;
  features: { zh: string[]; en: string[] };
  includes: { zh: string[]; en: string[] };
  /** Absent when the official card has no per-seat period. */
  unit: PlanUnit | null;
  /** Absent when OS usage is not metered on this plan. */
  meter: PlanMeter | null;
  highlighted: boolean;
  custom: boolean;
  cny: PlanPrices;
  usd: PlanPrices;
};

export type PlanUpdate = {
  audience: PlanCopy;
  description: PlanCopy;
  features: { zh: string[]; en: string[] };
  includes: { zh: string[]; en: string[] };
  unit: PlanUnit | null;
  meter: PlanMeter | null;
  highlighted: boolean;
  custom: boolean;
  cny: PlanPrices;
  usd: PlanPrices;
};

const plans: CatalogPlan[] = [
  {
    id: 'free',
    name: 'Free',
    audience: { zh: '适合个人试用', en: 'For individual evaluation' },
    description: {
      zh: '在实际项目中完成首次本地工作会话。',
      en: 'Complete your first local work session on a real project.',
    },
    features: {
      zh: ['1 个 Work 席位', '本地上下文与权限边界', '基础会话与任务', '社区支持'],
      en: [
        '1 Work seat',
        'Local context & permission boundaries',
        'Basic sessions & tasks',
        'Community support',
      ],
    },
    includes: { zh: ['Work 基础'], en: ['Work basics'] },
    unit: null,
    meter: null,
    highlighted: false,
    custom: false,
    cny: { monthly: 0, annual: 0 },
    usd: { monthly: 0, annual: 0 },
  },
  {
    id: 'builder',
    name: 'Builder',
    audience: {
      zh: '适合早期团队与独立开发者',
      en: 'For early teams and independent developers',
    },
    description: {
      zh: '将高频工作沉淀为可复用能力，并接入 OS。',
      en: 'Turn recurring work into reusable capability and connect to OS.',
    },
    features: {
      zh: ['完整工作区', '记忆写入与检索', '耐久工作流基础', 'API / Webhooks', '邮件支持'],
      en: [
        'Full workspace',
        'Memory write & retrieval',
        'Durable workflow basics',
        'API / Webhooks',
        'Email support',
      ],
    },
    includes: { zh: ['Work', 'OS 起步'], en: ['Work', 'OS starter'] },
    unit: 'seat_month',
    meter: 'os_usage',
    highlighted: false,
    custom: false,
    cny: { monthly: 249, annual: 199 },
    usd: { monthly: 37, annual: 29 },
  },
  {
    id: 'team',
    name: 'Team',
    audience: { zh: '适合多团队协作', en: 'For multi-team collaboration' },
    description: {
      zh: '支持能力共享、策略发布与流程自动化。',
      en: 'Shared capabilities, policy publishing, and workflow automation.',
    },
    features: {
      zh: ['团队共享与版本', '策略与发布治理', '工作流自动化', '优先支持', '20 个协作者席位'],
      en: [
        'Team sharing & versions',
        'Policy & publish governance',
        'Workflow automation',
        'Priority support',
        '20 collaborator seats',
      ],
    },
    includes: { zh: ['Work', 'OS', '治理'], en: ['Work', 'OS', 'Governance'] },
    unit: 'seat_month',
    meter: 'os_usage',
    highlighted: true,
    custom: false,
    cny: { monthly: 499, annual: 399 },
    usd: { monthly: 75, annual: 59 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: {
      zh: '适合大型组织与受监管环境',
      en: 'For large organizations and regulated environments',
    },
    description: {
      zh: '支持自托管控制面、身份集成与合规要求。',
      en: 'Self-hosted control plane, identity integration, and compliance requirements.',
    },
    features: {
      zh: ['专属 / 自托管', 'SSO / SCIM', '自定义管理员角色', 'SLA 与专属支持', '50 个协作者席位'],
      en: [
        'Dedicated / self-hosted',
        'SSO / SCIM',
        'Custom admin roles',
        'SLA & dedicated support',
        '50 collaborator seats',
      ],
    },
    includes: { zh: ['控制面', '合规'], en: ['Control plane', 'Compliance'] },
    unit: null,
    meter: null,
    highlighted: false,
    custom: true,
    cny: { monthly: null, annual: null },
    usd: { monthly: null, annual: null },
  },
];

function clonePlan(plan: CatalogPlan): CatalogPlan {
  return {
    ...plan,
    audience: { ...plan.audience },
    description: { ...plan.description },
    features: { zh: [...plan.features.zh], en: [...plan.features.en] },
    includes: { zh: [...plan.includes.zh], en: [...plan.includes.en] },
    cny: { ...plan.cny },
    usd: { ...plan.usd },
  };
}

function listedPrice(value: number | null): boolean {
  return value != null && Number.isFinite(value) && value >= 0;
}

export function listPlans(): CatalogPlan[] {
  return plans.map(clonePlan);
}

export function updatePlan(id: PlanId, patch: PlanUpdate): CatalogPlan | undefined {
  const item = plans.find((plan) => plan.id === id);
  if (!item) return undefined;
  if (!patch.audience.zh.trim() || !patch.audience.en.trim()) return undefined;
  if (!patch.description.zh.trim() || !patch.description.en.trim()) return undefined;
  const prices = [patch.cny.monthly, patch.cny.annual, patch.usd.monthly, patch.usd.annual];
  if (patch.custom) {
    if (prices.some((value) => value != null)) return undefined;
  } else if (!prices.every(listedPrice)) {
    return undefined;
  }
  item.audience = { zh: patch.audience.zh.trim(), en: patch.audience.en.trim() };
  item.description = {
    zh: patch.description.zh.trim(),
    en: patch.description.en.trim(),
  };
  item.features = {
    zh: patch.features.zh.map((line) => line.trim()).filter(Boolean),
    en: patch.features.en.map((line) => line.trim()).filter(Boolean),
  };
  item.includes = {
    zh: patch.includes.zh.map((line) => line.trim()).filter(Boolean),
    en: patch.includes.en.map((line) => line.trim()).filter(Boolean),
  };
  item.unit = patch.unit;
  item.meter = patch.meter;
  item.highlighted = patch.highlighted;
  item.custom = patch.custom;
  item.cny = patch.custom
    ? { monthly: null, annual: null }
    : { monthly: patch.cny.monthly, annual: patch.cny.annual };
  item.usd = patch.custom
    ? { monthly: null, annual: null }
    : { monthly: patch.usd.monthly, annual: patch.usd.annual };
  return clonePlan(item);
}
