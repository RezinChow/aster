import type { Messages } from './types';

export const zh: Messages = {
  meta: {
    homeTitle: 'Kense — Work 与 OS',
    pricingTitle: '定价 — Kense',
    blogTitle: '博客 — Kense',
    docsTitle: '文档 — Kense',
    cloudTitle: 'Kense OS — 耐久执行与控制面',
    loginTitle: '登录 — Kense',
    signupTitle: '注册 — Kense',
    description:
      'Kense Work 提供 local-first 工作入口；Kense OS 提供编排、记忆与治理能力。',
    cloudDescription:
      'Kense OS 提供耐久执行、强一致状态、可靠调用与可控发布。',
  },
  nav: {
    home: '首页',
    features: '功能',
    work: 'Work',
    cloud: 'OS',
    pricing: '定价',
    customers: '客户',
    docs: '文档',
    blog: '博客',
    login: '登录',
    demo: '预约演示',
    start: '免费开始',
  },
  lang: {
    zh: '中文',
    en: 'EN',
    switchTo: '切换语言',
  },
  a11y: {
    backToTop: '回到顶部',
  },
  hero: {
    title: '在本地完成工作，在组织中沉淀能力',
    subtitle:
      'Kense Work 在本地组合模型、文件与工具；Kense OS 负责流程编排、组织记忆与权限治理。',
    ctaPrimary: '免费开始',
    ctaSecondary: '预约演示',
    discover: '了解产品',
    workPreview: {
      newTask: '新建任务',
      projects: '项目',
      projectsEmpty: '暂无项目',
      tasks: '任务',
      tasksEmpty: '暂无任务',
      more: '更多',
      user: 'roylin',
      greeting: '文档专家，我帮你',
      selectProject: '选择项目',
      placeholder: '今天想完成什么？ @ 文件，/ 技能，# 插件…',
      modelStatus: '未连接模型',
      executeAuto: '执行 自动',
      workspaceWritable: '工作区可写',
      docs: [
        { name: 'Word', kind: 'word' },
        { name: 'Excel', kind: 'excel' },
        { name: 'PPT', kind: 'ppt' },
        { name: 'PDF', kind: 'pdf' },
        { name: 'Markdown', kind: 'md' },
      ],
    },
    workContacts: {
      user: 'roylin',
      search: '搜索',
      plugins: '插件',
      chats: [
        {
          id: 'docs',
          name: '文档专家',
          preview: '周五全员会的稿，需要你点个头',
          time: '7:34',
          unread: true,
        },
        {
          id: 'code',
          name: '代码专家',
          preview: '结账崩溃已复现，说明写进工单了',
          time: '昨天',
        },
        {
          id: 'science',
          name: '科研专家',
          preview: '实验组数据对上了，3 个问题已关',
          time: '11:18',
        },
        {
          id: 'finance',
          name: '金融专家',
          preview: '14 张发票已入账，还差周二那笔',
          time: '9:04',
        },
      ],
    },
  },
  logos: {
    label: '已有团队选择 Kense',
    names: [
      'Northwind',
      'Lumen',
      'Orbit',
      'Cascade',
      'Vertex',
      'Harbor',
      'Pulse',
      'Alloy',
    ],
  },
  work: {
    brand: 'Kense Work',
    title: 'Kense Work',
    description:
      'Local-first 工作入口。按任务组合人员、模型、数据与工具，并在宿主策略与最小权限下执行。',
    items: [
      {
        title: '理解上下文',
        description: '从目标、约束与本地文件中识别真正要解决的问题。',
      },
      {
        title: '按需组合',
        description: '为当前任务选择模型、工具与数据，形成可追溯的工作会话。',
      },
      {
        title: '边界内验证',
        description: '在明确授权与隔离执行下完成试错，结果可回写评估。',
      },
    ],
    quote: {
      text: '真实数据与 Agent 可以在同一工作环境中协作，同时保持清晰边界。',
      author: '林澈',
      role: '产品负责人 · Cascade',
    },
    bot: {
      aria: '数字员工：文档、编码、科研、金融',
      eyebrow: '数字员工',
      title: '数字员工',
      caption: '面向不同工作场景的专家角色。',
      squad: [
        { id: 'docs', name: 'DOCS EXPERT', role: '撰写 · 排版 · 知识' },
        { id: 'code', name: 'CODE EXPERT', role: '应用 · 交付' },
        { id: 'science', name: 'SCIENCE EXPERT', role: '实验 · 分析' },
        { id: 'finance', name: 'FINANCE EXPERT', role: '风控 · 报告' },
      ],
    },
  },
  cloud: {
    title: 'Kense OS',
    description:
      '控制面编排意图与策略；Operations / Flow 耐久协调；Workload 经 Fleet、Runtime、Box 收敛到节点。',
    items: [
      {
        title: '统一 Gateway',
        description: 'Agent、Workflow、Function、Inference 共用一个受治理的公网入口。',
      },
      {
        title: 'Operations · Flow',
        description: '期望状态与日记账分离：中断后按序重放，已完成步骤不再执行。',
      },
      {
        title: 'Runtime · Box',
        description: '隔离执行与节点供给下沉；Power 以普通 Service 承接推理。',
      },
    ],
    quote: {
      text: '模型可以替换，团队沉淀的判断仍然可用。',
      author: '陈予安',
      role: '平台工程 · Orbit',
    },
  },
  integrations: {
    title: '稳定接入，可替换 Provider',
    description: '通过统一接口连接模型与工具；更换 Provider 无需重建整条链路。',
    apps: [
      'Slack',
      'Discord',
      'GitHub',
      'Notion',
      'Linear',
      'Figma',
      'Stripe',
      'Salesforce',
      'Zapier',
      'Email',
    ],
  },
  security: {
    title: '权限、隔离与审计',
    description: '每次操作具备边界、授权与记录。敏感数据可保留在本地。',
    items: [
      {
        title: '组织级策略',
        description: '模型、工具与数据的使用范围由组织统一配置。',
      },
      {
        title: '沙箱执行',
        description: '代码与网络访问在隔离环境中运行，降低生产风险。',
      },
      {
        title: '可审计证据',
        description: '运行、评估与异常均有记录；发布与回滚设有明确门槛。',
      },
    ],
    quote: {
      text: '边界、责任与日志足够清晰，才适合进入生产环境。',
      author: '周宁',
      role: '安全负责人 · Harbor',
    },
  },
  devices: {
    title: '从单机起步，按需扩展',
    description: '先在本地完成工作，再按需要接入记忆、流程与团队治理。',
    items: [
      {
        title: 'Local-first',
        description: '数据与权限默认留在本地边界，能力按需求逐步接入。',
      },
      {
        title: '可替换 Provider',
        description: '按成本、性能与合规要求选择模型及运行环境。',
      },
      {
        title: '端云一致契约',
        description: 'Work 与 OS 之间的会话与状态保持对齐。',
      },
    ],
    quote: {
      text: '从个人 CLI 起步，三周后同一套能力已在三个团队投入使用。',
      author: '赵晴',
      role: '工程经理 · Vertex',
    },
  },
  teams: {
    title: '个人贡献，团队复用',
    description: '经验连同上下文被记录，经评审后沉淀为技能、知识或流程。',
    items: [
      {
        title: '可交接的经验',
        description: '关键判断完整记录，便于后续承接、修订与复用。',
      },
      {
        title: '跨团队复用',
        description: '一次沉淀可供多个应用与 Agent 组合调用。',
      },
      {
        title: '可交接的运营',
        description: '队列、恢复与审计作为默认能力，减少人工值守。',
      },
    ],
    quote: {
      text: '我们需要的是可增长、可治理、可传承的团队能力资产。',
      author: '苏白',
      role: 'COO · Alloy',
    },
  },
  scale: {
    title: '面向生产规模设计',
    description: '从个人会话到组织控制面，运行、记忆、编排与治理遵循统一契约。',
    stats: [
      { value: '30m+', label: '已执行会话与工作流' },
      { value: '186+', label: '覆盖国家与地区' },
      { value: '1,500+', label: '使用中的团队' },
      { value: '>99.9%', label: '控制面可用性' },
    ],
  },
  compliance: {
    title: '合规能力内建',
    description: '策略、隔离与审计能力开箱可用。',
    cta: '联系销售',
    badges: ['GDPR', 'CCPA', 'SOC 2'],
  },
  cta: {
    title: '从一次实际工作开始',
    description: '可免费开通，也可预约产品演示。',
    primary: '免费开始',
    secondary: '预约演示',
  },
  footer: {
    product: '产品',
    company: '公司',
    resources: '资源',
    legal: '法律',
    tagline: '为Agent时代构建的AI Native操作系统',
    links: {
      orgCenter:'用户中心',
      adminConsole: '管理后台',
      apiDocs: 'API 文档',
      work: 'Kense Work',
      cloud: 'Kense OS',
      pricing: '定价',
      blog: '博客',
      docs: '文档',
      about: '关于',
      careers: '招聘',
      privacy: '隐私',
      terms: '条款',
      openSource: '开源',
    },
    copyright: '© Kense Labs. All rights reserved.',
  },
  site: {
    tocLabel: '本页目录',
    about: {
      documentTitle: '关于 — Kense',
      kicker: '公司',
      title: '为 Agent 时代构建 AI Native 操作系统',
      lead:
        'Kense Labs 打造 Kense Work 与 Kense OS：让团队在本地完成工作，在组织中沉淀可复用的能力与治理。',
      missionTitle: '我们在做什么',
      missionBody:
        '智能体与工作流正在成为软件的新运行单元。Kense 提供 local-first 的工作入口，以及可恢复、可审计、可治理的系统侧编排与记忆能力，帮助组织把一次性会话沉淀成可运营的能力。',
      pillars: [
        {
          title: 'Local-first 工作',
          body: '模型、文件与工具先在本地组合，敏感上下文默认留在边界内。',
        },
        {
          title: '耐久编排',
          body: '流程可恢复、可重放，跨会话与跨角色保持一致状态。',
        },
        {
          title: '组织记忆与权限',
          body: '能力、策略与审计同层设计，便于在真实组织中落地。',
        },
      ],
      ctaTitle: '一起把工作做成系统',
      ctaBody: '免费试用，或预约演示了解适合你团队的落地路径。',
      ctaPrimary: '免费开始',
      ctaSecondary: '预约演示',
    },
    careers: {
      documentTitle: '招聘 — Kense',
      kicker: '招聘',
      title: '和我们一起做 AI Native 基础设施',
      lead:
        '我们需要关心产品细节、系统正确性与用户真实工作流的人。远程友好，默认异步协作。',
      culture: [
        {
          title: '写清楚再说',
          body: '设计文档、RFC 与可运行原型优先于冗长会议。',
        },
        {
          title: '以真实任务为证',
          body: '功能以能否完成一次完整工作来验收，而不是演示幻灯片。',
        },
        {
          title: '小团队、高杠杆',
          body: '每个人都能直接影响产品方向与工程质量。',
        },
      ],
      openingsTitle: '开放职位',
      openingsEmpty: '当前没有公开职位。欢迎把简历与你做过的相关项目发给我们。',
      openings: [
        {
          title: '全栈工程师',
          location: '远程 / 上海',
          type: '全职',
          summary: '负责 Work 与 OS 控制面的产品界面、API 与可靠性体验。',
        },
        {
          title: '分布式系统工程师',
          location: '远程 / 上海',
          type: '全职',
          summary: '设计耐久执行、状态一致性、可恢复工作流与可观测性。',
        },
      ],
      howTitle: '如何申请',
      howSteps: [
        '准备一份简短介绍：你做过什么、为什么对 Kense 感兴趣。',
        '附上简历或 GitHub / 作品链接。',
        '通过「预约演示」联系我们，主题请注明「招聘 + 职位」。',
      ],
      applyCta: '联系招聘',
    },
    privacy: {
      documentTitle: '隐私政策 — Kense',
      kicker: '法律',
      title: '隐私政策',
      updated: '最近更新：2026 年 9 月 16 日',
      lead:
        '本政策说明 Kense Labs（「我们」）如何收集、使用与保护你在使用 Kense 网站与产品时提供的信息。使用我们的服务即表示你理解本政策。',
      sections: [
        {
          id: 'who',
          title: '1. 我们是谁',
          paragraphs: [
            'Kense Labs 提供 Kense Work、Kense OS 及相关网站、文档与演示服务。如对本政策有疑问，请通过网站「预约演示」与我们联系，并注明「隐私咨询」。',
          ],
        },
        {
          id: 'collect',
          title: '2. 我们收集哪些信息',
          paragraphs: [
            '我们仅收集为提供与改进服务所必需的信息，可能包括：',
          ],
          bullets: [
            '账户信息：姓名、工作邮箱、组织名称等你主动提供的内容。',
            '使用信息：产品功能使用情况、设备与浏览器类型、大致地区、诊断日志。',
            '沟通信息：你在演示预约、支持请求或邮件中提供的内容。',
            'Cookie 与类似技术：用于登录态、偏好（如语言）与基础分析。',
          ],
        },
        {
          id: 'use',
          title: '3. 我们如何使用信息',
          paragraphs: ['我们使用上述信息用于：'],
          bullets: [
            '提供、维护与改进产品与网站。',
            '处理账户、安全认证与客户支持。',
            '发送与服务相关的通知（如安全或重大变更）；营销沟通仅在你同意或法律允许时进行。',
            '防止滥用、排查故障并满足合规义务。',
          ],
        },
        {
          id: 'share',
          title: '4. 我们如何共享信息',
          paragraphs: [
            '我们不会出售你的个人信息。仅在以下情形共享：',
          ],
          bullets: [
            '服务提供商：在合同约束下为我们提供托管、邮件、分析等必要处理。',
            '法律要求：在法律、监管或有效法律程序要求时。',
            '业务变更：合并、收购或资产转让时，按适用法律通知或征得同意。',
          ],
        },
        {
          id: 'retention',
          title: '5. 保存与安全',
          paragraphs: [
            '我们在实现本政策所述目的所需的期限内保留信息，并在之后删除或匿名化，除非法律要求更长保存期。',
            '我们采取合理的技术与组织措施保护数据，但任何互联网传输或存储都无法保证绝对安全。',
          ],
        },
        {
          id: 'rights',
          title: '6. 你的权利',
          paragraphs: [
            '视你所在地区适用法律，你可能有权访问、更正、删除、限制处理或导出你的个人信息，并有权撤回同意（不影响撤回前基于同意的处理）。',
            '如需行使上述权利，请通过「预约演示」联系我们并注明「隐私权利」。我们将在合理期限内回复。',
          ],
        },
        {
          id: 'cookies',
          title: '7. Cookie',
          paragraphs: [
            '我们使用必要 Cookie 以维持会话与语言偏好，并可能使用分析 Cookie 了解站点使用情况。你可在浏览器中管理 Cookie；禁用部分 Cookie 可能影响功能。',
          ],
        },
        {
          id: 'intl',
          title: '8. 国际传输',
          paragraphs: [
            '我们的基础设施与服务提供商可能位于你所在国家/地区之外。在发生跨境传输时，我们将采取适当保障措施以符合适用法律。',
          ],
        },
        {
          id: 'children',
          title: '9. 儿童',
          paragraphs: [
            '我们的服务面向组织与专业用户，不面向 16 岁以下儿童。若发现误收集儿童信息，我们将尽快删除。',
          ],
        },
        {
          id: 'changes',
          title: '10. 政策更新',
          paragraphs: [
            '我们可能不时更新本政策。重大变更将在本页更新「最近更新」日期，并在适当时通过产品或邮件提示。继续使用服务即表示接受更新后的政策。',
          ],
        },
      ],
    },
    terms: {
      documentTitle: '服务条款 — Kense',
      kicker: '法律',
      title: '服务条款',
      updated: '最近更新：2026 年 9 月 16 日',
      lead:
        '本条款约束你访问与使用 Kense Labs 网站、产品与相关服务（统称「服务」）。使用服务即表示你同意本条款。若不同意，请勿使用。',
      sections: [
        {
          id: 'accept',
          title: '1. 接受条款',
          paragraphs: [
            '你确认有权代表自己或你的组织接受本条款。若代表组织使用服务，则你声明有权使该组织受本条款约束。',
          ],
        },
        {
          id: 'account',
          title: '2. 账户与准入',
          paragraphs: [
            '你须提供准确信息并妥善保管凭据。你对账户下的活动负责。我们可在合理怀疑滥用、安全风险或违反本条款时暂停或终止访问。',
          ],
        },
        {
          id: 'license',
          title: '3. 许可与知识产权',
          paragraphs: [
            '在遵守本条款的前提下，我们授予你有限的、非独占、不可转让、可撤销的许可，以按文档使用服务。',
            '服务及相关软件、品牌、文档的知识产权归 Kense Labs 或其许可方所有。本条款不转让所有权。',
            '你保留你提交到服务中的内容的权利；你授予我们为提供服务所必需的处理许可。',
          ],
        },
        {
          id: 'acceptable',
          title: '4. 可接受使用',
          paragraphs: ['你不得：'],
          bullets: [
            '违反适用法律或侵犯他人权利。',
            '试图未经授权访问系统、数据或他人账户。',
            '干扰服务完整性、可用性或安全（包括滥用自动化或绕过限制）。',
            '上传恶意软件，或将服务用于诈骗、骚扰或明显有害用途。',
          ],
        },
        {
          id: 'beta',
          title: '5. 预览与变更',
          paragraphs: [
            '部分功能可能以预览、测试或免费额度提供，可能随时变更、限制或撤回。我们可能更新服务；若变更对你有重大不利影响，我们将在合理范围内提前告知。',
          ],
        },
        {
          id: 'fees',
          title: '6. 费用',
          paragraphs: [
            '付费方案的价格、计费周期与包含内容以订购时展示或订单约定为准。除非另有书面约定，已支付费用通常不可退还。拖欠款项可能导致服务中止。',
          ],
        },
        {
          id: 'disclaimer',
          title: '7. 免责声明',
          paragraphs: [
            '在法律允许的最大范围内，服务按「现状」和「可用」提供，不提供适销性、特定用途适用性或不侵权等明示或默示保证。我们不保证服务不中断、无错误或完全满足你的特定需求。',
          ],
        },
        {
          id: 'liability',
          title: '8. 责任限制',
          paragraphs: [
            '在法律允许的最大范围内，Kense Labs 及其关联方不对间接、附带、特殊、后果性或惩罚性损害承担责任，也不对利润、收入、数据或商誉损失承担责任。',
            '我们对与本条款或服务相关的累计责任，不超过你在索赔前十二个月内就相关服务向我们支付的金额；若为免费使用，则以适用法律允许的最低金额为限。',
          ],
        },
        {
          id: 'termination',
          title: '9. 终止',
          paragraphs: [
            '你可随时停止使用服务并关闭账户。我们可因违反本条款或服务下线等原因终止或暂停服务。终止后，本条款中依其性质应继续有效的条款仍然有效。',
          ],
        },
        {
          id: 'law',
          title: '10. 适用法律',
          paragraphs: [
            '在不与强制性消费者保护法冲突的前提下，本条款适用中华人民共和国法律（不含冲突法规则）。争议应首先友好协商；协商不成的，由 Kense Labs 所在地有管辖权的法院解决，法律另有强制规定的除外。',
          ],
        },
        {
          id: 'contact',
          title: '11. 联系我们',
          paragraphs: [
            '有关本条款的问题，请通过网站「预约演示」联系我们，并注明「服务条款」。',
          ],
        },
      ],
    },
  },
  pricing: {
    title: '随团队规模扩展的方案',
    description: '免费开始，无需信用卡。按席位扩展，无隐藏费用。',
    billingMonthly: '按月',
    billingAnnual: '按年',
    billedMonthly: '按月计费',
    billedAnnual: '按年计费',
    saveBadge: '省约 20%',
    includedLabel: '包含',
    plans: [
      {
        name: 'Free',
        priceMonthly: '¥0',
        priceAnnual: '¥0',
        period: '',
        audience: '适合个人试用',
        description: '在实际项目中完成首次本地工作会话。',
        features: [
          '1 个 Work 席位',
          '本地上下文与权限边界',
          '基础会话与任务',
          '社区支持',
        ],
        includes: ['Work 基础'],
        cta: '免费开始',
      },
      {
        name: 'Builder',
        priceMonthly: '¥249',
        priceAnnual: '¥199',
        period: '/席位/月',
        meter: 'OS 按用量计费',
        audience: '适合早期团队与独立开发者',
        description: '将高频工作沉淀为可复用能力，并接入 OS。',
        features: [
          '完整 Kense Work',
          '记忆写入与检索',
          '耐久工作流基础',
          'API / Webhooks',
          '邮件支持',
        ],
        includes: ['Work', 'OS 起步'],
        cta: '免费开始',
      },
      {
        name: 'Team',
        priceMonthly: '¥499',
        priceAnnual: '¥399',
        period: '/席位/月',
        meter: 'OS 按用量计费',
        audience: '适合多团队协作',
        description: '支持能力共享、策略发布与流程自动化。',
        features: [
          '团队共享与版本',
          '策略与发布治理',
          '工作流自动化',
          '优先支持',
          '20 个协作者席位',
        ],
        includes: ['Work', 'OS', '治理'],
        cta: '开始试用',
        highlighted: true,
      },
      {
        name: 'Enterprise',
        priceMonthly: '定制',
        priceAnnual: '定制',
        period: '',
        audience: '适合大型组织与受监管环境',
        description: '支持自托管控制面、身份集成与合规要求。',
        features: [
          '专属 / 自托管',
          'SSO / SCIM',
          '自定义管理员角色',
          'SLA 与专属支持',
          '50 个协作者席位',
        ],
        includes: ['控制面', '合规'],
        cta: '预约演示',
        custom: true,
      },
    ],
    program: {
      eyebrow: 'Startup Program',
      title: '早期团队优惠计划',
      description: '成立未满 2 年且少于 6 人的团队，可申请 Team 能力与额外 OS 额度。',
      bullets: [
        '成立未满 2 年',
        '团队少于 6 人',
        '解锁 Team 核心能力',
      ],
      cta: '申请加入',
      secondary: '了解详情',
    },
    compare: {
      title: '功能与方案对比',
      description: 'Work 与 OS 在同一订阅中按阶段扩展。',
      categories: [
        {
          name: 'Work',
          rows: [
            {
              feature: '席位',
              values: ['1', '按需', '按需', '按需'],
            },
            {
              feature: '本地会话',
              values: ['✓', '✓', '✓', '✓'],
            },
            {
              feature: '权限与沙箱',
              values: ['基础', '✓', '✓', '高级'],
            },
            {
              feature: '工具组合',
              values: ['基础', '✓', '✓', '✓'],
            },
          ],
        },
        {
          name: 'OS',
          rows: [
            {
              feature: '记忆与检索',
              values: ['—', '✓', '✓', '✓'],
            },
            {
              feature: '耐久工作流',
              values: ['—', '基础', '✓', '✓'],
            },
            {
              feature: '版本与复用',
              values: ['—', '个人', '团队', '组织'],
            },
            {
              feature: '发布与治理',
              values: ['—', '—', '✓', '✓'],
            },
          ],
        },
        {
          name: '安全与支持',
          rows: [
            {
              feature: 'SSO / SCIM',
              values: ['—', '—', '—', '✓'],
            },
            {
              feature: '自托管 / 专属部署',
              values: ['—', '—', '—', '✓'],
            },
            {
              feature: 'SLA',
              values: ['—', '—', '优先', '定制'],
            },
            {
              feature: '支持',
              values: ['社区', '邮件', '优先', '专属'],
            },
          ],
        },
      ],
    },
    faq: {
      title: '常见问题',
      subtitle: '如需进一步沟通，欢迎预约演示。',
      items: [
        {
          q: 'Work 与 OS 是否需要分别购买？',
          a: '不需要。同一订阅按阶段解锁：Free 从 Work 起步，Builder 起接入 OS，Team / Enterprise 覆盖治理与控制面。',
        },
        {
          q: '什么算付费席位？',
          a: '需要使用 Work，或管理 OS 流程与策略的成员。只读协作者使用方案内含席位。',
        },
        {
          q: 'OS 用量如何计费？',
          a: 'Builder / Team 对耐久编排按用量计费，可在控制台查看明细。Enterprise 可协商打包额度或自托管。',
        },
        {
          q: '是否提供试用？',
          a: '提供。免费开始无需信用卡；付费方案含试用期。',
        },
        {
          q: '是否支持自托管？',
          a: 'Enterprise 支持专属或自托管控制面，以及 SSO / SCIM、审计与定制 SLA。',
        },
        {
          q: '早期团队是否有折扣？',
          a: '有。符合条件的团队可申请 Startup Program。',
        },
      ],
    },
    bottomCta: {
      title: '从一次完整任务开始',
      description: '先在本地完成，需要时再接入 OS。',
      primary: '免费开始',
      secondary: '预约演示',
    },
  },
  blog: {
    title: '博客',
    description: '产品与工程实践：运行时、工作方式，以及如何把个人会话变成组织能力。',
    minuteRead: '分钟阅读',
    readArticle: '阅读全文',
    related: '相关文章',
    notFound: {
      title: '未找到文章',
      description: '链接可能已变更。请从博客列表继续。',
      back: '返回博客',
    },
  },
  docs: {
    title: '文档',
    description: '从心智模型到第一次任务：Work 负责本地完成工作，OS 负责编排、记忆与治理。',
    startCta: '从简介开始',
    contents: '目录',
    onThisPage: '本页目录',
    updated: '更新于',
    prev: '上一篇',
    next: '下一篇',
    productSwitch: {
      label: '产品文档',
    },
    products: {
      overview: { name: '概览', blurb: '心智模型与快速开始' },
      work: { name: 'Kense Work', blurb: '本地优先工作站' },
      os: { name: 'Kense OS', blurb: '控制面与耐久运行时' },
      platform: { name: '平台', blurb: '安全、部署与方案' },
    },
    sections: {
      start: '开始使用',
      work: 'Kense Work',
      os: 'Kense OS',
      platform: '平台',
    },
    notFound: {
      title: '未找到文档',
      description: '该页不存在或已移动。请从文档首页进入。',
      back: '返回文档',
    },
  },
  auth: {
    backHome: '返回首页',
    eyebrow: '账户',
    oauthGroup: '第三方登录',
    orEmail: '或使用邮箱',
    orSocial: '或使用以下方式继续',
    connecting: '连接中…',
    oauthSoon: '第三方授权即将接入。当前为界面预览。',
    emailSoon: '邮箱登录即将接入。当前为界面预览。',
    loginSuccess: '已登录',
    signupSuccess: '已创建账户',
    forgot: '忘记密码？',
    showPassword: '显示',
    hidePassword: '隐藏',
    agreePrefix: '我已阅读并同意',
    agreeAnd: '与',
    providers: {
      github: '使用 GitHub 继续',
      wechat: '使用微信继续',
    },
    fields: {
      name: '姓名',
      namePlaceholder: '你的名字',
      email: '工作邮箱',
      emailPlaceholder: 'you@company.com',
      phone: '手机号',
      phonePlaceholder: '11 位手机号',
      code: '短信验证码',
      codePlaceholder: '6 位验证码',
      codeSend: '发送验证码',
      codeResendIn: '{s} 秒后重发',
      identifier: '手机号 / 邮箱',
      identifierPlaceholder: '11 位手机号或邮箱',
      password: '密码',
      passwordPlaceholder: '至少 8 位',
    },
    aside: {
      title: '使用 Kense 组建你的AI Native 团队',
    },
    login: {
      documentTitle: '登录 — Kense',
      title: '登录 Kense',
      subtitle: '使用你已有的开发者身份，或工作邮箱继续。',
      submit: '登录',
      switchPrompt: '还没有账户？',
      switchAction: '免费注册',
    },
    signup: {
      documentTitle: '注册 — Kense',
      title: '创建 Kense 账户',
      subtitle: '几分钟开通，从一次真实任务开始。',
      submit: '创建账户',
      switchPrompt: '已有账户？',
      switchAction: '直接登录',
    },
  },
  demoModal: {
    title: '预约产品演示',
    subtitle: '留下称呼与邮箱，我们会尽快与你联系。',
    name: '称呼',
    namePlaceholder: '怎么称呼你',
    email: '邮箱',
    emailPlaceholder: 'you@company.com',
    submit: '提交预约',
    submitting: '提交中…',
    close: '关闭',
    successTitle: '已收到你的预约',
    successBody: '感谢关注 Kense。平台团队将尽快联系你，请留意邮箱。',
    successDone: '好的',
  },
  cloudPage: {
    brand: 'Kense OS',
    title: '控制面编排，节点执行',
    subtitle:
      'WaaS / FaaS / Durable Cell 共用一套控制面；Gateway 是唯一公网入口。',
    ctaPrimary: '免费开始',
    ctaSecondary: '查看架构',
    marquee: [
      'Unified Gateway',
      'Operations · Flow',
      'Workloads · Fleet',
      'Runtime · Box',
      'Inference · Power',
      'WaaS',
      'FaaS',
      'Durable Cell',
      'Identity · Grants',
    ],
    console: {
      search: '搜索 Run、Claim、Route、Unit…',
      navLabel: '控制面',
      nav: ['Gateway', 'Operations', 'Workloads', 'Fleet', 'Inference'],
      status: 'edge snapshot · complete',
      title: 'agent-onboard · wr_7c21',
      meta: 'WaaS · recovering · Flow seq 14',
      path: ['Gateway', 'Identity', 'Operations · Flow', 'Workloads', 'Box'],
      stages: [
        { id: 'ht_04', name: 'HumanTask · approve', state: 'completed' },
        { id: 'svc_12', name: 'Agent Service · warm', state: 'running' },
        { id: 'inf_03', name: 'Inference route', state: 'pending' },
      ],
      journalLabel: 'Operations · Flow journal',
      journal: [
        { step: 'desired state applied', detail: 'revision pin · digest ok' },
        { step: 'outbox → Flow append', detail: 'expected-seq 14 · receipt' },
        { step: 'HumanTask claimed', detail: 'FormReleaseRef · granted' },
        { step: 'Workload claim fenced', detail: 'Fleet · node-a3 · Box' },
      ],
      asideTitle: '栈健康',
      plane: [
        { label: 'Gateway routes', value: '4 applied' },
        { label: 'Fleet claims', value: '3 / 3 fenced' },
        { label: 'Box isolation', value: 'MicroVM' },
        { label: 'Inference', value: '2 healthy' },
      ],
    },
    durable: {
      eyebrow: 'Durable Execution',
      title: '每一步入账，崩溃从断点继续',
      description:
        '调用、副作用、定时器与结果写入 journal。发生中断后执行重放：已完成步骤跳过，未完成步骤继续。',
      steps: [
        {
          title: '调用进入',
          description: '一次 invocation 跟踪到完成，exactly-once。',
        },
        {
          title: '步骤入账',
          description: 'side-effect、RPC、sleep、状态写入都记下来。',
        },
        {
          title: '失败恢复',
          description: '重试跳过已完成步骤，避免重复副作用。',
        },
        {
          title: '可回放',
          description: '执行轨迹可查，方便排障。',
        },
      ],
      covers: [
        {
          title: '基础设施故障',
          description: '节点重启后，进行中的执行在新实例续跑。',
        },
        {
          title: 'API 超时',
          description: '指数退避重试，策略可按服务调。',
        },
        {
          title: '重复请求',
          description: '幂等键去重，重复请求返回同一结果。',
        },
        {
          title: '网络分区',
          description: '无法写回 journal 时停止执行，由控制面在其他实例重试。',
        },
      ],
      flow: {
        label: 'Durable path',
        stages: [
          { title: 'Invoke', detail: '请求进入' },
          { title: 'Journal', detail: '步骤入账' },
          { title: 'Recover', detail: '断点续跑' },
          { title: 'Complete', detail: 'exactly-once' },
        ],
      },
    },
    services: {
      eyebrow: 'Service Types',
      title: '三种形态',
      description: '像写普通函数一样写 handler，按一致性需求选型。',
      items: [
        {
          name: 'Service',
          tagline: '无状态耐久 handler',
          bestFor: 'ETL、saga、并行任务、后台作业',
          bullets: [
            '无限并行',
            '耐久执行与可靠调用',
            '请求间无共享状态',
            '适合水平扩展',
          ],
        },
        {
          name: 'Virtual Object',
          tagline: '按 key 的有状态实体',
          bestFor: '账户、购物车、会话、状态机',
          bullets: [
            '内置 K/V，按对象隔离',
            '每 key 至多一个写者',
            '共享 handler 可并发只读',
            '跨 key 水平扩展',
          ],
        },
        {
          name: 'Workflow',
          tagline: '多步骤，按 ID 执行一次',
          bestFor: '审批、入职、长流程',
          bullets: [
            'run 按 workflow ID 恰好一次',
            '可等事件、人工信号与 promise',
            '共享 handler 可查询或推进',
            '内置生命周期 API',
          ],
        },
      ],
    },
    state: {
      eyebrow: 'Consistent State',
      title: '状态与执行同账',
      description: '内嵌键值存储。状态更新和执行步骤一起入账，不会漂移。',
      items: [
        {
          title: '按实体隔离',
          description: '每个对象 / 工作流实例状态独立。',
        },
        {
          title: '单写者',
          description: '同时只有一个 handler 可写，无竞态。',
        },
        {
          title: '服务可无状态部署',
          description: '状态在控制面；业务服务可水平扩展，也可跑 Serverless。',
        },
        {
          title: '会话落点',
          description: '上下文、工具结果与版本可作为实体状态保存。',
        },
      ],
    },
    communication: {
      eyebrow: 'Reliable Communication',
      title: '调用有保证',
      description: '服务间通信由 OS 代理：自动重试、不重复执行、链路可查。',
      items: [
        {
          title: '自动重试',
          description: '失败调用持续重试直至成功，无需自建队列。',
        },
        {
          title: 'Exactly-once',
          description: '同一调用不执行两次。',
        },
        {
          title: '调用链可见',
          description: '依赖链在控制面可查。',
        },
        {
          title: '多入口',
          description: 'HTTP、事件与程序调用同一套语义。',
        },
      ],
    },
    time: {
      eyebrow: 'Time & Signals',
      title: '等待也耐久',
      description: 'durable sleep、定时唤醒，以及 webhook、审批等信号。',
      items: [
        {
          title: '耐久定时器',
          description: 'sleep / schedule 入账，重启不丢时间线。',
        },
        {
          title: '人工与 webhook',
          description: '挂起等待回调，再从断点继续。',
        },
        {
          title: 'FaaS 友好',
          description: '等待可不占执行时间。',
        },
        {
          title: '长会话',
          description: '多轮工具调用与跨天流程用同一时间模型。',
        },
      ],
    },
    flow: {
      eyebrow: 'Flow Control',
      title: '按范围限并发',
      description: '控成本、护下游、调度更公平。',
      items: [
        {
          title: '成本上限',
          description: '限制昂贵调用的并发。',
        },
        {
          title: '下游保护',
          description: '突发流量冲不垮数据库或第三方 API。',
        },
        {
          title: '公平调度',
          description: '同分区任务更均匀占容量。',
        },
        {
          title: '按需开启',
          description: '可选能力，按服务配置。',
        },
      ],
    },
    agents: {
      eyebrow: 'AI Agents',
      title: '有状态 Agent',
      description: '做成 Virtual Object 或 Workflow：工具调用可续跑，记忆一致。',
      items: [
        {
          title: '工具调用入账',
          description: '结果进 journal，重试不重复副作用。',
        },
        {
          title: '会话即实体',
          description: '按用户 / 线程 key 保持上下文。',
        },
        {
          title: '多 Agent 编排',
          description: '可靠 RPC 串联，调用链可追踪。',
        },
        {
          title: '可发布复用',
          description: '跑通的策略与流程可版本化给团队用。',
        },
      ],
    },
    architecture: {
      eyebrow: 'Architecture',
      title: '控制面编排，执行下沉到节点',
      description:
        '意图与策略在 OS；耐久协调走 Operations / Flow；Workload 经 Fleet、Runtime、Box 收敛。Gateway 是唯一公网入口。',
      parts: [
        {
          title: '三类一等服务',
          description: 'WaaS、FaaS 与 Durable Cell 共用同一套控制面与执行栈。',
        },
        {
          title: 'Kense OS 控制面',
          description: '租户意图、授权、期望状态、Operations / Flow，以及 Edge 完整快照。',
        },
        {
          title: 'Runtime · Box · Inference',
          description: '节点侧执行与隔离；Power 以普通 Runtime Service 承接推理。',
        },
      ],
      diagram: {
        sourcesLabel: '产品意图',
        planeLabel: 'Control Plane',
        planeBrand: 'Kense OS',
        outputsLabel: '执行与供给',
        toolsLabel: '管理面',
        observeLabel: '证据与观测',
        core: 'Operations · Flow',
        sources: [
          { title: 'WaaS · Workflow', tags: ['Plan', 'HumanTask', 'Replay'] },
          { title: 'FaaS · Functions', tags: ['Task', 'Service', 'MCP'] },
          { title: 'Durable Cell', tags: ['共享状态', '告警', '围栏'] },
        ],
        ingress: ['Unified Gateway', 'Identity · Grants'],
        egress: ['Workloads', 'Fleet · Claims', 'Runtime · Box', 'Inference', 'Marketplace'],
        outputs: [
          { title: '隔离负载', tags: ['Box', 'OCI', 'Sandbox'] },
          { title: 'Power 推理', tags: ['GPU', 'Health', 'Route'] },
          { title: '能力开通', tags: ['Listing', 'Entitlement', '一钥'] },
          { title: '制品与供给', tags: ['OCI', 'Use', 'Weights'] },
        ],
        tools: ['Console', 'CLI', 'SDK', 'MCP'],
        observe: ['Audit', 'Usage', 'Traces', 'Replay'],
      },
    },
    deploy: {
      eyebrow: 'Deploy',
      title: '托管、BYOC 或自托管',
      description: '落地方式可选，语义不变。',
      options: [
        {
          name: 'Managed OS',
          description: 'Kense 托管控制面。',
          points: ['分钟级开通', '托管升级与观测', '适合快速上线'],
        },
        {
          name: 'BYOC',
          description: '控制面跑在你的云账号与 VPC。',
          points: ['数据本地化', '运维更少', '贴合企业网络策略'],
        },
        {
          name: 'Self-hosted',
          description: '部署、安全与升级全自管。',
          points: ['私有化', '自定义合规', '对接现有平台工程'],
        },
      ],
    },
    bottomCta: {
      title: '从一条耐久流程开始',
      description: '先完成一次工作流或会话，再按需扩展治理与复用。',
      primary: '免费开始',
      secondary: '预约演示',
    },
  },
};
