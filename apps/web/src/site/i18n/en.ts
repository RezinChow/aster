import type { Messages } from './types';

export const en: Messages = {
  meta: {
    homeTitle: 'Kense — Work & OS',
    pricingTitle: 'Pricing — Kense',
    blogTitle: 'Blog — Kense',
    docsTitle: 'Docs — Kense',
    cloudTitle: 'Kense OS — Durable execution & control plane',
    loginTitle: 'Log in — Kense',
    signupTitle: 'Sign up — Kense',
    description:
      'Kense Work provides a local-first workspace; Kense OS provides orchestration, memory, and governance.',
    cloudDescription:
      'Kense OS delivers durable execution, consistent state, reliable calls, and controlled publishing.',
  },
  nav: {
    home: 'Home',
    features: 'Features',
    work: 'Work',
    cloud: 'OS',
    pricing: 'Pricing',
    customers: 'Customers',
    docs: 'Docs',
    blog: 'Blog',
    login: 'Log in',
    demo: 'Book a demo',
    start: 'Start for free',
  },
  lang: {
    zh: '中文',
    en: 'EN',
    switchTo: 'Switch language',
  },
  a11y: {
    backToTop: 'Back to top',
  },
  hero: {
    title: 'Complete work locally. Preserve capability across the organization.',
    subtitle:
      'Kense Work composes models, files, and tools on your machine; Kense OS handles orchestration, organizational memory, and access governance.',
    ctaPrimary: 'Start for free',
    ctaSecondary: 'Book a demo',
    discover: 'Explore the product',
    workPreview: {
      newTask: 'New task',
      projects: 'Projects',
      projectsEmpty: 'No projects yet',
      tasks: 'Tasks',
      tasksEmpty: 'No tasks yet',
      more: 'More',
      user: 'roylin',
      greeting: "Docs Expert — I'm here to help",
      selectProject: 'Select project',
      placeholder:
        'What do you want to finish today? @ files, / skills, # plugins…',
      modelStatus: 'No model connected',
      executeAuto: 'Run · Auto',
      workspaceWritable: 'Workspace writable',
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
      search: 'Search',
      plugins: 'Plugins',
      chats: [
        {
          id: 'docs',
          name: 'Docs Expert',
          preview: 'Need your yes on the Friday all-hands deck.',
          time: '7:34',
          unread: true,
        },
        {
          id: 'code',
          name: 'Code Expert',
          preview: "Repro'd the checkout crash. Write-up's in the ticket.",
          time: 'Yesterday',
        },
        {
          id: 'science',
          name: 'Science Expert',
          preview: "Checkout's clean on staging, 3 bugs closed.",
          time: '11:18',
        },
        {
          id: 'finance',
          name: 'Finance Expert',
          preview: '14 receipts in. Still missing your Uber from Tuesday.',
          time: '9:04',
        },
      ],
    },
  },
  logos: {
    label: 'Teams that choose Kense',
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
      'A local-first workspace that composes people, models, data, and tools per task — under host policy and least privilege.',
    items: [
      {
        title: 'Understand context',
        description:
          'Identify the problem from goals, constraints, and local files.',
      },
      {
        title: 'Compose per task',
        description:
          'Select models, tools, and data for the current task in a traceable session.',
      },
      {
        title: 'Validate within boundaries',
        description:
          'Run experiments under explicit authorization and isolated execution, with results available for evaluation.',
      },
    ],
    quote: {
      text: 'Real data and agents can collaborate in the same workspace — with clear boundaries.',
      author: 'Alex Chen',
      role: 'Head of Product · Cascade',
    },
    bot: {
      aria: 'Digital employees: Docs, Code, Science, Finance',
      eyebrow: 'Digital Employees',
      title: 'Digital Employees',
      caption: 'Specialist roles for distinct work domains.',
      squad: [
        { id: 'docs', name: 'DOCS EXPERT', role: 'Writing · Layout · Knowledge' },
        { id: 'code', name: 'CODE EXPERT', role: 'Apps · Delivery' },
        { id: 'science', name: 'SCIENCE EXPERT', role: 'Experiments · Analysis' },
        { id: 'finance', name: 'FINANCE EXPERT', role: 'Risk · Reports' },
      ],
    },
  },
  cloud: {
    title: 'Kense OS',
    description:
      'The control plane owns intent and policy. Operations / Flow coordinates durably. Workloads converge through Fleet, Runtime, and Box.',
    items: [
      {
        title: 'Unified Gateway',
        description:
          'One governed public ingress for Agents, Workflows, Functions, and Inference.',
      },
      {
        title: 'Operations · Flow',
        description:
          'Desired state stays separate from the journal — replay skips completed steps after interruption.',
      },
      {
        title: 'Runtime · Box',
        description:
          'Isolated execution lands on nodes; Power runs as ordinary Services for inference.',
      },
    ],
    quote: {
      text: 'Models can change; the judgment the team preserved remains available.',
      author: 'Jordan Lee',
      role: 'Platform Engineering · Orbit',
    },
  },
  integrations: {
    title: 'Stable integrations, swappable providers',
    description:
      'Connect models and tools through a unified interface. Change providers without rebuilding the pipeline.',
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
    title: 'Permissions, isolation, and audit',
    description:
      'Every action has a boundary, authorization, and record. Sensitive data can remain local.',
    items: [
      {
        title: 'Organization-wide policy',
        description:
          'Models, tools, and data usage are configured centrally by the organization.',
      },
      {
        title: 'Sandbox execution',
        description:
          'Code and network access run in isolation, reducing production risk.',
      },
      {
        title: 'Auditable evidence',
        description:
          'Runs, evaluations, and anomalies are recorded; publish and rollback have defined gates.',
      },
    ],
    quote: {
      text: 'Clear boundaries, ownership, and logs — that is what production requires.',
      author: 'Sam Rivera',
      role: 'Security Lead · Harbor',
    },
  },
  devices: {
    title: 'Start on one machine, scale as needed',
    description:
      'Complete work locally first, then add memory, flows, and team governance as required.',
    items: [
      {
        title: 'Local-first',
        description:
          'Data and permissions remain within local boundaries by default; add capability as needed.',
      },
      {
        title: 'Swappable providers',
        description:
          'Select models and runtimes by cost, performance, and compliance requirements.',
      },
      {
        title: 'Uniform Work–OS contract',
        description:
          'Sessions and state stay aligned between Work and OS.',
      },
    ],
    quote: {
      text: 'Started from a personal CLI; three weeks later three teams were calling the same capabilities.',
      author: 'Riley Park',
      role: 'Engineering Manager · Vertex',
    },
  },
  teams: {
    title: 'Individual contribution, team reuse',
    description:
      'Experience is recorded with context; after review it becomes skills, knowledge, or workflows.',
    items: [
      {
        title: 'Transferable judgment',
        description:
          'Key decisions are documented for handoff, revision, and reuse.',
      },
      {
        title: 'Reuse across teams',
        description:
          'One asset can be composed by multiple applications and agents.',
      },
      {
        title: 'Operations built for handoff',
        description:
          'Queues, recovery, and audit are defaults — reducing manual oversight.',
      },
    ],
    quote: {
      text: 'We needed a team capability library that grows, can be governed, and can be handed down.',
      author: 'Morgan Ellis',
      role: 'COO · Alloy',
    },
  },
  scale: {
    title: 'Designed for production scale',
    description:
      'From personal sessions to the organizational control plane — runtime, memory, orchestration, and governance on one contract.',
    stats: [
      { value: '30m+', label: 'Sessions & workflows executed' },
      { value: '186+', label: 'Countries & regions' },
      { value: '1,500+', label: 'Teams in production' },
      { value: '>99.9%', label: 'Control-plane availability' },
    ],
  },
  compliance: {
    title: 'Built-in compliance',
    description: 'Policy, isolation, and audit available out of the box.',
    cta: 'Talk to sales',
    badges: ['GDPR', 'CCPA', 'SOC 2'],
  },
  cta: {
    title: 'Start with one real task',
    description: 'Start free, or book a product demo.',
    primary: 'Start for free',
    secondary: 'Book a demo',
  },
  footer: {
    product: 'Product',
    company: 'Company',
    resources: 'Resources',
    legal: 'Legal',
    tagline: 'An AI-native OS built for the Agent era',
    links: {
      orgCenter:'User Center',
      adminConsole: 'Admin Console',
      apiDocs: 'API docs',
      work: 'Kense Work',
      cloud: 'Kense OS',
      pricing: 'Pricing',
      blog: 'Blog',
      docs: 'Docs',
      about: 'About',
      careers: 'Careers',
      privacy: 'Privacy',
      terms: 'Terms',
      openSource: 'Open source',
    },
    copyright: '© Kense Labs. All rights reserved.',
  },
  site: {
    tocLabel: 'On this page',
    about: {
      documentTitle: 'About — Kense',
      kicker: 'Company',
      title: 'An AI-native OS for the Agent era',
      lead:
        'Kense Labs builds Kense Work and Kense OS so teams can finish work locally and compound reusable capability across the organization.',
      missionTitle: 'What we are building',
      missionBody:
        'Agents and workflows are becoming a new unit of software. Kense provides a local-first work surface plus recoverable, auditable orchestration and memory on the system side—so one-off sessions become operable capability.',
      pillars: [
        {
          title: 'Local-first work',
          body: 'Compose models, files, and tools locally; keep sensitive context inside the boundary by default.',
        },
        {
          title: 'Durable orchestration',
          body: 'Recoverable, replayable flows with consistent state across sessions and roles.',
        },
        {
          title: 'Org memory & permissions',
          body: 'Capability, policy, and audit designed together so real organizations can ship safely.',
        },
      ],
      ctaTitle: 'Turn work into a system',
      ctaBody: 'Start free, or book a demo to map the right path for your team.',
      ctaPrimary: 'Start for free',
      ctaSecondary: 'Book a demo',
    },
    careers: {
      documentTitle: 'Careers — Kense',
      kicker: 'Careers',
      title: 'Build AI-native infrastructure with us',
      lead:
        'We look for people who care about product detail, system correctness, and real workflows. Remote-friendly, async by default.',
      culture: [
        {
          title: 'Write it down',
          body: 'Design docs, RFCs, and runnable prototypes beat long meetings.',
        },
        {
          title: 'Prove it on real tasks',
          body: 'We ship when a full workflow works—not when the slides look good.',
        },
        {
          title: 'Small team, high leverage',
          body: 'Everyone can move product direction and engineering quality.',
        },
      ],
      openingsTitle: 'Open roles',
      openingsEmpty:
        'No public openings right now. Still interested? Send a short note with relevant work.',
      openings: [
        {
          title: 'Full-stack engineer',
          location: 'Remote / Shanghai',
          type: 'Full-time',
          summary:
            'Own product UI, APIs, and reliability for Work and the OS control plane.',
        },
        {
          title: 'Distributed systems engineer',
          location: 'Remote / Shanghai',
          type: 'Full-time',
          summary:
            'Design durable execution, consistent state, recoverable workflows, and observability.',
        },
      ],
      howTitle: 'How to apply',
      howSteps: [
        'Write a short intro: what you have built and why Kense.',
        'Attach a résumé or links to GitHub / portfolio work.',
        'Use “Book a demo” and set the subject to “Careers + role”.',
      ],
      applyCta: 'Contact hiring',
    },
    privacy: {
      documentTitle: 'Privacy Policy — Kense',
      kicker: 'Legal',
      title: 'Privacy Policy',
      updated: 'Last updated: September 16, 2026',
      lead:
        'This policy explains how Kense Labs (“we”) collects, uses, and protects information when you use Kense websites and products. By using our services, you understand this policy.',
      sections: [
        {
          id: 'who',
          title: '1. Who we are',
          paragraphs: [
            'Kense Labs provides Kense Work, Kense OS, and related websites, docs, and demos. For privacy questions, contact us via “Book a demo” on the site and note “Privacy”.',
          ],
        },
        {
          id: 'collect',
          title: '2. What we collect',
          paragraphs: [
            'We collect only what we need to provide and improve the service, which may include:',
          ],
          bullets: [
            'Account details you provide: name, work email, organization.',
            'Usage data: product usage, device/browser type, coarse location, diagnostics.',
            'Communications: content you send in demo requests, support, or email.',
            'Cookies and similar tech for session, preferences (e.g. language), and basic analytics.',
          ],
        },
        {
          id: 'use',
          title: '3. How we use information',
          paragraphs: ['We use information to:'],
          bullets: [
            'Provide, maintain, and improve products and the website.',
            'Operate accounts, authentication, and customer support.',
            'Send service notices (security or material changes); marketing only with consent or as allowed by law.',
            'Prevent abuse, debug issues, and meet compliance obligations.',
          ],
        },
        {
          id: 'share',
          title: '4. How we share information',
          paragraphs: [
            'We do not sell personal information. We share only when needed:',
          ],
          bullets: [
            'Processors under contract (hosting, email, analytics) bound to protect data.',
            'Legal requirements under law, regulation, or valid legal process.',
            'Business transfers (merger, acquisition) with notice or consent as required.',
          ],
        },
        {
          id: 'retention',
          title: '5. Retention and security',
          paragraphs: [
            'We retain information as long as needed for the purposes in this policy, then delete or anonymize it unless law requires longer retention.',
            'We use reasonable technical and organizational measures, but no internet transmission or storage is perfectly secure.',
          ],
        },
        {
          id: 'rights',
          title: '6. Your rights',
          paragraphs: [
            'Depending on where you live, you may have rights to access, correct, delete, restrict, or export personal data, and to withdraw consent (without affecting prior lawful processing).',
            'To exercise rights, contact us via “Book a demo” and note “Privacy rights”. We will respond within a reasonable time.',
          ],
        },
        {
          id: 'cookies',
          title: '7. Cookies',
          paragraphs: [
            'We use necessary cookies for session and language preferences, and may use analytics cookies to understand site usage. You can control cookies in your browser; disabling some may affect functionality.',
          ],
        },
        {
          id: 'intl',
          title: '8. International transfers',
          paragraphs: [
            'Infrastructure and processors may be outside your country. Where we transfer data internationally, we use appropriate safeguards required by applicable law.',
          ],
        },
        {
          id: 'children',
          title: '9. Children',
          paragraphs: [
            'Services are for organizations and professionals, not children under 16. If we learn we collected a child’s data by mistake, we will delete it promptly.',
          ],
        },
        {
          id: 'changes',
          title: '10. Changes',
          paragraphs: [
            'We may update this policy from time to time. Material changes will refresh the “Last updated” date and may be announced in-product or by email. Continued use means you accept the updated policy.',
          ],
        },
      ],
    },
    terms: {
      documentTitle: 'Terms of Service — Kense',
      kicker: 'Legal',
      title: 'Terms of Service',
      updated: 'Last updated: September 16, 2026',
      lead:
        'These terms govern access to and use of Kense Labs websites, products, and related services (“Services”). By using the Services, you agree to these terms. If you do not agree, do not use them.',
      sections: [
        {
          id: 'accept',
          title: '1. Acceptance',
          paragraphs: [
            'You confirm you can accept these terms for yourself or your organization. If you use the Services on behalf of an organization, you represent you have authority to bind it.',
          ],
        },
        {
          id: 'account',
          title: '2. Accounts and access',
          paragraphs: [
            'Provide accurate information and protect your credentials. You are responsible for activity under your account. We may suspend or terminate access if we reasonably suspect abuse, security risk, or breach of these terms.',
          ],
        },
        {
          id: 'license',
          title: '3. License and IP',
          paragraphs: [
            'Subject to these terms, we grant a limited, non-exclusive, non-transferable, revocable license to use the Services as documented.',
            'IP in the Services, software, brands, and docs remains with Kense Labs or its licensors. These terms do not transfer ownership.',
            'You retain rights in content you submit; you grant us the license needed to process it to provide the Services.',
          ],
        },
        {
          id: 'acceptable',
          title: '4. Acceptable use',
          paragraphs: ['You must not:'],
          bullets: [
            'Violate law or infringe others’ rights.',
            'Attempt unauthorized access to systems, data, or accounts.',
            'Interfere with integrity, availability, or security (including abuse of automation or bypassing limits).',
            'Upload malware, or use the Services for fraud, harassment, or clearly harmful purposes.',
          ],
        },
        {
          id: 'beta',
          title: '5. Previews and changes',
          paragraphs: [
            'Some features may be preview, beta, or free-tier and may change, be limited, or end at any time. We may update the Services; for material adverse changes we will give reasonable notice where practicable.',
          ],
        },
        {
          id: 'fees',
          title: '6. Fees',
          paragraphs: [
            'Paid plan pricing, billing period, and inclusions are as shown at purchase or in an order. Unless stated in writing, fees are generally non-refundable. Non-payment may lead to suspension.',
          ],
        },
        {
          id: 'disclaimer',
          title: '7. Disclaimer',
          paragraphs: [
            'To the maximum extent permitted by law, the Services are provided “as is” and “as available,” without warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not warrant uninterrupted or error-free operation.',
          ],
        },
        {
          id: 'liability',
          title: '8. Limitation of liability',
          paragraphs: [
            'To the maximum extent permitted by law, Kense Labs and affiliates are not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill.',
            'Our aggregate liability related to these terms or the Services will not exceed amounts you paid us for the relevant Services in the twelve months before the claim; for free use, the minimum amount allowed by law.',
          ],
        },
        {
          id: 'termination',
          title: '9. Termination',
          paragraphs: [
            'You may stop using the Services and close your account at any time. We may terminate or suspend for breach or service wind-down. Provisions that by nature should survive will survive termination.',
          ],
        },
        {
          id: 'law',
          title: '10. Governing law',
          paragraphs: [
            'Except where mandatory consumer law says otherwise, these terms are governed by the laws of the People’s Republic of China (excluding conflict-of-law rules). Disputes should first be negotiated in good faith; failing that, resolved by courts with jurisdiction where Kense Labs is located, unless mandatory law requires otherwise.',
          ],
        },
        {
          id: 'contact',
          title: '11. Contact',
          paragraphs: [
            'For questions about these terms, contact us via “Book a demo” on the site and note “Terms”.',
          ],
        },
      ],
    },
  },
  pricing: {
    title: 'Plans that scale with your team',
    description:
      'Start free — no credit card required. Scale by seat. No hidden fees.',
    billingMonthly: 'Monthly',
    billingAnnual: 'Yearly',
    billedMonthly: 'Billed monthly',
    billedAnnual: 'Billed yearly',
    saveBadge: 'Save ~20%',
    includedLabel: 'Includes',
    plans: [
      {
        name: 'Free',
        priceMonthly: '$0',
        priceAnnual: '$0',
        period: '',
        audience: 'For individual evaluation',
        description: 'Complete your first local work session on a real project.',
        features: [
          '1 Work seat',
          'Local context & permission boundaries',
          'Basic sessions & tasks',
          'Community support',
        ],
        includes: ['Work basics'],
        cta: 'Start for free',
      },
      {
        name: 'Builder',
        priceMonthly: '$37',
        priceAnnual: '$29',
        period: '/seat/mo',
        meter: 'OS usage metered',
        audience: 'For early teams and independent developers',
        description: 'Turn recurring work into reusable capability and connect to OS.',
        features: [
          'Full Kense Work',
          'Memory write & retrieval',
          'Durable workflow basics',
          'API / Webhooks',
          'Email support',
        ],
        includes: ['Work', 'OS starter'],
        cta: 'Start for free',
      },
      {
        name: 'Team',
        priceMonthly: '$75',
        priceAnnual: '$59',
        period: '/seat/mo',
        meter: 'OS usage metered',
        audience: 'For multi-team collaboration',
        description: 'Shared capabilities, policy publishing, and workflow automation.',
        features: [
          'Team sharing & versions',
          'Policy & publish governance',
          'Workflow automation',
          'Priority support',
          '20 collaborator seats',
        ],
        includes: ['Work', 'OS', 'Governance'],
        cta: 'Start trial',
        highlighted: true,
      },
      {
        name: 'Enterprise',
        priceMonthly: 'Custom',
        priceAnnual: 'Custom',
        period: '',
        audience: 'For large organizations and regulated environments',
        description: 'Self-hosted control plane, identity integration, and compliance requirements.',
        features: [
          'Dedicated / self-hosted',
          'SSO / SCIM',
          'Custom admin roles',
          'SLA & dedicated support',
          '50 collaborator seats',
        ],
        includes: ['Control plane', 'Compliance'],
        cta: 'Book a demo',
        custom: true,
      },
    ],
    program: {
      eyebrow: 'Startup Program',
      title: 'Early team discount program',
      description:
        'Teams founded within the last 2 years with fewer than 6 members may apply for Team capabilities and additional OS quota.',
      bullets: [
        'Founded less than 2 years ago',
        'Fewer than 6 people',
        'Unlock Team core capabilities',
      ],
      cta: 'Apply now',
      secondary: 'Learn more',
    },
    compare: {
      title: 'Features and plans',
      description: 'Work and OS expand within one subscription, stage by stage.',
      categories: [
        {
          name: 'Work',
          rows: [
            {
              feature: 'Seats',
              values: ['1', 'As needed', 'As needed', 'As needed'],
            },
            {
              feature: 'Local sessions',
              values: ['✓', '✓', '✓', '✓'],
            },
            {
              feature: 'Permissions & sandbox',
              values: ['Basic', '✓', '✓', 'Advanced'],
            },
            {
              feature: 'Tool composition',
              values: ['Basic', '✓', '✓', '✓'],
            },
          ],
        },
        {
          name: 'OS',
          rows: [
            {
              feature: 'Memory & retrieval',
              values: ['—', '✓', '✓', '✓'],
            },
            {
              feature: 'Durable workflows',
              values: ['—', 'Basic', '✓', '✓'],
            },
            {
              feature: 'Versions & reuse',
              values: ['—', 'Personal', 'Team', 'Org'],
            },
            {
              feature: 'Publish & governance',
              values: ['—', '—', '✓', '✓'],
            },
          ],
        },
        {
          name: 'Security & support',
          rows: [
            {
              feature: 'SSO / SCIM',
              values: ['—', '—', '—', '✓'],
            },
            {
              feature: 'Self-hosted / dedicated',
              values: ['—', '—', '—', '✓'],
            },
            {
              feature: 'SLA',
              values: ['—', '—', 'Priority', 'Custom'],
            },
            {
              feature: 'Support',
              values: ['Community', 'Email', 'Priority', 'Dedicated'],
            },
          ],
        },
      ],
    },
    faq: {
      title: 'FAQ',
      subtitle: 'Book a demo for further questions.',
      items: [
        {
          q: 'Do I purchase Work and OS separately?',
          a: 'No. One subscription unlocks by stage: Free starts with Work, Builder adds OS, and Team and Enterprise add governance and the control plane.',
        },
        {
          q: 'What counts as a paid seat?',
          a: 'Members who use Work or manage OS flows and policies. Read-only collaborators use included seats.',
        },
        {
          q: 'How is OS usage billed?',
          a: 'Builder and Team meter durable orchestration; usage is visible in the console. Enterprise can negotiate bundled quota or self-host.',
        },
        {
          q: 'Is a trial available?',
          a: 'Yes. Start free with no credit card required; paid plans include a trial period.',
        },
        {
          q: 'Do you support self-hosting?',
          a: 'Enterprise supports dedicated or self-hosted control planes, plus SSO / SCIM, audit, and custom SLAs.',
        },
        {
          q: 'Are discounts available for early teams?',
          a: 'Yes. Eligible teams may apply to the Startup Program.',
        },
      ],
    },
    bottomCta: {
      title: 'Start with one end-to-end task',
      description: 'Complete work locally first; add OS when needed.',
      primary: 'Start for free',
      secondary: 'Book a demo',
    },
  },
  blog: {
    title: 'Blog',
    description:
      'Product and engineering practice: runtime, working methods, and how personal sessions become organizational capability.',
    minuteRead: 'min read',
    readArticle: 'Read article',
    related: 'Related',
    notFound: {
      title: 'Article not found',
      description: 'This link may have moved. Continue from the blog index.',
      back: 'Back to blog',
    },
  },
  docs: {
    title: 'Docs',
    description:
      'From mental model to first task: Work completes jobs locally; OS handles orchestration, memory, and governance.',
    startCta: 'Start with the introduction',
    contents: 'Contents',
    onThisPage: 'On this page',
    updated: 'Updated',
    prev: 'Previous',
    next: 'Next',
    productSwitch: {
      label: 'Product docs',
    },
    products: {
      overview: { name: 'Overview', blurb: 'Mental model and quickstart' },
      work: { name: 'Kense Work', blurb: 'Local-first workstation' },
      os: { name: 'Kense OS', blurb: 'Control plane and durable runtime' },
      platform: { name: 'Platform', blurb: 'Security, deploy, and plans' },
    },
    sections: {
      start: 'Get started',
      work: 'Kense Work',
      os: 'Kense OS',
      platform: 'Platform',
    },
    notFound: {
      title: 'Page not found',
      description: 'This page does not exist or has moved. Start from the docs index.',
      back: 'Back to docs',
    },
  },
  auth: {
    backHome: 'Back to home',
    eyebrow: 'Account',
    oauthGroup: 'Social sign-in',
    orEmail: 'or continue with email',
    orSocial: 'Or continue with',
    connecting: 'Connecting…',
    oauthSoon: 'OAuth providers will connect soon. This is a UI preview.',
    emailSoon: 'Email sign-in will connect soon. This is a UI preview.',
    loginSuccess: 'Signed in as',
    signupSuccess: 'Account created for',
    forgot: 'Forgot password?',
    showPassword: 'Show',
    hidePassword: 'Hide',
    agreePrefix: 'I agree to the',
    agreeAnd: 'and',
    providers: {
      github: 'Continue with GitHub',
      wechat: 'Continue with WeChat',
    },
    fields: {
      name: 'Full name',
      namePlaceholder: 'Your name',
      email: 'Work email',
      emailPlaceholder: 'you@company.com',
      phone: 'Mobile number',
      phonePlaceholder: '11-digit mobile number',
      code: 'SMS verification code',
      codePlaceholder: '6-digit code',
      codeSend: 'Send code',
      codeResendIn: 'Resend in {s}s',
      identifier: 'Mobile / email',
      identifierPlaceholder: '11-digit mobile or email',
      password: 'Password',
      passwordPlaceholder: 'At least 8 characters',
    },
    aside: {
      title: 'Build your AI-native team with Kense',
    },
    login: {
      documentTitle: 'Log in — Kense',
      title: 'Log in to Kense',
      subtitle: 'Use an existing developer identity, or continue with work email.',
      submit: 'Log in',
      switchPrompt: 'New here?',
      switchAction: 'Create an account',
    },
    signup: {
      documentTitle: 'Sign up — Kense',
      title: 'Create your Kense account',
      subtitle: 'Get started in minutes with one real task.',
      submit: 'Create account',
      switchPrompt: 'Already have an account?',
      switchAction: 'Log in',
    },
  },
  demoModal: {
    title: 'Book a product demo',
    subtitle: 'Share your name and email — we will reach out soon.',
    name: 'Name',
    namePlaceholder: 'How should we call you',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    submit: 'Submit request',
    submitting: 'Submitting…',
    close: 'Close',
    successTitle: 'Request received',
    successBody: 'Thanks for your interest in Kense. Our team will contact you shortly — please watch your inbox.',
    successDone: 'Got it',
  },
  cloudPage: {
    brand: 'Kense OS',
    title: 'Control plane orchestrates; nodes execute',
    subtitle:
      'WaaS / FaaS / Durable Cell share one control plane. Gateway is the only public ingress.',
    ctaPrimary: 'Start for free',
    ctaSecondary: 'View architecture',
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
      search: 'Search runs, claims, routes, units…',
      navLabel: 'Control plane',
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
      asideTitle: 'Stack health',
      plane: [
        { label: 'Gateway routes', value: '4 applied' },
        { label: 'Fleet claims', value: '3 / 3 fenced' },
        { label: 'Box isolation', value: 'MicroVM' },
        { label: 'Inference', value: '2 healthy' },
      ],
    },
    durable: {
      eyebrow: 'Durable Execution',
      title: 'Every step journaled — recovery resumes from the checkpoint',
      description:
        'Calls, side effects, timers, and results are written to the journal. On failure, replay skips completed steps and continues from the checkpoint.',
      steps: [
        {
          title: 'Invocation in',
          description:
            'Each invocation tracked to completion — exactly-once.',
        },
        {
          title: 'Steps journaled',
          description:
            'Side effects, RPCs, sleeps, and state writes are recorded.',
        },
        {
          title: 'Recover on failure',
          description:
            'Retries skip completed steps — no duplicate side effects.',
        },
        {
          title: 'Replayable',
          description:
            'Execution traces available for debugging.',
        },
      ],
      covers: [
        {
          title: 'Infrastructure failures',
          description:
            'After node restarts, in-flight work continues on new instances.',
        },
        {
          title: 'API timeouts',
          description:
            'Exponential backoff retries; tune policy per service.',
        },
        {
          title: 'Duplicate requests',
          description:
            'Idempotency keys dedupe — duplicates return the same result.',
        },
        {
          title: 'Network partitions',
          description:
            'If journal writes fail, execution stops; the control plane retries elsewhere.',
        },
      ],
      flow: {
        label: 'Durable path',
        stages: [
          { title: 'Invoke', detail: 'Request in' },
          { title: 'Journal', detail: 'Steps recorded' },
          { title: 'Recover', detail: 'Resume from checkpoint' },
          { title: 'Complete', detail: 'Exactly-once' },
        ],
      },
    },
    services: {
      eyebrow: 'Service Types',
      title: 'Three service models',
      description:
        'Write handlers like standard functions. Select the consistency model you need.',
      items: [
        {
          name: 'Service',
          tagline: 'Stateless durable handlers',
          bestFor: 'ETL, sagas, fan-out, background jobs',
          bullets: [
            'Unlimited parallel execution',
            'Durable execution & reliable calls',
            'No shared state between requests',
            'Horizontal scale',
          ],
        },
        {
          name: 'Virtual Object',
          tagline: 'Keyed stateful entities',
          bestFor: 'Accounts, carts, sessions, state machines',
          bullets: [
            'Built-in K/V per object key',
            'At most one writer per key',
            'Shared handlers for concurrent reads',
            'Scale across keys',
          ],
        },
        {
          name: 'Workflow',
          tagline: 'Multi-step, once per ID',
          bestFor: 'Approvals, onboarding, long flows',
          bullets: [
            'run executes exactly once per workflow ID',
            'Wait for events, human signals, and promises',
            'Shared handlers query or advance the flow',
            'Lifecycle APIs built in',
          ],
        },
      ],
    },
    state: {
      eyebrow: 'Consistent State',
      title: 'State and execution on the same ledger',
      description:
        'Embedded key-value store. State updates journal with execution steps — no drift.',
      items: [
        {
          title: 'Scoped per entity',
          description:
            'Each object / workflow instance has isolated state.',
        },
        {
          title: 'Single writer',
          description:
            'Only one handler can write at a time — no races.',
        },
        {
          title: 'Stateless service deploy',
          description:
            'State lives in the control plane; your services scale horizontally, including serverless.',
        },
        {
          title: 'Session home',
          description:
            'Context, tool results, and versions persist as entity state.',
        },
      ],
    },
    communication: {
      eyebrow: 'Reliable Communication',
      title: 'Reliable service calls',
      description:
        'OS proxies service-to-service traffic: automatic retry, no duplicate execution, traceable call chains.',
      items: [
        {
          title: 'Automatic retry',
          description: 'Failures retry until success, without custom queue infrastructure.',
        },
        {
          title: 'Exactly-once',
          description: 'The same call does not run twice.',
        },
        {
          title: 'Visible call chains',
          description:
            'Dependency chains inspectable in the control plane.',
        },
        {
          title: 'Multiple ingresses',
          description:
            'HTTP, events, and programmatic invoke share the same semantics.',
        },
      ],
    },
    time: {
      eyebrow: 'Time & Signals',
      title: 'Durable waits',
      description:
        'Durable sleep, scheduled wakeups, and signals — including webhooks and approvals.',
      items: [
        {
          title: 'Durable timers',
          description:
            'sleep / schedule land in the journal — timelines survive restarts.',
        },
        {
          title: 'Humans & webhooks',
          description:
            'Suspend for callbacks, then resume from the breakpoint.',
        },
        {
          title: 'FaaS-friendly',
          description:
            'Waiting does not consume execution time.',
        },
        {
          title: 'Long sessions',
          description:
            'Multi-turn tool use and multi-day flows share one time model.',
        },
      ],
    },
    flow: {
      eyebrow: 'Flow Control',
      title: 'Limit concurrency by scope',
      description:
        'Control cost, protect downstream services, and keep scheduling fair.',
      items: [
        {
          title: 'Cost ceiling',
          description:
            'Limit concurrent expensive calls.',
        },
        {
          title: 'Downstream protection',
          description:
            'Bursts do not overwhelm databases or third-party APIs.',
        },
        {
          title: 'Fair scheduling',
          description:
            'Tasks in a partition share capacity more evenly.',
        },
        {
          title: 'Optional',
          description: 'Enable per service as needed.',
        },
      ],
    },
    agents: {
      eyebrow: 'AI Agents',
      title: 'Stateful agents',
      description:
        'Implement as Virtual Object or Workflow: tool calls resume after interruption; memory stays consistent.',
      items: [
        {
          title: 'Journaled tool calls',
          description:
            'Results go in the journal — retries do not duplicate side effects.',
        },
        {
          title: 'Session as entity',
          description:
            'Context per user / thread key.',
        },
        {
          title: 'Multi-agent orchestration',
          description:
            'Chain agents with reliable RPC — call chains traceable.',
        },
        {
          title: 'Publish and reuse',
          description:
            'Validated policies and flows are versioned for team use.',
        },
      ],
    },
    architecture: {
      eyebrow: 'Architecture',
      title: 'Control plane orchestrates; nodes execute',
      description:
        'Intent and policy live in OS. Durable coordination runs through Operations / Flow. Workloads converge via Fleet, Runtime, and Box. Gateway is the only public ingress.',
      parts: [
        {
          title: 'Three first-class services',
          description:
            'WaaS, FaaS, and Durable Cell share one control plane and execution stack.',
        },
        {
          title: 'Kense OS control plane',
          description:
            'Tenant intent, authorization, desired state, Operations / Flow, and complete Edge snapshots.',
        },
        {
          title: 'Runtime · Box · Inference',
          description:
            'Node-local execution and isolation; Power runs as ordinary Runtime Services for inference.',
        },
      ],
      diagram: {
        sourcesLabel: 'Product intent',
        planeLabel: 'Control Plane',
        planeBrand: 'Kense OS',
        outputsLabel: 'Execution & supply',
        toolsLabel: 'Management',
        observeLabel: 'Evidence',
        core: 'Operations · Flow',
        sources: [
          { title: 'WaaS · Workflow', tags: ['Plan', 'HumanTask', 'Replay'] },
          { title: 'FaaS · Functions', tags: ['Task', 'Service', 'MCP'] },
          { title: 'Durable Cell', tags: ['Shared state', 'Alarms', 'Fence'] },
        ],
        ingress: ['Unified Gateway', 'Identity · Grants'],
        egress: ['Workloads', 'Fleet · Claims', 'Runtime · Box', 'Inference', 'Marketplace'],
        outputs: [
          { title: 'Isolated workloads', tags: ['Box', 'OCI', 'Sandbox'] },
          { title: 'Power inference', tags: ['GPU', 'Health', 'Route'] },
          { title: 'Capability entitlements', tags: ['Listing', 'Entitlement', 'One key'] },
          { title: 'Artifacts & supply', tags: ['OCI', 'Use', 'Weights'] },
        ],
        tools: ['Console', 'CLI', 'SDK', 'MCP'],
        observe: ['Audit', 'Usage', 'Traces', 'Replay'],
      },
    },
    deploy: {
      eyebrow: 'Deploy',
      title: 'Managed, BYOC, or self-hosted',
      description: 'Choose deployment model — semantics stay consistent.',
      options: [
        {
          name: 'Managed OS',
          description: 'Kense operates the control plane.',
          points: [
            'Provision in minutes',
            'Managed upgrades and observability',
            'Suitable for rapid deployment',
          ],
        },
        {
          name: 'BYOC',
          description:
            'Control plane runs in your cloud account and VPC.',
          points: [
            'Data locality',
            'Reduced operational burden',
            'Aligns with enterprise network policy',
          ],
        },
        {
          name: 'Self-hosted',
          description:
            'You manage deployment, security, and upgrades.',
          points: [
            'Private deployment',
            'Custom compliance requirements',
            'Integrates with existing platform engineering',
          ],
        },
      ],
    },
    bottomCta: {
      title: 'Run one workflow end to end',
      description: 'Start with one durable workflow or session.',
      primary: 'Start for free',
      secondary: 'Book a demo',
    },
  },
};
