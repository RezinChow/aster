import type { Meta, StoryObj } from '@storybook/react'

import type { ApprovalGate } from '../../../src/components/affect/agents/approval-gates'
import type { GraphCall, GraphNode } from '../../../src/components/affect/agents/agent-graph'
import type { AgentTask } from '../../../src/components/affect/agents/agent-inbox'
import type { PlanStep } from '../../../src/components/affect/agents/agent-plan'
import type { CostStep } from '../../../src/components/affect/agents/cost-waterfall'
import type { TraceSpan } from '../../../src/components/affect/agents/trace-waterfall'
import type { TreeAgent } from '../../../src/components/affect/agents/agent-tree'
import {
  AgentGraph,
  AgentInbox,
  AgentPlan,
  AgentTree,
  ApprovalGates,
  CostWaterfall,
  ToolCallCard,
  TraceWaterfall
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Agent runs',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const now = 1_800_000_000_000

const tree: TreeAgent = {
  id: 'lead',
  name: 'Orchestrator',
  task: 'Launch the new pricing page',
  model: 'Opus',
  status: 'running',
  cost: 0.42,
  started: now - 90_000,
  tools: ['repo', 'browser'],
  children: [
    { id: 'research', name: 'Researcher', task: 'Compare five competitors', status: 'done', cost: 0.29, started: now - 80_000, ended: now - 30_000 },
    { id: 'build', name: 'Coder', task: 'Implement the page', status: 'waiting', cost: 0.13, started: now - 60_000, ask: 'Approve the price change' },
    { id: 'qa', name: 'Reviewer', task: 'Check the copy', status: 'queued' }
  ]
}

const tasks: AgentTask[] = [
  { id: 't1', title: 'Change prices in pricing.ts', agent: 'Coder', status: 'waiting', description: 'Approval required before deploy', startedAt: now - 60_000, elapsed: 62_000, tools: 3, sources: 5, steps: [{ label: 'Read pricing.ts', time: '1m ago' }, { label: 'Draft new prices', time: '30s ago' }] },
  { id: 't2', title: 'Compare competitors', agent: 'Researcher', status: 'done', elapsed: 45_000, steps: [{ label: 'Open 5 sites', time: 'done' }] },
  { id: 't3', title: 'Publish launch note', agent: 'Writer', status: 'running', elapsed: 12_000 }
]

const gates: ApprovalGate[] = [
  { id: 'g1', agent: 'Coder', kind: 'tool', action: 'Run the database migration', reason: 'Changes the production schema', status: 'open', at: 'now' },
  { id: 'g2', agent: 'Coder', kind: 'file', action: 'Change prices in pricing.ts', reason: 'Changes what customers pay', status: 'approved', at: '2m ago', diff: [{ file: 'src/billing/pricing.ts', lines: [{ type: 'del', text: 'seat: 8,' }, { type: 'add', text: 'seat: 10,' }] }] },
  { id: 'g3', agent: 'Writer', kind: 'message', action: 'Post to #launch', reason: 'External message', status: 'rejected', at: '5m ago' }
]

const trace: TraceSpan = {
  id: 'run', name: 'Launch pricing page', kind: 'agent', status: 'running', start: now - 10_000, cost: 0.42,
  children: [
    { id: 'plan', name: 'Plan', kind: 'llm', status: 'done', start: now - 10_000, end: now - 8_600, cost: 0.04, model: 'Opus' },
    { id: 'search', name: 'web.search', kind: 'tool', status: 'done', start: now - 8_500, end: now - 6_100, cost: 0, detail: '5 results' },
    { id: 'sub', name: 'Researcher', kind: 'subagent', status: 'done', start: now - 6_000, end: now - 2_000, cost: 0.29,
      children: [
        { id: 'read', name: 'file.read', kind: 'tool', status: 'done', start: now - 5_800, end: now - 5_300 },
        { id: 'think', name: 'Summarize', kind: 'llm', status: 'done', start: now - 5_200, end: now - 2_100, cost: 0.25 }
      ]
    },
    { id: 'edit', name: 'file.patch', kind: 'tool', status: 'running', start: now - 1_800 }
  ]
}

const costs: CostStep[] = [
  { id: 'c1', name: 'Planner', kind: 'llm', status: 'done', model: 'Opus', tokensIn: 4200, tokensOut: 900, cost: 0.06, duration: 1400 },
  { id: 'c2', name: 'Researcher', kind: 'agent', status: 'done', cost: 0.29, duration: 5200,
    children: [
      { id: 'c2a', name: 'web.search', kind: 'tool', status: 'done', cost: 0.01, duration: 900 },
      { id: 'c2b', name: 'GPT-5', kind: 'llm', status: 'done', model: 'GPT-5', tokensIn: 12000, tokensOut: 2400, cost: 0.28, duration: 3800 }
    ]
  },
  { id: 'c3', name: 'Editor', kind: 'llm', status: 'running', model: 'Opus', cost: 0.07, tokensIn: 3000, tokensOut: 1100 }
]

const steps: PlanStep[] = [
  { id: 'p1', title: 'Research competitor pricing', detail: 'Compare five vendors', tool: 'web.search', status: 'done', duration: 20_000 },
  { id: 'p2', title: 'Draft new price table', detail: 'Wait for approval on the price delta', tool: 'file.patch', status: 'running', duration: 38_000 },
  { id: 'p3', title: 'Update pricing page', detail: 'Publish after approval', status: 'queued' }
]

const nodes: GraphNode[] = [
  { id: 'user', name: 'You', kind: 'user', short: 'Y', lead: true },
  { id: 'lead', name: 'Orchestrator', kind: 'agent', status: 'working', doing: 'Planning', cost: 0.12, lead: true },
  { id: 'research', name: 'Researcher', kind: 'agent', status: 'done', doing: 'Compared 5 sites', cost: 0.29 },
  { id: 'coder', name: 'Coder', kind: 'agent', status: 'waiting', doing: 'Needs approval', cost: 0.08 },
  { id: 'search', name: 'web.search', kind: 'tool', short: 'S', status: 'done' },
  { id: 'patch', name: 'file.patch', kind: 'tool', short: 'P', status: 'idle' }
]

const calls: GraphCall[] = [
  { id: 'call1', from: 'user', to: 'lead', at: now, status: 'ok', label: 'request', ms: 40 },
  { id: 'call2', from: 'lead', to: 'research', at: now + 1000, status: 'ok', label: 'delegate', ms: 120 },
  { id: 'call3', from: 'research', to: 'search', at: now + 2000, status: 'ok', label: 'search', ms: 800 },
  { id: 'call4', from: 'lead', to: 'coder', at: now + 3000, status: 'pending', label: 'delegate' },
  { id: 'call5', from: 'coder', to: 'patch', at: now + 4000, status: 'error', label: 'patch', ms: 300 }
]

export const TreeAndInbox: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">AgentTree</h3>
        <div className="rounded-lg border border-border bg-card p-3">
          <AgentTree root={tree} />
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">AgentInbox</h3>
        <AgentInbox tasks={tasks} title="Agent inbox" />
      </section>
    </div>
  )
}

export const ApprovalsAndTools: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">ApprovalGates</h3>
        <ApprovalGates gates={gates} task="Launch the new pricing page" live />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">ToolCallCard</h3>
        <div className="space-y-3">
          <ToolCallCard name="web.search" status="success" summary="Found 5 competitor pages" args={{ query: 'AI pricing 2026', limit: 5 }} result={{ results: 5, top: 'openrouter.ai' }} duration={820} defaultOpen />
          <ToolCallCard name="file.patch" status="error" summary="Patch did not apply" args={{ file: 'src/billing/pricing.ts' }} error="Hunk #1 failed: context changed" duration={240} />
          <ToolCallCard name="shell.run" status="running" summary="Running migrations" startedAt={now - 4000} />
        </div>
      </section>
    </div>
  )
}

export const TracesAndCost: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">TraceWaterfall</h3>
        <TraceWaterfall root={trace} now={now} title="Run trace" />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">CostWaterfall</h3>
        <CostWaterfall steps={costs} task="Launch the new pricing page" title="Cost" />
      </section>
    </div>
  )
}

export const PlanningAndGraph: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">AgentPlan</h3>
        <AgentPlan steps={steps} status="running" estimate="~4 min" title="Plan" />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">AgentGraph</h3>
        <AgentGraph nodes={nodes} calls={calls} now={now + 4000} title="Live graph" />
      </section>
    </div>
  )
}
