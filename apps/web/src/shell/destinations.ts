import type { MessageKey } from '@/i18n/messages';

/**
 * Console IA — PRINCIPLES §4 · ARCHITECTURE.md
 *
 * ActivityBar = domain switcher (one job per domain).
 * Sidebar = destinations within the active domain only.
 *
 * Domains (top → bottom):
 *   运营 → 平台 → 系统
 * 系统侧栏的组织目录复用用户中心：成员、职位、角色。权限在角色页内。
 *
 * No Token Hub / Token Plan shells.
 * 运营 = 经营任务：业务（订阅 / 订单 / 工单）、商务（客户 / 渠道商 / 供应商）、服务（模型 / 智能体 / 连接器 / 插件 / 技能）。
 * 平台 = 研发与运维：工作负载、基础设施、可观测性.
 * 系统 = 组织与系统：通用（含公开说明）、团队与权限、安全与登录、系统配置、分类、行政.
 */
export type OsDestinationId =
  | 'overview'
  | 'overviewPlatform'
  | 'organizations'
  | 'departments'
  | 'users'
  | 'positions'
  | 'roles'
  | 'permissions'
  | 'workflows'
  | 'tasks'
  | 'functions'
  | 'agentRuntimes'
  | 'cells'
  | 'modelService'
  | 'marketplace'
  | 'entitlements'
  | 'applications'
  | 'applets'
  | 'apiServices'
  | 'agents'
  | 'connectors'
  | 'plugins'
  | 'skills'
  | 'tools'
  | 'knowledgeBases'
  | 'models'
  | 'fleet'
  | 'gateway'
  | 'topology'
  | 'events'
  | 'automations'
  | 'customers'
  | 'channels'
  | 'suppliers'
  | 'orders'
  | 'subscriptions'
  | 'settingsSystem'
  | 'settingsApps'
  | 'settingsNotices'
  | 'settingsSms'
  | 'settingsCaptcha'
  | 'settingsLogin'
  | 'settingsBootstrap'
  | 'settingsEntries'
  | 'settingsDebug'
  | 'settingsRegions'
  | 'settingsIndustries'
  | 'settingsChains'
  | 'settingsAdministration'
  | 'settingsParks'
  | 'settingsUniversities'
  | 'settingsTags';

export type OsDomainId = 'overview' | 'platform' | 'system';

export type OsNavIcon =
  | OsDestinationId
  | 'settings'
  | 'agents'
  | 'usage'
  | 'hubDocuments'
  | 'hubWiki'
  | 'hubArtifacts';

export type OsDestination = {
  id: OsDestinationId;
  to: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: OsNavIcon;
  end?: boolean;
};

export type OsNavSection = {
  /** Omit for single-item domains (e.g. overview) — no section chrome */
  labelKey?: MessageKey;
  items: OsDestinationId[];
};

export type OsNavGroup = {
  id: OsDomainId;
  labelKey?: MessageKey;
  sections: OsNavSection[];
};

/** ActivityBar domain → sidebar panel */
export type OsActivityDomain = {
  id: OsDomainId;
  labelKey: MessageKey;
  icon: OsNavIcon;
  /** First-landing route when switching into this domain from outside */
  defaultDestinationId: OsDestinationId;
};

/** 管理后台 console routes are mounted under the `/admin` URL prefix. */
export const ADMIN_PREFIX = '/admin';

/** Prefix a console-internal path with the `/admin` URL prefix. */
function admin(path: string): string {
  return `${ADMIN_PREFIX}${path}`;
}

/** Strip the `/admin` prefix from a location pathname (idempotent). */
export function stripAdminPrefix(pathname: string): string {
  if (pathname === ADMIN_PREFIX) return '/';
  return pathname.startsWith(`${ADMIN_PREFIX}/`)
    ? pathname.slice(ADMIN_PREFIX.length)
    : pathname;
}

export const OS_DESTINATIONS: Record<OsDestinationId, OsDestination> = {
  overview: {
    id: 'overview',
    to: admin('/'),
    labelKey: 'nav.overviewHome',
    descriptionKey: 'nav.overviewHomeDesc',
    icon: 'overview',
    end: true,
  },
  overviewPlatform: {
    id: 'overviewPlatform',
    to: admin('/platform'),
    labelKey: 'nav.overviewPlatform',
    descriptionKey: 'nav.overviewPlatformDesc',
    icon: 'gateway',
  },
  organizations: {
    id: 'organizations',
    to: admin('/team/members'),
    labelKey: 'users.title',
    descriptionKey: 'nav.membersDesc',
    icon: 'organizations',
  },
  departments: {
    id: 'departments',
    to: admin('/team/members'),
    labelKey: 'users.title',
    descriptionKey: 'nav.membersDesc',
    icon: 'organizations',
  },
  users: {
    id: 'users',
    to: admin('/team/members'),
    labelKey: 'users.title',
    descriptionKey: 'nav.membersDesc',
    icon: 'users',
  },
  positions: {
    id: 'positions',
    to: admin('/team/positions'),
    labelKey: 'org.nav.positions',
    descriptionKey: 'nav.positionsDesc',
    icon: 'tasks',
  },
  roles: {
    id: 'roles',
    to: admin('/team/roles'),
    labelKey: 'org.nav.roles',
    descriptionKey: 'nav.rolesDesc',
    icon: 'roles',
  },
  permissions: {
    id: 'permissions',
    to: admin('/team/roles'),
    labelKey: 'org.nav.roles',
    descriptionKey: 'nav.rolesDesc',
    icon: 'permissions',
  },
  workflows: {
    id: 'workflows',
    to: admin('/workflows'),
    labelKey: 'nav.workflows',
    descriptionKey: 'nav.workflowsDesc',
    icon: 'workflows',
  },
  tasks: {
    id: 'tasks',
    to: admin('/work-orders'),
    labelKey: 'nav.tasks',
    descriptionKey: 'nav.tasksDesc',
    icon: 'tasks',
  },
  functions: {
    id: 'functions',
    to: admin('/functions'),
    labelKey: 'nav.functions',
    descriptionKey: 'nav.functionsDesc',
    icon: 'functions',
  },
  agentRuntimes: {
    id: 'agentRuntimes',
    to: admin('/agents'),
    labelKey: 'nav.agentRuntimes',
    descriptionKey: 'nav.agentRuntimesDesc',
    icon: 'agents',
  },
  cells: {
    id: 'cells',
    to: admin('/cells'),
    labelKey: 'nav.cells',
    descriptionKey: 'nav.cellsDesc',
    icon: 'cells',
  },
  modelService: {
    id: 'modelService',
    to: admin('/inference'),
    labelKey: 'nav.modelService',
    descriptionKey: 'nav.modelServiceDesc',
    icon: 'modelService',
  },
  marketplace: {
    id: 'marketplace',
    to: admin('/marketplace'),
    labelKey: 'nav.marketplace',
    descriptionKey: 'nav.marketplaceDesc',
    icon: 'marketplace',
    end: true,
  },
  entitlements: {
    id: 'entitlements',
    to: admin('/marketplace/entitled'),
    labelKey: 'nav.entitlements',
    descriptionKey: 'nav.entitlementsDesc',
    icon: 'entitlements',
  },
  applications: {
    id: 'applications',
    to: admin('/applications'),
    labelKey: 'nav.applications',
    descriptionKey: 'nav.applicationsDesc',
    icon: 'applications',
  },
  applets: {
    id: 'applets',
    to: admin('/assets/applets'),
    labelKey: 'nav.applets',
    descriptionKey: 'nav.assetAppletsDesc',
    icon: 'applets',
  },
  apiServices: {
    id: 'apiServices',
    to: admin('/services'),
    labelKey: 'nav.apiServices',
    descriptionKey: 'nav.projectApiServicesDesc',
    icon: 'apiServices',
  },
  agents: {
    id: 'agents',
    to: admin('/assets/agents'),
    labelKey: 'nav.agents',
    descriptionKey: 'nav.assetAgentsDesc',
    icon: 'agents',
  },
  connectors: {
    id: 'connectors',
    to: admin('/assets/connectors'),
    labelKey: 'nav.connectors',
    descriptionKey: 'nav.assetConnectorsDesc',
    icon: 'connectors',
  },
  plugins: {
    id: 'plugins',
    to: admin('/assets/plugins'),
    labelKey: 'nav.plugins',
    descriptionKey: 'nav.assetPluginsDesc',
    icon: 'plugins',
  },
  skills: {
    id: 'skills',
    to: admin('/assets/skills'),
    labelKey: 'nav.skills',
    descriptionKey: 'nav.assetSkillsDesc',
    icon: 'skills',
  },
  tools: {
    id: 'tools',
    to: admin('/tools'),
    labelKey: 'nav.tools',
    descriptionKey: 'nav.projectToolsDesc',
    icon: 'tools',
  },
  knowledgeBases: {
    id: 'knowledgeBases',
    to: admin('/knowledge-bases'),
    labelKey: 'nav.knowledgeBases',
    descriptionKey: 'nav.projectKnowledgeBasesDesc',
    icon: 'knowledgeBases',
  },
  models: {
    id: 'models',
    to: admin('/assets/models'),
    labelKey: 'nav.models',
    descriptionKey: 'nav.modelsDesc',
    icon: 'models',
  },
  fleet: {
    id: 'fleet',
    to: admin('/fleet'),
    labelKey: 'nav.fleet',
    descriptionKey: 'nav.fleetDesc',
    icon: 'fleet',
  },
  gateway: {
    id: 'gateway',
    to: admin('/gateway'),
    labelKey: 'nav.gateway',
    descriptionKey: 'nav.gatewayDesc',
    icon: 'gateway',
  },
  topology: {
    id: 'topology',
    to: admin('/topology'),
    labelKey: 'nav.topology',
    descriptionKey: 'nav.topologyDesc',
    icon: 'topology',
  },
  events: {
    id: 'events',
    to: admin('/logs'),
    labelKey: 'nav.events',
    descriptionKey: 'nav.eventsDesc',
    icon: 'events',
  },
  automations: {
    id: 'automations',
    to: admin('/automations'),
    labelKey: 'nav.automations',
    descriptionKey: 'nav.automationsDesc',
    icon: 'fleet',
  },
  customers: {
    id: 'customers',
    to: admin('/customers'),
    labelKey: 'nav.customers',
    descriptionKey: 'nav.customersDesc',
    icon: 'customers',
  },
  channels: {
    id: 'channels',
    to: admin('/channels'),
    labelKey: 'nav.channels',
    descriptionKey: 'nav.channelsDesc',
    icon: 'channels',
  },
  suppliers: {
    id: 'suppliers',
    to: admin('/suppliers'),
    labelKey: 'nav.suppliers',
    descriptionKey: 'nav.suppliersDesc',
    icon: 'suppliers',
  },
  orders: {
    id: 'orders',
    to: admin('/orders'),
    labelKey: 'nav.orders',
    descriptionKey: 'nav.ordersDesc',
    icon: 'orders',
  },
  subscriptions: {
    id: 'subscriptions',
    to: admin('/subscriptions'),
    labelKey: 'nav.subscriptions',
    descriptionKey: 'nav.subscriptionsDesc',
    icon: 'subscriptions',
  },
  settingsSystem: {
    id: 'settingsSystem',
    to: admin('/settings/system'),
    labelKey: 'settings.system',
    descriptionKey: 'settings.system.desc',
    icon: 'settingsSystem',
  },
  settingsSms: { id: 'settingsSms', to: admin('/settings/sms'), labelKey: 'nav.settingsSms', descriptionKey: 'nav.settingsSmsDesc', icon: 'settingsSms' },
  settingsCaptcha: {
    id: 'settingsCaptcha',
    to: admin('/settings/captcha'),
    labelKey: 'nav.settingsCaptcha',
    descriptionKey: 'nav.settingsCaptchaDesc',
    icon: 'settings',
  },
  settingsLogin: {
    id: 'settingsLogin',
    to: admin('/settings/sign-in'),
    labelKey: 'nav.settingsLogin',
    descriptionKey: 'nav.settingsLoginDesc',
    icon: 'settingsLogin',
  },
  settingsApps: {
    id: 'settingsApps',
    to: admin('/settings/apps'),
    labelKey: 'settings.apps',
    descriptionKey: 'settings.apps.desc',
    icon: 'settingsApps',
  },
  settingsNotices: {
    id: 'settingsNotices',
    to: admin('/settings/notices'),
    labelKey: 'settings.notices',
    descriptionKey: 'settings.notices.desc',
    icon: 'settingsNotices',
  },
  settingsBootstrap: {
    id: 'settingsBootstrap',
    to: admin('/settings/bootstrap'),
    labelKey: 'settings.bootstrap',
    descriptionKey: 'settings.bootstrap.desc',
    icon: 'settingsBootstrap',
  },
  settingsEntries: {
    id: 'settingsEntries',
    to: admin('/settings/runtime'),
    labelKey: 'settings.entries',
    descriptionKey: 'settings.entries.desc',
    icon: 'settingsEntries',
  },
  settingsDebug: {
    id: 'settingsDebug',
    to: admin('/settings/debug'),
    labelKey: 'settings.debug',
    descriptionKey: 'settings.debug.desc',
    icon: 'settingsDebug',
  },
  settingsRegions: {
    id: 'settingsRegions',
    to: admin('/settings/regions'),
    labelKey: 'settings.regions',
    descriptionKey: 'settings.regions.desc',
    icon: 'settingsRegions',
  },
  settingsIndustries: {
    id: 'settingsIndustries',
    to: admin('/settings/industries'),
    labelKey: 'settings.industries',
    descriptionKey: 'settings.industries.desc',
    icon: 'settingsIndustries',
  },
  settingsChains: {
    id: 'settingsChains',
    to: admin('/settings/chains'),
    labelKey: 'settings.chains',
    descriptionKey: 'settings.chains.desc',
    icon: 'settingsChains',
  },
  settingsAdministration: {
    id: 'settingsAdministration',
    to: admin('/settings/administration'),
    labelKey: 'settings.administration',
    descriptionKey: 'settings.administration.desc',
    icon: 'settingsAdministration',
  },
  settingsParks: {
    id: 'settingsParks',
    to: admin('/settings/parks'),
    labelKey: 'settings.parks',
    descriptionKey: 'settings.parks.desc',
    icon: 'settingsParks',
  },
  settingsUniversities: {
    id: 'settingsUniversities',
    to: admin('/settings/universities'),
    labelKey: 'settings.universities',
    descriptionKey: 'settings.universities.desc',
    icon: 'settingsUniversities',
  },
  settingsTags: {
    id: 'settingsTags',
    to: admin('/settings/tags'),
    labelKey: 'settings.tags',
    descriptionKey: 'settings.tags.desc',
    icon: 'settingsTags',
  },
};

/**
 * Sidebar panels — see docs/console/SIDEBAR.md for item-by-item rulings.
 * Anti-bloat: no 1-link sections; details tabs stay in-page.
 *
 * ActivityBar domains: 运营 · 平台 · 系统
 */
export const OS_NAV_GROUPS: OsNavGroup[] = [
  {
    id: 'overview',
    labelKey: 'nav.group.overview',
    sections: [
      {
        labelKey: 'nav.section.dashboards',
        items: ['overview'],
      },
      {
        labelKey: 'nav.section.business',
        items: ['subscriptions', 'orders', 'tasks'],
      },
      {
        labelKey: 'nav.section.commercial',
        items: ['customers', 'channels', 'suppliers'],
      },
      {
        labelKey: 'nav.section.ai',
        items: ['models', 'agents', 'applets', 'connectors', 'skills', 'plugins'],
      },
    ],
  },
  {
    id: 'platform',
    labelKey: 'nav.group.platform',
    sections: [
      {
        labelKey: 'nav.section.dashboards',
        items: ['overviewPlatform'],
      },
      {
        labelKey: 'nav.section.definitions',
        items: ['workflows', 'functions', 'agentRuntimes', 'cells'],
      },
      {
        labelKey: 'nav.section.runtimePlane',
        items: ['gateway', 'fleet'],
      },
      {
        labelKey: 'nav.section.observability',
        items: ['topology', 'events'],
      },
    ],
  },
  {
    id: 'system',
    labelKey: 'nav.group.system',
    sections: [
      {
        labelKey: 'settings.group.general',
        items: ['settingsSystem', 'settingsApps'],
      },
      {
        labelKey: 'settings.group.team',
        items: ['users', 'positions', 'roles'],
      },
      {
        labelKey: 'settings.group.security',
        items: ['settingsLogin', 'settingsCaptcha', 'settingsSms'],
      },
      {
        labelKey: 'settings.group.config',
        items: ['settingsBootstrap', 'settingsEntries', 'settingsDebug'],
      },
      {
        labelKey: 'settings.group.taxonomy',
        items: ['settingsIndustries', 'settingsChains', 'settingsTags'],
      },
      {
        labelKey: 'settings.group.territory',
        items: ['settingsRegions', 'settingsAdministration', 'settingsParks', 'settingsUniversities'],
      },
    ],
  },
];

/** ActivityBar: one icon per domain (order = rail order) */
export const OS_ACTIVITY_DOMAINS: OsActivityDomain[] = [
  {
    id: 'overview',
    labelKey: 'nav.group.overview',
    icon: 'overview',
    defaultDestinationId: 'overview',
  },
  {
    id: 'platform',
    labelKey: 'nav.group.platform',
    icon: 'gateway',
    defaultDestinationId: 'overviewPlatform',
  },
  {
    id: 'system',
    labelKey: 'nav.group.system',
    icon: 'settings',
    defaultDestinationId: 'settingsSystem',
  },
];

export function destinationsInGroup(group: OsNavGroup): OsDestinationId[] {
  return group.sections.flatMap((section) => section.items);
}

const ORG_DIRECTORY_DESTINATIONS = new Set<OsDestinationId>(['users', 'positions', 'roles']);

/** 系统侧栏「团队与权限」。管的是可登录控制台的后台用户，不是用户中心的团队成员。 */
export function isOrgDirectoryDestination(id: OsDestinationId): boolean {
  return ORG_DIRECTORY_DESTINATIONS.has(id);
}

export function domainForDestination(id: OsDestinationId): OsDomainId {
  const group = OS_NAV_GROUPS.find((g) =>
    destinationsInGroup(g).includes(id),
  );
  return group?.id ?? 'overview';
}

export function groupForDomain(domainId: OsDomainId): OsNavGroup {
  return (
    OS_NAV_GROUPS.find((g) => g.id === domainId) ?? OS_NAV_GROUPS[0]!
  );
}

function normalizeShellPath(pathname: string): string {
  return stripAdminPrefix(pathname.replace(/\/+$/, '')) || '/';
}

const SHELL_LANDING_PATHS = new Set(
  Object.values(OS_DESTINATIONS).map((destination) =>
    stripAdminPrefix(destination.to),
  ),
);

/** Detail routes are not sidebar landings, so the shell drops its context header. */
export function isSecondaryShellPath(pathname: string): boolean {
  return !SHELL_LANDING_PATHS.has(normalizeShellPath(pathname));
}

export function matchDestination(pathname: string): OsDestination {
  const normalized = stripAdminPrefix(pathname.replace(/\/$/, '')) || '/';
  const legacyPrefix: Array<[string, OsDestinationId]> = [
    ['/tasks', 'tasks'],
    ['/agent-runtimes', 'agentRuntimes'],
    ['/events', 'events'],
    ['/notifications', 'events'],
    ['/overview/platform', 'overviewPlatform'],
    ['/enterprise/positions', 'positions'],
  ];
  for (const [prefix, id] of legacyPrefix) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return OS_DESTINATIONS[id];
    }
  }
  if (
    normalized === '/roles' ||
    normalized.startsWith('/roles/')
  ) {
    return OS_DESTINATIONS.roles;
  }
  if (
    normalized === '/team/members' ||
    normalized.startsWith('/team/members/') ||
    normalized === '/enterprise/members' ||
    normalized.startsWith('/enterprise/members/') ||
    normalized === '/departments' ||
    normalized.startsWith('/departments/') ||
    normalized === '/organizations' ||
    normalized.startsWith('/organizations/') ||
    normalized === '/users' ||
    normalized.startsWith('/users/') ||
    normalized === '/members' ||
    normalized.startsWith('/members/')
  ) {
    return OS_DESTINATIONS.users;
  }
  if (
    normalized === '/team/roles' ||
    normalized.startsWith('/team/roles/') ||
    normalized === '/enterprise/roles' ||
    normalized.startsWith('/enterprise/roles/') ||
    normalized === '/permissions' ||
    normalized.startsWith('/permissions/')
  ) {
    return OS_DESTINATIONS.roles;
  }
  if (
    normalized === '/marketplace/entitled' ||
    normalized.startsWith('/marketplace/entitled/')
  ) {
    return OS_DESTINATIONS.entitlements;
  }
  if (
    normalized === '/marketplace' ||
    normalized.startsWith('/marketplace/')
  ) {
    return OS_DESTINATIONS.marketplace;
  }
  if (
    normalized === '/inference' ||
    normalized.startsWith('/inference/') ||
    normalized === '/model-service' ||
    normalized.startsWith('/model-service/') ||
    normalized === '/market/models' ||
    normalized.startsWith('/market/models/')
  ) {
    return OS_DESTINATIONS.models;
  }
  if (normalized.startsWith('/workflows') || normalized.startsWith('/flows')) {
    return OS_DESTINATIONS.workflows;
  }
  if (
    normalized === '/agent-runtimes' ||
    normalized.startsWith('/agent-runtimes/')
  ) {
    return OS_DESTINATIONS.agentRuntimes;
  }
  if (
    normalized === '/overview/platform' ||
    normalized.startsWith('/overview/platform/')
  ) {
    return OS_DESTINATIONS.overviewPlatform;
  }
  if (normalized === '/settings' || normalized.startsWith('/settings/')) {
    const section = normalized === '/settings' ? 'system' : normalized.slice('/settings/'.length);
    const bySection: Record<string, OsDestinationId> = {
      system: 'settingsSystem',
      apps: 'settingsApps',
      notices: 'settingsNotices',
      sms: 'settingsSms',
      captcha: 'settingsCaptcha',
      'sign-in': 'settingsLogin',
      login: 'settingsLogin',
      regions: 'settingsRegions',
      industries: 'settingsIndustries',
      chains: 'settingsChains',
      administration: 'settingsAdministration',
      parks: 'settingsParks',
      universities: 'settingsUniversities',
      tags: 'settingsTags',
      bootstrap: 'settingsBootstrap',
      runtime: 'settingsEntries',
      entries: 'settingsEntries',
      debug: 'settingsDebug',
    };
    const id = bySection[section] ?? 'settingsSystem';
    return OS_DESTINATIONS[id];
  }
  const hit = Object.values(OS_DESTINATIONS).find((d) => {
    const to = stripAdminPrefix(d.to);
    if (d.end) return normalized === to;
    return normalized === to || normalized.startsWith(`${to}/`);
  });
  return hit ?? OS_DESTINATIONS.overview;
}
