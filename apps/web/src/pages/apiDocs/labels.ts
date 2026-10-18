import type { Locale } from '@/prefs/store';
import type { ApiOperation, HttpMethod } from '@/lib/openapi';

const GROUP_ZH: Record<string, string> = {
  Models: '模型',
  Tools: '工具 / API',
  Envelope: '响应信封',
  Errors: '错误码',
  models: '模型',
  tools: '工具 / API',
  chat: '对话',
  embeddings: '向量',
  v1: 'v1',
  Platform: '平台',
  Identity: '身份',
  Inference: '推理',
  Organizations: '组织',
  Projects: '项目',
  Fleet: '集群',
  Artifacts: '制品',
  Assets: '资产',
  Sources: '源',
  Files: '文件',
  Knowledge: '知识库',
  'Developer Workflows': '开发工作流',
  Secrets: '密钥',
  Edge: '边缘',
  Workloads: '工作负载',
  Agents: '智能体',
  Workflow: '流程',
  Forms: '表单',
  Connectors: '连接器',
  Automations: '自动化',
  Applications: '应用',
  'Durable Cells': '持久单元',
  Operations: '操作',
  Audit: '审计',
  Security: '安全',
  Notifications: '通知',
  Plugins: '插件',
  Search: '搜索',
  platform: '平台',
  git: '代码仓库',
  health: '健康检查',
  live: '存活探针',
};

const GROUP_EN: Record<string, string> = {
  Models: 'Models',
  Tools: 'Tools / APIs',
  Envelope: 'Response envelope',
  Errors: 'Errors',
  models: 'Models',
  tools: 'Tools / APIs',
  chat: 'Chat',
  embeddings: 'Embeddings',
  v1: 'v1',
  git: 'Repositories',
  health: 'Health',
  live: 'Liveness',
};

const SEGMENT_ZH: Record<string, string> = {
  orgs: '组织',
  departments: '部门',
  users: '用户',
  'admin-roles': '管理员角色',
  sessions: '会话',
  login: '登录',
  logout: '退出登录',
  me: '当前用户',
  'permission-catalog': '权限目录',
  register: '注册',
  bootstrap: '启动项',
  builtins: '内置项',
  status: '状态',
  hubs: '模型库',
  search: '搜索',
  repo: '仓库详情',
  imports: '导入任务',
  cancel: '取消',
  repos: '仓库',
  objects: '对象',
  refs: '引用',
  blobs: 'Blob',
  manifests: 'Manifest',
  providers: 'Provider',
  model: '模型详情',
  models: '模型',
  refresh: '刷新',
  notes: '笔记',
  stats: '统计',
  count: '数量',
  organizations: '组织',
  projects: '项目',
  environments: '环境',
  nodes: '节点',
  'node-pools': '节点池',
  'enrollment-tokens': '注册令牌',
  members: '成员',
  maintenance: '维护窗口',
  removal: '成员摘除',
  secrets: '密钥',
  workloads: '工作负载',
  executions: '执行',
  'execution-templates': '执行模板',
  assets: '资产',
  releases: '版本',
  'function-invocations': '函数调用',
  'function-profile': '函数配置',
  'api-tokens': 'API 令牌',
  memberships: '成员资格',
  'inference-usage': '推理用量',
  health: '健康检查',
  live: '存活探针',
  ready: '就绪探针',
  info: '平台信息',
  'model-service': '模型服务',
  configs: '配置',
  captcha: '验证码',
  pipelines: '流水线',
  inference: '推理',
  capabilities: '能力',
  drive: '云盘',
  im: '消息',
  skills: '技能',
  connectors: '连接器',
  partners: '合作伙伴',
  oem: '合作伙伴',
  'app-releases': '应用发布',
  usage: '用量',
  logs: '日志',
  git: '代码仓库',
  suppliers: '供应商',
  deployments: '部署',
  conversations: '会话',
  messages: '消息',
  files: '文件',
  notifications: '通知',
  roles: '角色',
  positions: '职位',
  subscriptions: '订阅',
  customers: '客户',
  probe: '探测',
  routes: '路由',
  settings: '设置',
  state: '状态',
  icon: '图标',
  bundle: '安装包',
  installed: '已安装',
  install: '安装',
  uninstall: '卸载',
  identity: '身份',
  cloud: '云',
  internal: '内部',
  metrics: '指标',
  hub: '文件库',
  file: '文件',
  publish: '发布',
  withdraw: '撤回',
  challenges: '挑战',
  tokens: '令牌',
  config: '配置',
  'agent-conversations': '智能体会话',
  'agent-runtimes': '智能体运行',
  'durable-cells': '持久单元',
  functions: '函数',
  gateway: '网关',
  'node-resource-inventories': '节点资源',
  'plugin-registries': '插件仓库',
  'use-packages': '使用包',
  workspace: '工作区',
  'directory-members': '目录成员',
  'directory-projections': '目录投影',
  'cloud-credential': '云凭证',
  deliver: '投递',
  invoke: '调用',
  products: '产品',
  admit: '准入',
  subjects: '主体',
  runners: '运行器',
  runs: '运行',
  workflows: '工作流',
  exports: '导出',
  'git-upload-pack': '上传包',
  grants: '授权',
  attachments: '附件',
  directory: '目录',
  stream: '流',
  'stream-ticket': '流票据',
  sync: '同步',
  'code-login': '验证码登录',
  invites: '邀请',
  join: '加入',
  activity: '动态',
  entitlements: '权益',
  'join-invite': '加入邀请',
  'join-requests': '加入申请',
  membership: '成员资格',
  subscription: '订阅',
  transfer: '转让',
  'transfer-candidates': '转让候选人',
  verification: '认证',
  verifications: '认证审核',
  password: '密码',
  'phone-codes': '短信验证码',
  'service-identities': '服务身份',
  'backfill-file-transfer': '文件传输回填',
  facets: '筛选项',
  tasks: '任务',
  package: '资源包',
  revisions: '修订',
  'skill-source': '技能源',
  detail: '详情',
  people: '人员',
  services: '服务',
  'cloud-principal': '云主体',
  position: '职位',
  brand: '品牌',
  'bound-org-ids': '已绑定组织',
  defaults: '默认配置',
  events: '事件',
  'workflow-files': '工作流文件',
  'registration-token': '注册令牌',
  jobs: '任务',
  commits: '提交',
  content: '内容',
  admin: '管理员',
  role: '角色',
  reviews: '审核',
  direct: '单聊',
  'file-transfer': '文件传输',
  groups: '群聊',
  download: '下载',
  import: '导入',
  remove: '移除',
  ensure: '确保',
  archive: '归档',
  freeze: '冻结',
  unfreeze: '解冻',
  leave: '退出',
  mute: '静音',
  pin: '置顶',
  read: '已读',
  unread: '未读',
  recall: '撤回',
  accept: '接受',
  approve: '通过',
  reject: '拒绝',
  move: '移动',
  rename: '重命名',
  delete: '删除',
  complete: '完成',
  preview: '预览',
  discover: '发现',
  decision: '决定',
  heartbeat: '心跳',
  dispatches: '调度',
  'delete-folder': '删除文件夹',
  'move-folder': '移动文件夹',
  'direct-conversations': '单聊',
  'group-conversations': '群聊',
  muted: '免打扰',
  pinned: '置顶',
  'read-cursor': '已读游标',
  'unread-cursor': '未读游标',
  'message-syncs': '消息同步',
  'stream-tickets': '流票据',
  'file-transfer-backfills': '文件传输回填',
  registrations: '会员',
  'code-sessions': '验证码会话',
  'read-state': '已读状态',
  approval: '通过',
  rejection: '拒绝',
  'discoverable-orgs': '可发现组织',
  'invite-codes': '邀请码',
  'join-codes': '加入码',
  'ownership-transfers': '所有权转移',
  frozen: '冻结',
  archived: '归档',
  probes: '探测',
  syncs: '同步',
  cancellations: '取消',
  retries: '重试',
  publication: '发布',
  installations: '安装',
  invocations: '调用',
  deliveries: '投递',
  'registration-tokens': '注册令牌',
  'runner-heartbeats': '运行器心跳',
  'job-claims': '任务认领',
  completions: '完成',
  'token-verifications': '令牌校验',
  'cloud-credentials': '云凭证',
};

const SEGMENT_EN: Record<string, string> = {
  orgs: 'organizations',
  departments: 'departments',
  users: 'users',
  'admin-roles': 'admin roles',
  sessions: 'sessions',
  login: 'login',
  logout: 'logout',
  me: 'current user',
  'permission-catalog': 'permission catalog',
  register: 'register',
  bootstrap: 'bootstrap',
  builtins: 'builtins',
  status: 'status',
  hubs: 'hubs',
  search: 'search',
  repo: 'repository',
  imports: 'imports',
  cancel: 'cancel',
  repos: 'repositories',
  objects: 'objects',
  refs: 'refs',
  blobs: 'blobs',
  manifests: 'manifests',
  providers: 'providers',
  model: 'model',
  models: 'models',
  refresh: 'refresh',
  notes: 'notes',
  stats: 'stats',
  count: 'count',
  'direct-conversations': 'direct conversations',
  'group-conversations': 'group conversations',
  muted: 'mute',
  pinned: 'pin',
  'read-cursor': 'read cursor',
  'unread-cursor': 'unread cursor',
  'message-syncs': 'message syncs',
  'stream-tickets': 'stream tickets',
  'file-transfer-backfills': 'file transfer backfills',
  registrations: 'members',
  'code-sessions': 'code sessions',
  'read-state': 'read state',
  approval: 'approval',
  rejection: 'rejection',
  'discoverable-orgs': 'discoverable organizations',
  'invite-codes': 'invite codes',
  'join-codes': 'join codes',
  'ownership-transfers': 'ownership transfers',
  frozen: 'freeze',
  archived: 'archive',
  probes: 'probes',
  syncs: 'syncs',
  cancellations: 'cancellations',
  retries: 'retries',
  publication: 'publication',
  installations: 'installations',
  invocations: 'invocations',
  deliveries: 'deliveries',
  'registration-tokens': 'registration tokens',
  'runner-heartbeats': 'runner heartbeats',
  'job-claims': 'job claims',
  completions: 'completions',
  'token-verifications': 'token verifications',
  'cloud-credentials': 'cloud credentials',
  cloud: 'cloud',
  gateway: 'gateway',
  routes: 'routes',
};

const ACTION_SEGMENTS = new Set([
  'login',
  'logout',
  'register',
  'me',
  'cancel',
  'refresh',
  'search',
  'bootstrap',
  'builtins',
  'status',
  'count',
  'ready',
  'drain',
  'revoke',
  'enroll',
  'retire',
  'retry',
  'rollback',
  'rotate',
  'yank',
  'tombstone',
  'expire',
  'scan',
  'verify',
  'resolve',
  'close',
  'start',
  'stop',
  'enable',
  'disable',
  'link',
  'fork',
  'replay',
  'export',
  'inspect',
  'claim',
  'deactivate',
  'download',
  'import',
  'remove',
  'ensure',
  'archive',
  'freeze',
  'unfreeze',
  'leave',
  'mute',
  'pin',
  'read',
  'unread',
  'recall',
  'accept',
  'approve',
  'reject',
  'move',
  'rename',
  'delete',
  'complete',
  'preview',
  'discover',
  'decision',
  'heartbeat',
  'dispatches',
  'delete-folder',
  'move-folder',
]);

const SKIP_SEGMENTS = new Set(['actions']);

/** A GET of one of these is a view of the parent resource, not a collection. */
const ASPECT_SEGMENTS = new Set(['content', 'detail', 'package', 'defaults']);

const ACTION_ZH: Record<string, (resource: string) => string> = {
  login: () => '登录会话',
  logout: () => '退出登录',
  register: () => '注册会员',
  me: () => '获取当前用户',
  cancel: (resource) => `取消${resource}`,
  refresh: (resource) => `刷新${resource}`,
  search: (resource) => `搜索${resource}`,
  bootstrap: () => '读取启动配置',
  builtins: () => '读取内置配置',
  status: (resource) => `获取${resource || '状态'}`,
  count: (resource) => `统计${resource}`,
  ready: (resource) => `将${resource}标为就绪`,
  drain: (resource) => `排空${resource}`,
  revoke: (resource) => `吊销${resource}`,
  enroll: (resource) => `注册${resource}`,
  retire: (resource) => `停用${resource}`,
  retry: (resource) => `重试${resource}`,
  rollback: (resource) => `回滚${resource}`,
  rotate: (resource) => `轮换${resource}`,
  yank: (resource) => `撤回${resource}`,
  tombstone: (resource) => `墓碑删除${resource}`,
  expire: (resource) => `使${resource}过期`,
  scan: (resource) => `扫描${resource}`,
  verify: (resource) => `校验${resource}`,
  resolve: (resource) => `解析${resource}`,
  close: (resource) => `关闭${resource}`,
  start: (resource) => `启动${resource}`,
  stop: (resource) => `停止${resource}`,
  enable: (resource) => `启用${resource}`,
  disable: (resource) => `停用${resource}`,
  link: (resource) => `关联${resource}`,
  fork: (resource) => `派生${resource}`,
  replay: (resource) => `重放${resource}`,
  export: (resource) => `导出${resource}`,
  inspect: (resource) => `检查${resource}`,
  claim: (resource) => `领取${resource}`,
  deactivate: (resource) => `停用${resource}`,
  download: (resource) => `下载${resource}`,
  import: (resource) => `导入${resource}`,
  remove: (resource) => `移除${resource}`,
  ensure: (resource) => `确保${resource}`,
  archive: (resource) => `归档${resource}`,
  freeze: (resource) => `冻结${resource}`,
  unfreeze: (resource) => `解冻${resource}`,
  leave: (resource) => `退出${resource}`,
  mute: (resource) => `静音${resource}`,
  pin: (resource) => `置顶${resource}`,
  read: () => '标为已读',
  unread: () => '标为未读',
  recall: (resource) => `撤回${resource}`,
  accept: (resource) => `接受${resource}`,
  approve: (resource) => `通过${resource}`,
  reject: (resource) => `拒绝${resource}`,
  move: (resource) => `移动${resource}`,
  rename: (resource) => `重命名${resource}`,
  delete: (resource) => `删除${resource}`,
  complete: (resource) => `完成${resource}`,
  preview: (resource) => `预览${resource}`,
  discover: (resource) => `发现${resource}`,
  decision: (resource) => `裁定${resource}`,
  heartbeat: () => '上报心跳',
  dispatches: (resource) => `调度${resource}`,
  'delete-folder': () => '删除文件夹',
  'move-folder': () => '移动文件夹',
};

const ACTION_EN: Record<string, (resource: string) => string> = {
  login: () => 'Sign in',
  logout: () => 'Sign out',
  register: () => 'Register member',
  me: () => 'Get current user',
  cancel: (resource) => `Cancel ${resource}`,
  refresh: (resource) => `Refresh ${resource}`,
  search: (resource) => `Search ${resource}`,
  bootstrap: () => 'List bootstrap configs',
  builtins: () => 'List builtin configs',
  status: (resource) => `Get ${resource || 'status'}`,
  count: (resource) => `Count ${resource}`,
  ready: (resource) => `Mark ${resource} ready`,
  drain: (resource) => `Drain ${resource}`,
  revoke: (resource) => `Revoke ${resource}`,
  enroll: (resource) => `Enroll ${resource}`,
  retire: (resource) => `Retire ${resource}`,
  retry: (resource) => `Retry ${resource}`,
  rollback: (resource) => `Roll back ${resource}`,
  rotate: (resource) => `Rotate ${resource}`,
  yank: (resource) => `Yank ${resource}`,
  tombstone: (resource) => `Tombstone ${resource}`,
  expire: (resource) => `Expire ${resource}`,
  scan: (resource) => `Scan ${resource}`,
  verify: (resource) => `Verify ${resource}`,
  resolve: (resource) => `Resolve ${resource}`,
  close: (resource) => `Close ${resource}`,
  start: (resource) => `Start ${resource}`,
  stop: (resource) => `Stop ${resource}`,
  enable: (resource) => `Enable ${resource}`,
  disable: (resource) => `Disable ${resource}`,
  link: (resource) => `Link ${resource}`,
  fork: (resource) => `Fork ${resource}`,
  replay: (resource) => `Replay ${resource}`,
  export: (resource) => `Export ${resource}`,
  inspect: (resource) => `Inspect ${resource}`,
  claim: (resource) => `Claim ${resource}`,
  deactivate: (resource) => `Deactivate ${resource}`,
  download: (resource) => `Download ${resource}`,
  import: (resource) => `Import ${resource}`,
  remove: (resource) => `Remove ${resource}`,
  ensure: (resource) => `Ensure ${resource}`,
  archive: (resource) => `Archive ${resource}`,
  freeze: (resource) => `Freeze ${resource}`,
  unfreeze: (resource) => `Unfreeze ${resource}`,
  leave: (resource) => `Leave ${resource}`,
  mute: (resource) => `Mute ${resource}`,
  pin: (resource) => `Pin ${resource}`,
  read: () => 'Mark as read',
  unread: () => 'Mark as unread',
  recall: (resource) => `Recall ${resource}`,
  accept: (resource) => `Accept ${resource}`,
  approve: (resource) => `Approve ${resource}`,
  reject: (resource) => `Reject ${resource}`,
  move: (resource) => `Move ${resource}`,
  rename: (resource) => `Rename ${resource}`,
  delete: (resource) => `Delete ${resource}`,
  complete: (resource) => `Complete ${resource}`,
  preview: (resource) => `Preview ${resource}`,
  discover: (resource) => `Discover ${resource}`,
  decision: (resource) => `Decide ${resource}`,
  heartbeat: () => 'Send heartbeat',
  dispatches: (resource) => `Dispatch ${resource}`,
  'delete-folder': () => 'Delete folder',
  'move-folder': () => 'Move folder',
};

function dict(locale: Locale) {
  return locale === 'zh'
    ? { group: GROUP_ZH, segment: SEGMENT_ZH }
    : { group: GROUP_EN, segment: SEGMENT_EN };
}

function pathSegments(path: string): string[] {
  return path
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .filter((s) => s !== 'api' && !s.startsWith('{'));
}

function lastResource(segments: string[]): string {
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (!ACTION_SEGMENTS.has(segments[i]) && !SKIP_SEGMENTS.has(segments[i])) {
      return segments[i];
    }
  }
  return segments[segments.length - 1] ?? 'resource';
}

function labelSegment(seg: string, locale: Locale): string {
  const map = dict(locale).segment;
  if (map[seg]) return map[seg];
  return seg.replace(/[-_]/g, ' ');
}

function isCollectionGet(method: HttpMethod, path: string): boolean {
  const segments = pathSegments(path);
  const last = segments[segments.length - 1] ?? '';
  return method === 'get' && !/\{[^}]+\}\s*$/.test(path) && !ACTION_SEGMENTS.has(last);
}

function isItemPath(path: string): boolean {
  return /\{[^}]+\}\s*$/.test(path);
}

/** OpenAPI copy is one language. Use it only when it matches the interface locale. */
export function textMatchesLocale(text: string, locale: Locale): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const hasCjk = /[\u3400-\u9fff]/.test(trimmed);
  return locale === 'zh' ? hasCjk : !hasCjk;
}

/** Prefer OpenAPI summary only when it is authored and written in the active locale. */
export function isAuthoredSummary(
  summary: string,
  method: string,
  path: string,
  locale?: Locale,
): boolean {
  const trimmed = summary.trim();
  if (!trimmed) return false;
  const auto = `${method.toUpperCase()} ${path}`;
  if (trimmed === auto || trimmed.startsWith(`${method.toUpperCase()} /`)) return false;
  if (locale && !textMatchesLocale(trimmed, locale)) return false;
  return true;
}

export function groupLabel(groupKey: string, locale: Locale): string {
  const plane = /^(admin|org)\/(.+)$/.exec(groupKey);
  if (plane) {
    const planeName =
      plane[1] === 'org'
        ? locale === 'zh'
          ? '成员'
          : 'Member'
        : locale === 'zh'
          ? '管理'
          : 'Admin';
    return `${planeName} · ${labelSegment(plane[2], locale)}`;
  }
  const map = dict(locale).group;
  if (map[groupKey]) return map[groupKey];
  return groupKey
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function operationTitle(
  op: Pick<ApiOperation, 'method' | 'path' | 'summary'>,
  locale: Locale,
): string {
  if (op.path === '/v1/api/admin') return locale === 'zh' ? '管理入口' : 'Admin root';

  if (isAuthoredSummary(op.summary, op.method, op.path, locale)) {
    return op.summary.trim();
  }

  const segments = pathSegments(op.path);
  const last = segments[segments.length - 1] ?? 'resource';
  const previous = segments[segments.length - 2];
  const resource = lastResource(segments);
  const resourceLabel = labelSegment(resource, locale);
  const actions = locale === 'zh' ? ACTION_ZH : ACTION_EN;
  const action =
    previous === 'actions' || (ACTION_SEGMENTS.has(last) && previous !== 'health')
      ? last
      : '';

  if (action && action !== resource && actions[action]) {
    return actions[action](resourceLabel);
  }

  if (locale === 'zh') {
    switch (op.method) {
      case 'get':
        if (ASPECT_SEGMENTS.has(last)) return `获取${resourceLabel}`;
        return isCollectionGet(op.method, op.path)
          ? `列出${resourceLabel}`
          : isItemPath(op.path)
            ? `获取${resourceLabel}`
            : `查询${resourceLabel}`;
      case 'post':
        if (last === 'verifications' && previous === 'challenges') return '校验挑战';
        if (last === 'token-verifications') return '校验令牌';
        if (resource === 'imports') return '发起导入';
        if (resource === 'sessions') return '创建会话';
        if (resource === 'users') return '邀请用户';
        return `创建${resourceLabel}`;
      case 'put':
      case 'patch':
        return `更新${resourceLabel}`;
      case 'delete':
        return `删除${resourceLabel}`;
      default:
        return `${op.method.toUpperCase()} ${resourceLabel}`;
    }
  }

  switch (op.method) {
    case 'get':
      if (ASPECT_SEGMENTS.has(last)) return `Get ${resourceLabel}`;
      return isCollectionGet(op.method, op.path)
        ? `List ${resourceLabel}`
        : isItemPath(op.path)
          ? `Get ${resourceLabel}`
          : `Query ${resourceLabel}`;
    case 'post':
      if (last === 'verifications' && previous === 'challenges') return 'Verify challenge';
      if (last === 'token-verifications') return 'Verify token';
      if (resource === 'imports') return 'Start import';
      if (resource === 'users') return 'Invite user';
      return `Create ${resourceLabel}`;
    case 'put':
    case 'patch':
      return `Update ${resourceLabel}`;
    case 'delete':
      return `Delete ${resourceLabel}`;
    default:
      return `${op.method.toUpperCase()} ${resourceLabel}`;
  }
}

export function matchesOperationQuery(
  op: ApiOperation,
  query: string,
  locale: Locale,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const title = operationTitle(op, locale).toLowerCase();
  const group = groupLabel(op.group, locale).toLowerCase();
  return (
    title.includes(q) ||
    group.includes(q) ||
    op.path.toLowerCase().includes(q) ||
    op.method.includes(q) ||
    op.id.toLowerCase().includes(q) ||
    op.summary.toLowerCase().includes(q)
  );
}
