import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Database, FileText, Search, Terminal } from 'lucide-react'

import type { ContextPart } from '../../../src/components/affect/agents/context-window'
import type { CostStep } from '../../../src/components/affect/agents/cost-waterfall'
import type { Decision as CardDecision } from '../../../src/components/affect/agents/decision-card'
import type { Decision as TreeDecision } from '../../../src/components/affect/agents/decision-tree'
import type { DelegateAgent, DelegateTask } from '../../../src/components/affect/agents/delegate-board'
import type { DiffEdit } from '../../../src/components/affect/agents/diff-timeline'
import type { FallbackAttempt } from '../../../src/components/affect/agents/fallback-chain'
import type { FanoutTask } from '../../../src/components/affect/agents/fan-out-grid'
import type { FlowStep } from '../../../src/components/affect/agents/flow-builder'
import type { Contender, Verdict } from '../../../src/components/affect/agents/judge-bracket'
import type { Memory, MemoryTool } from '../../../src/components/affect/agents/memory-graph'
import type { PanelMemory } from '../../../src/components/affect/agents/memory-panel'
import type { Attempt } from '../../../src/components/affect/agents/parallel-attempts'
import type { PlanStep as PlanVsStep } from '../../../src/components/affect/agents/plan-vs-actual'
import type { PlannedRun } from '../../../src/components/affect/agents/rate-limit-planner'
import type { ReasonModel, ReasonStep } from '../../../src/components/affect/agents/reasoning-summary'
import type { RepoAgent, RepoFile } from '../../../src/components/affect/agents/repo-map'
import type { ReviewItem } from '../../../src/components/affect/agents/review-center'
import type { Cause } from '../../../src/components/affect/agents/root-cause-tree'
import type { RunningTask } from '../../../src/components/affect/agents/running-now'
import type { ScheduledTask } from '../../../src/components/affect/agents/scheduled-runs'
import type { AccessTool, MapAgent, ToolCall } from '../../../src/components/affect/agents/tool-access-map'
import type { TraceSpan } from '../../../src/components/affect/agents/trace-waterfall'
import {
  ContextWindow as ContextWindowComponent,
  CostWaterfall as CostWaterfallComponent,
  DecisionCard as DecisionCardComponent,
  DecisionTree as DecisionTreeComponent,
  DelegateBoard as DelegateBoardComponent,
  DiffTimeline as DiffTimelineComponent,
  FallbackChain as FallbackChainComponent,
  FanOutGrid as FanOutGridComponent,
  FlowBuilder as FlowBuilderComponent,
  InlineDiff as InlineDiffComponent,
  JudgeBracket as JudgeBracketComponent,
  MemoryGraph as MemoryGraphComponent,
  MemoryPanel as MemoryPanelComponent,
  ParallelAttempts as ParallelAttemptsComponent,
  PermissionRequest as PermissionRequestComponent,
  PlanVsActual as PlanVsActualComponent,
  RateLimitPlanner as RateLimitPlannerComponent,
  ReasoningSummary as ReasoningSummaryComponent,
  RepoMap as RepoMapComponent,
  ReviewCenter as ReviewCenterComponent,
  RootCauseTree as RootCauseTreeComponent,
  RunControls as RunControlsComponent,
  RunningNow as RunningNowComponent,
  ScheduledRuns as ScheduledRunsComponent,
  ToolAccessMap as ToolAccessMapComponent,
  ToolCallCard as ToolCallCardComponent,
  TraceWaterfall as TraceWaterfallComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Agents 2',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const now = 1_800_000_000_000

const contextParts: ContextPart[] = [
  { id: 'system', label: 'System prompt', tokens: 2400, locked: true },
  {
    id: 'history',
    label: 'Conversation',
    compact: true,
    items: [
      { id: 'h1', label: 'User: summarize pricing', tokens: 320 },
      { id: 'h2', label: 'Assistant: summary', tokens: 1800 }
    ]
  },
  {
    id: 'files',
    label: 'Files',
    items: [
      { id: 'f1', label: 'pricing.ts', tokens: 1200 },
      { id: 'f2', label: 'README.md', tokens: 600 }
    ]
  }
]

const costSteps: CostStep[] = [
  { id: 'c1', name: 'Planner', kind: 'llm', status: 'done', model: 'Opus', tokensIn: 4200, tokensOut: 900, cost: 0.06, duration: 1400 },
  {
    id: 'c2', name: 'Researcher', kind: 'agent', status: 'done', cost: 0.29, duration: 5200,
    children: [
      { id: 'c2a', name: 'web.search', kind: 'tool', status: 'done', cost: 0.01, duration: 900 },
      { id: 'c2b', name: 'GPT-5', kind: 'llm', status: 'done', model: 'GPT-5', tokensIn: 12000, tokensOut: 2400, cost: 0.28, duration: 3800 }
    ]
  },
  { id: 'c3', name: 'Editor', kind: 'llm', status: 'running', model: 'Opus', cost: 0.07, tokensIn: 3000, tokensOut: 1100 }
]

const cardDecisions: CardDecision[] = [
  {
    id: 'd1',
    question: 'Which pricing model should we ship?',
    task: 'Pricing page',
    kind: 'pick',
    options: [
      { id: 'flat', title: 'Flat $10/seat', summary: 'Simple and predictable', recommended: true },
      { id: 'tiered', title: 'Tiered by usage', summary: 'Scales with teams', blocks: 'Needs billing changes' }
    ]
  },
  {
    id: 'd2',
    question: 'Deploy to production?',
    kind: 'approval',
    facts: [
      { label: 'Changes', value: '12 files' },
      { label: 'Impact', value: 'All customers' }
    ]
  }
]

const treeDecisions: TreeDecision[] = [
  {
    id: 't1',
    question: 'How should we handle the schema migration?',
    context: 'The seats column changes type.',
    agent: 'Coder',
    model: 'Opus',
    risk: 'high',
    options: [
      { label: 'Migrate in place', pick: true, effects: ['Fast', 'Some downtime'] },
      { label: 'Blue-green deploy', effects: ['No downtime', 'More work'] }
    ]
  }
]

const delegateAgents: DelegateAgent[] = [
  { id: 'a1', name: 'Coder', model: 'Opus', current: 12, rate: 0.05 },
  { id: 'a2', name: 'Researcher', model: 'Sonnet', current: 4, rate: 0.02 }
]

const delegateTasks: DelegateTask[] = [
  { id: 'task1', title: 'Update pricing.ts', estimate: 15, tools: ['repo'] },
  { id: 'task2', title: 'Compare competitors', estimate: 8 },
  { id: 'task3', title: 'Write release notes', estimate: 6, agentId: 'a2' }
]

const diffEdits: DiffEdit[] = [
  { at: 12, file: 'src/pricing.ts', added: 18, removed: 4, diff: ['- seat: 8,', '+ seat: 10,'] },
  { at: 38, file: 'src/checkout.ts', added: 6, removed: 2 },
  { at: 61, file: 'README.md', added: 3, removed: 0 }
]

const fallbackAttempts: FallbackAttempt[] = [
  { id: 'f1', model: 'GPT-5', provider: 'OpenAI', status: 'failed', reason: 'Rate limited', duration: 1200, cost: 0 },
  { id: 'f2', model: 'Opus', provider: 'Anthropic', status: 'answered', duration: 840, cost: 0.04, note: 'Answered on the second try' },
  { id: 'f3', model: 'Sonnet', status: 'skipped' }
]

const fanoutTasks: FanoutTask[] = [
  { id: 'f1', label: 'Page 1', status: 'done', worker: 'w1', result: 'ok' },
  { id: 'f2', label: 'Page 2', status: 'done', worker: 'w2' },
  { id: 'f3', label: 'Page 3', status: 'running', worker: 'w3', start: 4000 },
  { id: 'f4', label: 'Page 4', status: 'running', worker: 'w4' },
  { id: 'f5', label: 'Page 5', status: 'retrying', worker: 'w1', attempts: 2 },
  { id: 'f6', label: 'Page 6', status: 'queued' },
  { id: 'f7', label: 'Page 7', status: 'queued' },
  { id: 'f8', label: 'Page 8', status: 'done', worker: 'w2' },
  { id: 'f9', label: 'Page 9', status: 'failed', worker: 'w3', error: 'Timeout' },
  { id: 'f10', label: 'Page 10', status: 'done', worker: 'w4' },
  { id: 'f11', label: 'Page 11', status: 'queued' },
  { id: 'f12', label: 'Page 12', status: 'queued' }
]

const flowSteps: FlowStep[] = [
  { id: 's1', kind: 'trigger', title: 'New issue', detail: 'GitHub webhook' },
  { id: 's2', kind: 'agent', title: 'Triage issue', note: 'Reading the report' },
  {
    id: 's3', kind: 'branch', title: 'Is it a bug?',
    paths: [
      { id: 'yes', label: 'Yes', steps: [{ id: 's4', kind: 'action', title: 'Open ticket' }] },
      { id: 'no', label: 'No', steps: [] }
    ]
  }
]

const judgeContenders: Contender[] = [
  { id: 'a', name: 'Opus draft', meta: 'Detailed' },
  { id: 'b', name: 'GPT-5 draft', meta: 'Concise' },
  { id: 'c', name: 'Sonnet draft', meta: 'Balanced' },
  { id: 'd', name: 'Haiku draft', meta: 'Fast' }
]

const judgeVerdicts: Record<string, Verdict> = {
  '0:0': { winner: 'a', scores: [9, 7], reason: 'More accurate' },
  '0:1': { winner: 'c', scores: [8, 6], reason: 'Clearer structure' },
  '1:0': { winner: 'a', scores: [9, 8], reason: 'Best overall' }
}

const graphMemories: Memory[] = [
  { id: 'mem1', text: 'Team uses a monorepo', source: 'README', tag: 'Repo', learned: now - 8_000_000, uses: 4 },
  { id: 'mem2', text: 'Prices are stored in cents', artifact: { name: 'pricing.ts', logo: <FileText className="size-3" /> }, tag: 'Billing', learned: now - 5_000_000, uses: 9 },
  { id: 'mem3', text: 'Legacy API was retired', tag: 'API', outdated: true, learned: now - 20_000_000 }
]

const graphTools: MemoryTool[] = [
  { id: 'tool1', name: 'web.search', access: 'read', scope: 'public web', used: now - 60_000, calls: 12 },
  { id: 'tool2', name: 'file.patch', access: 'write', scope: 'workspace', used: now - 120_000, calls: 5 },
  { id: 'tool3', name: 'shell.run', access: 'write', disabled: true, scope: 'sandbox' }
]

const panelMemories: PanelMemory[] = [
  { id: 'm1', text: 'Prefers concise answers', category: 'Preferences', source: 'You added', date: '2026-11-01' },
  { id: 'm2', text: 'Works on the billing team', category: 'Work', source: 'Chat' },
  { id: 'm3', text: 'Timezone is Europe/London', category: 'Preferences', source: 'Profile', paused: true }
]

const attempts: Attempt[] = [
  { id: 'a1', name: 'Opus plan', approach: 'Rewrite from scratch', model: 'Opus', status: 'done', score: 9, took: 5400, cost: 0.18, note: 'Cleanest result' },
  { id: 'a2', name: 'Sonnet plan', approach: 'Incremental edits', model: 'Sonnet', status: 'done', score: 7, took: 3100, cost: 0.05 },
  { id: 'a3', name: 'GPT-5 plan', approach: 'Template based', model: 'GPT-5', status: 'running', progress: 0.55, step: 'Drafting section 3' }
]

const planVsSteps: PlanVsStep[] = [
  { id: 'p1', title: 'Research', plan: 20_000, start: 0, end: 24_000 },
  { id: 'p2', title: 'Draft', plan: 30_000, deps: ['p1'], start: 24_000, end: 58_000 },
  { id: 'p3', title: 'Publish', plan: 10_000, deps: ['p2'] }
]

const plannedRuns: PlannedRun[] = [
  { id: 'r1', name: 'Nightly sync', at: 420, peak: 2400, days: 'daily' },
  { id: 'r2', name: 'Morning digest', at: 600, peak: 3800, days: 'weekdays' },
  { id: 'r3', name: 'Index rebuild', at: 780, peak: 1600 }
]

const reasonSteps: ReasonStep[] = [
  { id: 'rs1', kind: 'plan', label: 'Read the question', model: 'opus', ms: 420 },
  { id: 'rs2', kind: 'search', label: 'Find sources', model: 'opus', ms: 1800 },
  { id: 'rs3', kind: 'think', label: 'Weigh evidence', model: 'sonnet', ms: 2600 },
  { id: 'rs4', kind: 'write', label: 'Draft answer', model: 'opus', ms: 900 }
]

const reasonModels: ReasonModel[] = [
  { id: 'opus', name: 'Opus', effort: 'high', role: 'Lead', provider: 'Anthropic', tokens: { input: 8400, output: 1900 }, cost: 0.18 },
  { id: 'sonnet', name: 'Sonnet', effort: 'medium', role: 'Checker', tokens: { input: 3200, output: 800 }, cost: 0.04 }
]

const repoFiles: RepoFile[] = [
  { path: 'src/billing/pricing.ts', lines: 240, edits: [{ agent: 'coder', added: 18, removed: 4 }] },
  { path: 'src/billing/invoice.ts', lines: 180 },
  { path: 'src/checkout/index.ts', lines: 320, edits: [{ agent: 'coder', added: 6, removed: 2 }] },
  { path: 'src/checkout/pay.ts', lines: 140 },
  { path: 'README.md', lines: 60 }
]

const repoAgents: RepoAgent[] = [
  { id: 'coder', name: 'Coder', file: 'src/billing/pricing.ts', action: 'edit', task: 'Update prices' },
  { id: 'reviewer', name: 'Reviewer', file: 'src/checkout/index.ts', action: 'read', task: 'Review' },
  { id: 'writer', name: 'Writer', file: 'README.md', action: 'edit', task: 'Docs' }
]

const reviewItems: ReviewItem[] = [
  {
    id: 'rv1', title: 'Price increase email', agent: 'Writer', model: 'Opus', type: 'message',
    risk: 'high', confidence: 0.62, createdAt: now - 4_000,
    body: 'We are raising prices by 25% next month.',
    reasoning: 'External message going to all customers.'
  },
  {
    id: 'rv2', title: 'Schema migration', agent: 'Coder', type: 'code',
    risk: 'medium', confidence: 0.91, createdAt: now - 120_000,
    body: 'ALTER TABLE seats ALTER COLUMN price TYPE integer;'
  },
  {
    id: 'rv3', title: 'Release notes', agent: 'Writer', type: 'doc',
    risk: 'low', confidence: 0.88, createdAt: now - 300_000,
    body: 'v2.4 highlights and fixes.'
  }
]

const failureTree: Cause = {
  id: 'failure',
  title: 'Checkout returns 500',
  status: 'open',
  verdict: 'Started after the v2.4 deploy',
  children: [
    {
      id: 'db', title: 'Database connection', gate: 'or', status: 'checking',
      children: [
        { id: 'creds', title: 'Expired credentials', status: 'confirmed', evidence: { kind: 'log', source: 'api.log', content: 'ERROR: password authentication failed' } },
        { id: 'pool', title: 'Connection pool exhausted', status: 'ruled-out' }
      ]
    },
    { id: 'payment', title: 'Payment API timeout', status: 'ruled-out' }
  ]
}

const runningTasks: RunningTask[] = [
  { id: 'rt1', title: 'Research pricing', step: 'Comparing 5 vendors', done: 3, total: 5, state: 'running' },
  { id: 'rt2', title: 'Approve deploy', step: 'Waiting for you', done: 2, total: 3, state: 'needs-you' },
  { id: 'rt3', title: 'Sync docs', step: 'Paused', done: 1, total: 4, state: 'paused' },
  { id: 'rt4', title: 'Write notes', step: 'Finished', done: 3, total: 3, state: 'done' }
]

const scheduledTasks: ScheduledTask[] = [
  { id: 'st1', title: 'Nightly sync', usage: 40, agent: 'Syncer' },
  { id: 'st2', title: 'Report digest', usage: 140, agent: 'Writer' },
  { id: 'st3', title: 'Index rebuild', usage: 90, at: { day: 2, session: 1 } }
]

const accessTools: AccessTool[] = [
  { id: 'search', name: 'web.search', icon: <Search className="size-3" />, description: 'Search the web' },
  { id: 'patch', name: 'file.patch', description: 'Edit files' },
  { id: 'shell', name: 'shell.run', icon: <Terminal className="size-3" />, description: 'Run commands' }
]

const mapCalls: ToolCall[] = [
  { id: 'call1', status: 'done', input: { query: 'pricing 2026', limit: 5 }, output: { results: 5 }, duration: 820, at: 1000 },
  { id: 'call2', status: 'failed', input: { file: 'src/pricing.ts' }, error: 'Hunk #1 failed', duration: 240, at: 2400 }
]

const mapAgents: MapAgent[] = [
  {
    id: 'coder', name: 'Coder', model: 'Opus', status: 'done', task: 'Update pricing',
    tools: [
      { id: 'search', calls: [mapCalls[0]] },
      { id: 'patch', calls: [mapCalls[1]] }
    ]
  },
  { id: 'researcher', name: 'Researcher', status: 'running', tools: [{ id: 'search', calls: [] }] }
]

const traceRoot: TraceSpan = {
  id: 'run', name: 'Launch pricing page', kind: 'agent', status: 'done', start: 0, end: 11_000,
  input: 'Launch the new pricing page',
  children: [
    { id: 'plan', name: 'Plan', kind: 'llm', status: 'done', start: 0, end: 1_400, cost: 0.04, model: 'Opus' },
    { id: 'search', name: 'web.search', kind: 'tool', status: 'done', start: 1_600, end: 3_000, detail: '5 results' },
    {
      id: 'sub', name: 'Researcher', kind: 'subagent', status: 'done', start: 3_200, end: 8_600, cost: 0.29,
      children: [
        { id: 'read', name: 'file.read', kind: 'tool', status: 'done', start: 3_400, end: 3_900 },
        { id: 'think', name: 'Summarize', kind: 'llm', status: 'done', start: 4_000, end: 8_400, cost: 0.25, model: 'Sonnet' }
      ]
    },
    { id: 'patch', name: 'file.patch', kind: 'tool', status: 'failed', start: 8_800, end: 9_200, error: 'Hunk failed' }
  ]
}

export const ContextWindow: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ContextWindowComponent parts={contextParts} limit={16_000} model="Opus" />
    </div>
  )
}

export const CostWaterfall: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <CostWaterfallComponent steps={costSteps} task="Launch pricing page" title="Run cost" />
    </div>
  )
}

export const DecisionCard: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <DecisionCardComponent decisions={cardDecisions} />
    </div>
  )
}

export const DecisionTree: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <DecisionTreeComponent decisions={treeDecisions} />
    </div>
  )
}

export const DelegateBoard: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <DelegateBoardComponent agents={delegateAgents} tasks={delegateTasks} now={now} />
    </div>
  )
}

export const DiffTimeline: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <DiffTimelineComponent
        agent={{ id: 'coder', name: 'Coder' }}
        context="Launch pricing page"
        edits={diffEdits}
        elapsed={70}
        duration={90}
      />
    </div>
  )
}

export const FallbackChain: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <FallbackChainComponent
        attempts={fallbackAttempts}
        route="primary → fallback"
        request={{ name: 'You', text: 'Summarize the report' }}
        response={{ name: 'Assistant', text: 'Here is the summary…' }}
        now={now}
      />
    </div>
  )
}

export const FanOutGrid: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <FanOutGridComponent tasks={fanoutTasks} job="Scrape 12 pages" workers={4} now={12_000} />
    </div>
  )
}

export const FlowBuilder: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <FlowBuilderComponent name="Issue triage" defaultSteps={flowSteps} onRun={() => {}} height={380} />
    </div>
  )
}

export const InlineDiff: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <InlineDiffComponent
        original="The quick brown fox jumps over the lazy dog."
        suggested="The quick red fox leaps over the lazy dog."
        label="Suggested rewrite"
      />
    </div>
  )
}

export const JudgeBracket: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <JudgeBracketComponent contenders={judgeContenders} verdicts={judgeVerdicts} judge="Judge" task="Pick the best answer" />
    </div>
  )
}

export const MemoryGraph: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <MemoryGraphComponent
        agent={{ id: 'coder', name: 'Coder', subtitle: 'Billing agent' }}
        memories={graphMemories}
        tools={graphTools}
        using={['tool2']}
        recalling={['mem2']}
        now={now}
      />
    </div>
  )
}

export const MemoryPanel: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <MemoryPanelComponent memories={panelMemories} categories={['Preferences', 'Work']} />
    </div>
  )
}

export const ParallelAttempts: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ParallelAttemptsComponent attempts={attempts} task="Design the pricing page" />
    </div>
  )
}

export const PermissionRequest: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <PermissionRequestComponent
        agent={{ name: 'Coder', model: 'Opus' }}
        action="run a database migration"
        target="production database"
        toolIcon={<Database className="size-3" />}
        risk="destructive"
        reason="This changes the production schema."
        preview={[
          { id: 'p1', label: 'ALTER TABLE seats', meta: '1 table' },
          { id: 'p2', label: 'Backfill 12k rows', meta: '~30s' }
        ]}
        now={now}
      />
    </div>
  )
}

export const PlanVsActual: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <PlanVsActualComponent steps={planVsSteps} now={62_000} task="Launch pricing page" />
    </div>
  )
}

export const RateLimitPlanner: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <RateLimitPlannerComponent
        limit={6000}
        defaultRuns={plannedRuns}
        now={480}
        checkpoint={{ at: 600, label: 'Noon' }}
      />
    </div>
  )
}

export const ReasoningSummary: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ReasoningSummaryComponent
        steps={reasonSteps}
        models={reasonModels}
        sources={[{ name: 'Docs', detail: 'billing.md' }, { name: 'Blog', detail: 'pricing post' }]}
        sourceCount={6}
        agent={{ id: 'researcher' }}
        defaultOpen
      />
    </div>
  )
}

export const RepoMap: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <RepoMapComponent files={repoFiles} agents={repoAgents} branch="main" />
    </div>
  )
}

export const ReviewCenter: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ReviewCenterComponent items={reviewItems} now={now} reviewed={1} total={4} />
    </div>
  )
}

export const RootCauseTree: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <RootCauseTreeComponent failure={failureTree} />
    </div>
  )
}

export const RunControls: Story = {
  render: () => {
    const [status, setStatus] = useState<'running' | 'stopped'>('running')
    return (
      <div className="w-full max-w-3xl">
        <RunControlsComponent
          agent={{ id: 'coder', name: 'Coder' }}
          prompt="Refactor the checkout flow"
          answer="Working on it…"
          status={status}
          steers={[{ at: 60, text: 'Keep the API stable' }]}
          queue={[{ id: 'q1', text: 'Add tests' }]}
          context={0.62}
          onStop={() => setStatus('stopped')}
          onResume={() => setStatus('running')}
        />
      </div>
    )
  }
}

export const RunningNow: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <RunningNowComponent tasks={runningTasks} defaultOpen align="start" />
    </div>
  )
}

export const ScheduledRuns: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ScheduledRunsComponent
        tasks={scheduledTasks}
        days={['Mon', 'Tue', 'Wed', 'Thu', 'Fri']}
        sessions={['07:00', '12:00', '17:00']}
        now={{ day: 0, session: 0 }}
        limit={100}
        note="Plan the week around a 100% session budget"
      />
    </div>
  )
}

export const ToolAccessMap: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ToolAccessMapComponent agents={mapAgents} tools={accessTools} />
    </div>
  )
}

export const ToolCallCard: Story = {
  render: () => (
    <div className="w-full max-w-3xl space-y-2">
      <ToolCallCardComponent
        name="web.search"
        status="success"
        summary="Found 5 competitor pages"
        args={{ query: 'AI pricing 2026', limit: 5 }}
        result={{ results: 5, top: 'openrouter.ai' }}
        duration={820}
        defaultOpen
      />
      <ToolCallCardComponent
        name="file.patch"
        status="error"
        summary="Patch did not apply"
        args={{ file: 'src/pricing.ts' }}
        error="Hunk #1 failed: context changed"
        duration={240}
      />
      <ToolCallCardComponent name="shell.run" status="running" summary="Running migrations" duration={2400} />
    </div>
  )
}

export const TraceWaterfall: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <TraceWaterfallComponent root={traceRoot} now={12_000} title="Run trace" />
    </div>
  )
}
