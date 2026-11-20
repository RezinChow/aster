import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import type { Checkpoint } from '../../../src/components/affect/agents/agent-checkpoints'
import type { CrewAgent, CrewHandoff } from '../../../src/components/affect/agents/agent-crew'
import type { AgentCursor, DocBlock, DocComment, DocSuggestion, CursorAgent } from '../../../src/components/affect/agents/agent-cursors'
import type { Finding, FindingAgent } from '../../../src/components/affect/agents/agent-findings'
import type { FleetAgent } from '../../../src/components/affect/agents/agent-fleet'
import type { GraphCall, GraphNode } from '../../../src/components/affect/agents/agent-graph'
import type { Handoff, HandoffAgent, HandoffTask } from '../../../src/components/affect/agents/agent-handoff'
import type { AgentTask } from '../../../src/components/affect/agents/agent-inbox'
import type { LaneAgent, LaneTask } from '../../../src/components/affect/agents/agent-lanes'
import type { LedgerEntry } from '../../../src/components/affect/agents/agent-ledger'
import type { AgentRunStep } from '../../../src/components/affect/agents/agent-monitor'
import type { PlanStep } from '../../../src/components/affect/agents/agent-plan'
import type { QueueJob, QueueWorker } from '../../../src/components/affect/agents/agent-queue'
import type { RecapEvent } from '../../../src/components/affect/agents/agent-recap'
import type { RouterAgent, RouterRequest } from '../../../src/components/affect/agents/agent-router'
import type { SeqMessage, SeqParticipant } from '../../../src/components/affect/agents/agent-sequence'
import type { SteerNote, SteerStep } from '../../../src/components/affect/agents/agent-steering'
import type { TimingHandoff, TimingParticipant, TimingSegment } from '../../../src/components/affect/agents/agent-timing'
import type { TrailStep } from '../../../src/components/affect/agents/agent-trail'
import type { TreeAgent } from '../../../src/components/affect/agents/agent-tree'
import type { WorkbenchFile, WorkbenchStep, WorkbenchTool } from '../../../src/components/affect/agents/agent-workbench'
import type { ApprovalGate } from '../../../src/components/affect/agents/approval-gates'
import type { ApprovalStatus } from '../../../src/components/affect/agents/approval-card'
import type { AgentAction, AutonomyLevel } from '../../../src/components/affect/agents/autonomy-dial'
import type { AwayItem } from '../../../src/components/affect/agents/away-summary'
import type { StreamAgent, StreamMessage } from '../../../src/components/affect/agents/collaboration-stream'
import type { CommitAuthor, TrailCommit } from '../../../src/components/affect/agents/commit-trail'
import type { RadarAgent, RadarFile } from '../../../src/components/affect/agents/conflict-radar'
import type { ContextBlock, ContextCompaction } from '../../../src/components/affect/agents/context-map'
import {
  AgentCheckpoints as AgentCheckpointsComponent,
  AgentCrew as AgentCrewComponent,
  AgentCursors as AgentCursorsComponent,
  AgentFindings as AgentFindingsComponent,
  AgentFleet as AgentFleetComponent,
  AgentGraph as AgentGraphComponent,
  AgentHandoff as AgentHandoffComponent,
  AgentInbox as AgentInboxComponent,
  AgentLanes as AgentLanesComponent,
  AgentLedger as AgentLedgerComponent,
  AgentMonitor as AgentMonitorComponent,
  AgentPlan as AgentPlanComponent,
  AgentQueue as AgentQueueComponent,
  AgentRecap as AgentRecapComponent,
  AgentRouter as AgentRouterComponent,
  AgentSequence as AgentSequenceComponent,
  AgentSteering as AgentSteeringComponent,
  AgentTiming as AgentTimingComponent,
  AgentTrail as AgentTrailComponent,
  AgentTree as AgentTreeComponent,
  AgentWorkbench as AgentWorkbenchComponent,
  ApprovalCard as ApprovalCardComponent,
  ApprovalGates as ApprovalGatesComponent,
  AutonomyDial as AutonomyDialComponent,
  AwaySummary as AwaySummaryComponent,
  CollaborationStream as CollaborationStreamComponent,
  CommitTrail as CommitTrailComponent,
  ConflictRadar as ConflictRadarComponent,
  ContextMap as ContextMapComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Agents 1',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const now = 1_800_000_000_000

// ---------------------------------------------------------------------------
// agent-checkpoints
// ---------------------------------------------------------------------------
const checkpoints: Checkpoint[] = [
  { id: 'c1', title: 'Start run', status: 'done', at: 0, cost: 0.02 },
  { id: 'c2', title: 'Read project files', parent: 'c1', status: 'done', at: 4000, files: 3, cost: 0.05 },
  { id: 'c3', title: 'First patch attempt', parent: 'c2', status: 'failed', at: 9000, cost: 0.08 },
  { id: 'c4', title: 'Retry with a guard', parent: 'c2', status: 'done', at: 14000, files: 2, cost: 0.11 },
  { id: 'c5', title: 'Running tests', parent: 'c4', status: 'running', at: 18000, cost: 0.13 }
]

// ---------------------------------------------------------------------------
// agent-crew
// ---------------------------------------------------------------------------
const crewRoot: CrewAgent = {
  id: 'lead',
  name: 'Orchestrator',
  model: 'Claude Opus',
  status: 'active',
  activity: 'Assigning the patch',
  context: 0.29,
  contextLimit: 200_000,
  task: 'Fix the checkout crash',
  cost: 0.12,
  started: now - 120_000,
  children: [
    { id: 'research', name: 'Researcher', status: 'done', activity: 'Found the cause', context: 0.52, cost: 0.29, started: now - 110_000, ended: now - 60_000 },
    {
      id: 'coder',
      name: 'Coder',
      status: 'active',
      activity: 'Editing cart.ts',
      context: 0.38,
      cost: 0.08,
      started: now - 90_000,
      last: { from: 'Lead', text: 'Guard empty carts' },
      tools: [{ name: 'repo' }, { name: 'shell' }],
      children: [{ id: 'lint', name: 'Linter', status: 'idle', activity: 'Idle' }]
    },
    { id: 'reviewer', name: 'Reviewer', status: 'waiting', activity: 'Needs approval', context: 0.12, cost: 0.03, started: now - 30_000, last: { from: 'Coder', text: 'Approve the patch' } }
  ]
}
const crewHandoffs: CrewHandoff[] = [{ id: 'h1', from: 'lead', to: 'coder', label: 'patch the guard' }]

// ---------------------------------------------------------------------------
// agent-cursors
// ---------------------------------------------------------------------------
const cursorAgents: CursorAgent[] = [
  { id: 'writer', name: 'Writer', cost: 0.04 },
  { id: 'editor', name: 'Editor', cost: 0.02 }
]
const docBlocks: DocBlock[] = [
  { id: 'b1', kind: 'title', text: 'Release notes' },
  { id: 'b2', kind: 'paragraph', text: 'This release adds a new checkout flow.' },
  { id: 'b3', kind: 'heading', text: 'Highlights' },
  { id: 'b4', kind: 'item', text: 'Faster page loads' },
  { id: 'b5', kind: 'code', text: 'npm run release' }
]
const docCursors: Record<string, AgentCursor> = {
  writer: { block: 'b2', doing: 'Rewriting the summary', typing: true },
  editor: { block: 'b4', doing: 'Polishing the list' }
}
const docSuggestions: DocSuggestion[] = [
  { id: 's1', agent: 'writer', block: 'b2', insert: ' and smarter retries', note: 'Mention the retry feature.' },
  { id: 's2', agent: 'editor', block: 'b4', insert: ' and clearer errors', note: 'Add error handling highlight.' }
]
const docComments: DocComment[] = [
  { id: 'cm1', agent: 'editor', block: 'b3', text: 'Keep this section short', open: true }
]

// ---------------------------------------------------------------------------
// agent-findings
// ---------------------------------------------------------------------------
const findingAgents: FindingAgent[] = [
  { id: 'types', name: 'Type checker', model: 'Opus', step: 'Scanning src/', done: 8, total: 10, status: 'running' },
  { id: 'security', name: 'Security', step: 'Auditing dependencies', done: 6, total: 6, status: 'done' },
  { id: 'lint', name: 'Linter', step: 'Stopped on errors', done: 2, total: 8, status: 'failed' }
]
const findings: Finding[] = [
  { id: 'f1', agentId: 'types', title: 'Unchecked null in cart.ts', severity: 'critical', location: 'src/cart.ts:42', at: now - 60_000 },
  { id: 'f2', agentId: 'security', title: 'Outdated dependency', severity: 'warning', location: 'package.json', at: now - 120_000 },
  { id: 'f3', agentId: 'types', title: 'Prefer const over let', severity: 'note', location: 'src/ui.ts:8', at: now - 30_000 },
  { id: 'f4', agentId: 'lint', title: 'Formatting drift', severity: 'note', at: now - 20_000 }
]

// ---------------------------------------------------------------------------
// agent-fleet
// ---------------------------------------------------------------------------
const fleetAgents: FleetAgent[] = [
  {
    id: 'lead',
    name: 'Orchestrator',
    task: 'Ship the release',
    status: 'running',
    model: 'Opus',
    cost: 0.12,
    started: now - 120_000,
    children: [
      {
        id: 'writer',
        name: 'Writer',
        task: 'Draft the notes',
        status: 'done',
        cost: 0.04,
        started: now - 100_000,
        ended: now - 60_000,
        steps: [
          { title: 'Read the diff', status: 'done', took: 1200 },
          { title: 'Write notes', status: 'done', tool: 'file.patch', took: 3400 }
        ]
      },
      { id: 'reviewer', name: 'Reviewer', task: 'Approve the release', status: 'waiting', cost: 0.02, started: now - 40_000, ask: 'Approve publishing to npm' }
    ]
  },
  {
    id: 'qa',
    name: 'QA bot',
    task: 'Run the test suite',
    status: 'failed',
    model: 'GPT-5',
    cost: 0.09,
    started: now - 90_000,
    ended: now - 50_000,
    error: '3 tests failed',
    children: [{ id: 'flaky', name: 'Flaky test retry', task: 'Retry suite', status: 'stopped', cost: 0.01, steps: [{ title: 'Retry', status: 'failed', took: 500 }] }]
  }
]

// ---------------------------------------------------------------------------
// agent-graph
// ---------------------------------------------------------------------------
const graphNodes: GraphNode[] = [
  { id: 'user', name: 'You', kind: 'user', short: 'Y' },
  { id: 'lead', name: 'Orchestrator', kind: 'agent', status: 'working', doing: 'Planning', cost: 0.12, lead: true },
  { id: 'research', name: 'Researcher', kind: 'agent', status: 'done', doing: 'Compared 5 sites', cost: 0.29 },
  { id: 'coder', name: 'Coder', kind: 'agent', status: 'waiting', doing: 'Needs approval', cost: 0.08 },
  { id: 'search', name: 'web.search', kind: 'tool', short: 'S', status: 'done' },
  { id: 'patch', name: 'file.patch', kind: 'tool', short: 'P', status: 'error' }
]
const graphCalls: GraphCall[] = [
  { id: 'call1', from: 'user', to: 'lead', at: now, status: 'ok', label: 'request', ms: 40 },
  { id: 'call2', from: 'lead', to: 'research', at: now + 1000, status: 'ok', label: 'delegate', ms: 120 },
  { id: 'call3', from: 'lead', to: 'coder', at: now + 2000, status: 'pending', label: 'delegate' },
  { id: 'call4', from: 'coder', to: 'patch', at: now + 3000, status: 'error', label: 'patch', ms: 300 }
]

// ---------------------------------------------------------------------------
// agent-handoff
// ---------------------------------------------------------------------------
const handoffAgents: HandoffAgent[] = [
  { id: 'lead', name: 'Lead', model: 'Opus', description: 'Coordinates the run' },
  { id: 'research', name: 'Researcher', model: 'Sonnet' },
  { id: 'coder', name: 'Coder', model: 'Opus' }
]
const handoffs: Handoff[] = [
  {
    id: 'ho1',
    from: 'lead',
    to: 'research',
    task: 'Find the root cause',
    items: [
      { id: 'i1', label: 'cart.ts', kind: 'file' },
      { id: 'i2', label: 'Error appears after v2.3', kind: 'fact' },
      { id: 'i3', label: 'Original stack trace', kind: 'source', lost: true, why: 'Trimmed to save context' }
    ]
  },
  {
    id: 'ho2',
    from: 'research',
    to: 'coder',
    task: 'Patch the guard',
    items: [{ id: 'i4', label: 'Guard empty carts', kind: 'decision' }]
  }
]
const handoffTasks: HandoffTask[] = [
  { id: 'ht1', title: 'Write a regression test', status: 'todo' },
  { id: 'ht2', title: 'Fix the checkout crash', status: 'done', agent: 'coder' },
  { id: 'ht3', title: 'Verify the fix', status: 'working', agent: 'research' }
]

// ---------------------------------------------------------------------------
// agent-inbox
// ---------------------------------------------------------------------------
const inboxTasks: AgentTask[] = [
  {
    id: 't1',
    title: 'Change prices in pricing.ts',
    agent: 'Coder',
    status: 'waiting',
    description: 'Approval required before deploy',
    startedAt: now - 60_000,
    elapsed: 62_000,
    tools: 3,
    sources: 5,
    steps: [{ label: 'Read pricing.ts', time: '1m ago' }, { label: 'Draft new prices', time: '30s ago' }]
  },
  { id: 't2', title: 'Compare competitors', agent: 'Researcher', status: 'running', elapsed: 45_000, steps: [{ label: 'Open 5 sites', time: 'just now' }] },
  { id: 't3', title: 'Publish launch note', agent: 'Writer', status: 'done', elapsed: 12_000 },
  { id: 't4', title: 'Migrate the database', agent: 'Coder', status: 'failed', elapsed: 8_000, steps: [{ label: 'Run migration', time: 'failed' }] }
]

// ---------------------------------------------------------------------------
// agent-lanes
// ---------------------------------------------------------------------------
const laneAgents: LaneAgent[] = [
  { id: 'lead', name: 'Orchestrator', model: 'Opus' },
  { id: 'research', name: 'Researcher', model: 'Sonnet' },
  { id: 'coder', name: 'Coder', model: 'Opus' }
]
const laneTasks: LaneTask[] = [
  { id: 'l1', agentId: 'lead', title: 'Plan the release', status: 'done', start: now - 1_500_000, end: now - 1_300_000, summary: 'Split into three steps', tools: ['plan'] },
  { id: 'l2', agentId: 'lead', title: 'Coordinate handoffs', status: 'running', start: now - 600_000, end: now },
  { id: 'l3', agentId: 'research', title: 'Compare vendors', status: 'done', start: now - 1_400_000, end: now - 900_000, handoffTo: 'Coder', summary: 'Five vendors compared' },
  { id: 'l4', agentId: 'coder', title: 'Apply price change', status: 'waiting', start: now - 300_000, end: now, ask: 'Approve the price delta', tools: ['file.patch', 'shell.run'] }
]

// ---------------------------------------------------------------------------
// agent-ledger
// ---------------------------------------------------------------------------
const ledgerEntries: LedgerEntry[] = [
  { id: 'e1', action: 'Read pricing.ts', system: 'file', at: now - 240_000, target: 'src/billing/pricing.ts' },
  { id: 'e2', action: 'Change seat price', system: 'file', at: now - 180_000, target: 'src/billing/pricing.ts', change: ['seat: 8,', 'seat: 10,'], dependsOn: ['e1'] },
  { id: 'e3', action: 'Commit changes', system: 'git', at: now - 120_000, target: 'main', reversible: false, dependsOn: ['e2'] },
  { id: 'e4', action: 'Send Slack note', system: 'slack', at: now - 60_000, target: '#launch', detail: 'Announced the price change' }
]

// ---------------------------------------------------------------------------
// agent-monitor
// ---------------------------------------------------------------------------
const monitorSteps: AgentRunStep[] = [
  { id: 'm1', label: 'Read cart.ts', state: 'done', kind: 'read', tool: 'file.read', took: 800 },
  { id: 'm2', label: 'Search usages', state: 'done', kind: 'search', tool: 'grep', took: 1200 },
  { id: 'm3', label: 'Apply patch', state: 'running', kind: 'edit', tool: 'file.patch', since: now - 4000 },
  { id: 'm4', label: 'Run tests', state: 'queued', kind: 'run' }
]

// ---------------------------------------------------------------------------
// agent-plan
// ---------------------------------------------------------------------------
const planSteps: PlanStep[] = [
  { id: 'p1', title: 'Research competitor pricing', detail: 'Compare five vendors', tool: 'web.search', status: 'done', duration: 20_000 },
  { id: 'p2', title: 'Draft new price table', detail: 'Wait for approval on the price delta', tool: 'file.patch', status: 'running', duration: 38_000 },
  { id: 'p3', title: 'Update pricing page', detail: 'Publish after approval', status: 'queued' }
]

// ---------------------------------------------------------------------------
// agent-queue
// ---------------------------------------------------------------------------
const allQueueWorkers: QueueWorker[] = [
  { id: 'w1', name: 'LLM slot A', detail: 'ready' },
  { id: 'w2', name: 'LLM slot B', detail: 'ready' },
  { id: 'w3', name: 'Tool runner', detail: 'ready' },
  { id: 'w4', name: 'LLM slot C', detail: 'ready' },
  { id: 'w5', name: 'Tool runner 2', detail: 'ready' }
]
const queueJobs: QueueJob[] = [
  { id: 'q1', name: 'Draft summary', kind: 'llm', status: 'running', enqueuedAt: now - 60_000, startedAt: now - 40_000, worker: 'w1', progress: 0.6, priority: 'high' },
  { id: 'q2', name: 'Run test suite', kind: 'tool', status: 'running', enqueuedAt: now - 50_000, startedAt: now - 30_000, worker: 'w2', progress: 0.35 },
  { id: 'q3', name: 'Review PR', kind: 'agent', status: 'queued', enqueuedAt: now - 20_000, priority: 'normal', estimate: 30_000 },
  { id: 'q4', name: 'Send email', kind: 'human', status: 'queued', enqueuedAt: now - 10_000, priority: 'low' },
  { id: 'q5', name: 'Fetch docs', kind: 'tool', status: 'done', enqueuedAt: now - 120_000, startedAt: now - 110_000, endedAt: now - 100_000, worker: 'w3' },
  { id: 'q6', name: 'Deploy', kind: 'agent', status: 'failed', enqueuedAt: now - 300_000, startedAt: now - 290_000, endedAt: now - 280_000, error: 'Build failed', attempt: 2, maxAttempts: 3 }
]

// ---------------------------------------------------------------------------
// agent-recap
// ---------------------------------------------------------------------------
const recapEvents: RecapEvent[] = [
  { id: 'r1', at: now - 300_000, kind: 'done', title: 'Research complete', detail: 'Compared five vendors', count: 5 },
  { id: 'r2', at: now - 180_000, kind: 'needs', title: 'Approve the price change', detail: 'Waiting on you before deploy' },
  { id: 'r3', at: now - 120_000, kind: 'failed', title: 'Migration failed', detail: 'Deadlock on the users table', action: 'Retry', doneLabel: 'Fixed' },
  { id: 'r4', at: now - 60_000, kind: 'done', title: 'Notes drafted', detail: 'Release notes are ready' },
  { id: 'r5', at: now - 30_000, kind: 'needs', title: 'Pick a design', detail: 'Two options to choose from' }
]

// ---------------------------------------------------------------------------
// agent-router
// ---------------------------------------------------------------------------
const routerAgent: RouterAgent = { id: 'router', name: 'Triage', model: 'Opus', activity: 'Sorting requests' }
const routerAgents: RouterAgent[] = [
  { id: 'sales', name: 'Sales', model: 'Sonnet', status: 'active', activity: 'Answering pricing', load: 0.4, queue: 2 },
  { id: 'support', name: 'Support', model: 'Opus', status: 'active', activity: 'Fixing bugs', load: 0.7 },
  { id: 'human', name: 'You', human: true, activity: 'Escalations' }
]
const routerRequests: RouterRequest[] = [
  { id: 'rq1', title: 'What are your prices?', status: 'routed', from: 'web@example.com', channel: 'email', preview: 'Could you send the pricing tiers?', to: 'sales', confidence: 0.94, scores: { sales: 0.94, support: 0.21 }, tags: ['pricing', 'inbound'] },
  { id: 'rq2', title: 'Checkout throws 500', status: 'routing', from: 'sam@acme.com', channel: 'chat', preview: 'Every time I click pay', confidence: 0.61, reason: 'Looks like a bug' },
  { id: 'rq3', title: 'Cancel my subscription', status: 'escalated', from: 'anna@acme.com', channel: 'ticket', to: 'human', confidence: 0.48, reason: 'Cancellation needs a person' },
  { id: 'rq4', title: 'Feature request: dark mode', status: 'new', from: 'li@acme.com', channel: 'slack', preview: 'Please add dark mode', tags: [{ label: 'feature' }] }
]

// ---------------------------------------------------------------------------
// agent-sequence
// ---------------------------------------------------------------------------
const seqParticipants: SeqParticipant[] = [
  { id: 'you', name: 'You', kind: 'person' },
  { id: 'lead', name: 'Orchestrator', kind: 'agent', model: 'Opus' },
  { id: 'coder', name: 'Coder', kind: 'agent', model: 'Sonnet' },
  { id: 'tools', name: 'Tools', kind: 'tool' }
]
const seqMessages: SeqMessage[] = [
  { id: 'sm1', from: 'you', to: 'lead', label: 'Fix the crash', at: 0, kind: 'call' },
  { id: 'sm2', from: 'lead', to: 'coder', label: 'Delegate patch', at: 1200, kind: 'call', frame: 'Plan' },
  { id: 'sm3', from: 'coder', to: 'tools', label: 'file.read', at: 2400, kind: 'call', frame: 'Work' },
  { id: 'sm4', from: 'tools', to: 'coder', label: 'contents', at: 3200, kind: 'reply', frame: 'Work' },
  { id: 'sm5', from: 'coder', to: 'lead', label: 'Patched', at: 5000, kind: 'reply', detail: 'Added a null guard in cart.ts' },
  { id: 'sm6', from: 'lead', to: 'you', label: 'Done', at: 6200, kind: 'reply' }
]

// ---------------------------------------------------------------------------
// agent-steering
// ---------------------------------------------------------------------------
const steerSteps: SteerStep[] = [
  { id: 'st1', title: 'Read the repository', status: 'done', duration: 12_000 },
  { id: 'st2', title: 'Draft the migration', status: 'active', startedAt: now - 8_000 },
  { id: 'st3', title: 'Run tests', status: 'pending' }
]
const steerQueue: SteerNote[] = [{ id: 'n1', text: 'Please keep the migration reversible', picked: 'next' }]

// ---------------------------------------------------------------------------
// agent-timing
// ---------------------------------------------------------------------------
const timingParticipants: TimingParticipant[] = [
  { id: 'you', name: 'You', kind: 'person' },
  { id: 'lead', name: 'Orchestrator', kind: 'agent' },
  { id: 'coder', name: 'Coder', kind: 'agent' }
]
const timingSegments: TimingSegment[] = [
  { id: 'ts1', who: 'you', state: 'idle', start: 0, end: 2, label: 'Request' },
  { id: 'ts2', who: 'lead', state: 'thinking', start: 2, end: 6, label: 'Plan' },
  { id: 'ts3', who: 'lead', state: 'waiting', start: 6, end: 9, label: 'Approval' },
  { id: 'ts4', who: 'coder', state: 'tool', start: 9, end: 15, label: 'file.patch' },
  { id: 'ts5', who: 'coder', state: 'thinking', start: 15, end: 20, label: 'Review diff' },
  { id: 'ts6', who: 'lead', state: 'idle', start: 20, end: 24, label: 'Wrap up' }
]
const timingHandoffs: TimingHandoff[] = [
  { id: 'th1', from: 'you', to: 'lead', at: 2, label: 'request' },
  { id: 'th2', from: 'lead', to: 'coder', at: 9, label: 'patch' }
]

// ---------------------------------------------------------------------------
// agent-trail
// ---------------------------------------------------------------------------
const trailSteps: TrailStep[] = [
  { id: 'tr1', title: 'Read the diff', state: 'done', duration: 1200 },
  {
    id: 'tr2',
    title: 'Apply patch',
    state: 'done',
    duration: 3400,
    substeps: [
      { title: 'Open cart.ts', state: 'done', detail: '2.1k tokens' },
      { title: 'Write patch', state: 'done', detail: '18 lines' }
    ]
  },
  {
    id: 'tr3',
    title: 'Run migrations',
    state: 'running',
    startedAt: now - 5000,
    substeps: [
      { title: 'Connect to db', state: 'done' },
      { title: 'Migrate users', state: 'running' }
    ]
  },
  { id: 'tr4', title: 'Deploy to production', state: 'waiting', gate: true, substeps: [{ title: 'Needs your approval', state: 'waiting' }] },
  { id: 'tr5', title: 'Notify the team', state: 'pending' }
]

// ---------------------------------------------------------------------------
// agent-workbench
// ---------------------------------------------------------------------------
const benchTools: WorkbenchTool[] = [
  { id: 'repo', name: 'Repository', scope: 'read/write', last: 'cart.ts', when: '2m ago' },
  { id: 'shell', name: 'Shell', scope: 'sandboxed', last: 'npm test', when: '1m ago' },
  { id: 'web', name: 'Web', scope: 'read only', last: 'docs', when: '5m ago' }
]
const benchFiles: WorkbenchFile[] = [
  { id: 'cart', name: 'src/cart.ts', meta: 'edited' },
  { id: 'pricing', name: 'src/pricing.ts', meta: 'read' },
  { id: 'test', name: 'tests/cart.test.ts', meta: 'read' }
]
const benchSteps: WorkbenchStep[] = [
  { id: 'bs1', text: 'Read the request', at: 'just now' },
  { id: 'bs2', text: 'Locate the cart code', at: '1m ago' },
  { id: 'bs3', text: 'Draft the fix', at: '30s ago', running: true }
]

// ---------------------------------------------------------------------------
// approval-gates
// ---------------------------------------------------------------------------
const approvalGates: ApprovalGate[] = [
  { id: 'g1', agent: 'Coder', kind: 'tool', action: 'Run the database migration', reason: 'Changes the production schema', status: 'open', at: 'now', input: 'npx prisma migrate deploy' },
  {
    id: 'g2',
    agent: 'Coder',
    kind: 'file',
    action: 'Change prices in pricing.ts',
    reason: 'Changes what customers pay',
    status: 'approved',
    at: '2m ago',
    diff: [{ file: 'src/billing/pricing.ts', lines: [{ type: 'del', text: 'seat: 8,' }, { type: 'add', text: 'seat: 10,' }] }]
  },
  { id: 'g3', agent: 'Writer', kind: 'message', action: 'Post to #launch', reason: 'External message', status: 'rejected', at: '5m ago' }
]

// ---------------------------------------------------------------------------
// autonomy-dial
// ---------------------------------------------------------------------------
const autonomyActions: AgentAction[] = [
  { id: 'read', label: 'Read files', risk: 'safe', detail: 'Clone and inspect the repo' },
  { id: 'patch', label: 'Edit files', risk: 'risky', detail: 'Write code changes' },
  { id: 'deploy', label: 'Deploy to production', risk: 'destructive', detail: 'Push to the live site' }
]

// ---------------------------------------------------------------------------
// away-summary
// ---------------------------------------------------------------------------
const awayItems: AwayItem[] = [
  { id: 'aw1', title: 'Approve the price change', kind: 'needs-you', detail: 'Waiting on you before deploy' },
  { id: 'aw2', title: 'Migration failed', kind: 'failed', detail: 'Deadlock on the users table' },
  { id: 'aw3', title: 'Research complete', kind: 'done', detail: 'Compared five vendors' },
  { id: 'aw4', title: 'Release notes drafted', kind: 'done', action: false },
  { id: 'aw5', title: 'Pick a design option', kind: 'needs-you' },
  { id: 'aw6', title: 'Flaky test retried', kind: 'done' }
]

// ---------------------------------------------------------------------------
// collaboration-stream
// ---------------------------------------------------------------------------
const streamAgents: StreamAgent[] = [
  { id: 'lead', name: 'Lead', model: 'Opus' },
  { id: 'research', name: 'Researcher', model: 'Sonnet' },
  { id: 'coder', name: 'Coder', model: 'Opus' }
]
const streamMessages: StreamMessage[] = [
  { id: 'cm1', from: 'you', to: 'lead', kind: 'ask', text: 'Please fix the checkout crash.', at: '09:00' },
  { id: 'cm2', from: 'lead', to: 'research', kind: 'handoff', text: 'Find the root cause.', at: '09:01', details: { facts: ['Happens with empty carts'], items: ['Check cart.ts'] } },
  { id: 'cm3', from: 'research', to: 'lead', kind: 'reply', text: 'Found it — null deref in cart.ts.', at: '09:04', replyTo: 'lead', attachments: [{ label: 'cart.ts', kind: 'text/typescript', meta: '18 lines' }] },
  { id: 'cm4', from: 'lead', to: 'coder', kind: 'handoff', text: 'Patch the guard.', at: '09:05' },
  { id: 'cm5', from: 'coder', to: 'all', kind: 'share', text: 'Patch is in, tests pass.', at: '09:09' },
  { id: 'cm6', from: 'lead', to: 'you', kind: 'question', text: 'Approve the deploy?', at: '09:10' }
]

// ---------------------------------------------------------------------------
// commit-trail
// ---------------------------------------------------------------------------
const humanAuthor: CommitAuthor = { name: 'Dana' }
const botAuthor: CommitAuthor = { name: 'Coder', agent: true }
const commitTrail: TrailCommit[] = [
  { id: 'ct1', message: 'Add null guard for empty carts', author: botAuthor, coAuthor: humanAuthor, time: now - 60_000, files: 2, added: 18, removed: 3, tag: 'fix' },
  {
    id: 'ct2',
    message: 'Merge branch feature/pricing',
    author: humanAuthor,
    time: now - 300_000,
    commits: [
      { id: 'ct2a', message: 'Update seat price', author: botAuthor, time: now - 400_000 },
      { id: 'ct2b', message: 'Tweak the pricing copy', author: humanAuthor, time: now - 350_000 }
    ]
  },
  { id: 'ct3', message: 'Refactor the cart totals', author: humanAuthor, time: now - 900_000, files: 4, added: 120, removed: 88, body: 'Prepares for the new guard.' },
  { id: 'ct4', message: 'Running final checks', author: botAuthor, pending: true }
]

// ---------------------------------------------------------------------------
// conflict-radar
// ---------------------------------------------------------------------------
const radarAgents: RadarAgent[] = [
  { id: 'coder', name: 'Coder', model: 'Opus', status: 'done' },
  { id: 'reviewer', name: 'Reviewer', model: 'Sonnet', status: 'done' },
  { id: 'writer', name: 'Writer', model: 'Opus', status: 'done' }
]
const radarFiles: RadarFile[] = [
  {
    path: 'src/cart.ts',
    edits: [
      { agentId: 'coder', lines: [10, 24], summary: 'Add empty-cart guard' },
      { agentId: 'reviewer', lines: [18, 30], summary: 'Rename total helper' }
    ]
  },
  { path: 'src/pricing.ts', edits: [{ agentId: 'writer', lines: [4, 12], summary: 'Update copy' }] },
  { path: 'README.md', edits: [{ agentId: 'writer', lines: [1, 8], active: true, summary: 'Drafting release notes' }] }
]

// ---------------------------------------------------------------------------
// context-map
// ---------------------------------------------------------------------------
const contextBlocks: ContextBlock[] = [
  { id: 'sys', label: 'System prompt', kind: 'system', tokens: 1200, detail: 'Rules and persona' },
  { id: 'tools', label: 'Tool definitions', kind: 'tools', tokens: 3400, detail: 'Six tools', items: [{ label: 'repo' }, { label: 'shell' }] },
  { id: 'mem', label: 'Memory', kind: 'memory', tokens: 2100, detail: 'Relevant notes' },
  { id: 'file', label: 'cart.ts', kind: 'file', tokens: 4800, detail: '2.1k lines' },
  { id: 'chat', label: 'Conversation', kind: 'chat', tokens: 6200, detail: '14 turns' },
  { id: 'res', label: 'Tool results', kind: 'result', tokens: 3100, detail: 'grep, read' },
  { id: 'sum', label: 'Summary', kind: 'summary', tokens: 900, detail: 'Compacted history' }
]
const contextCompaction: ContextCompaction = {
  before: [...contextBlocks, { id: 'old', label: 'Old logs', kind: 'result', tokens: 5200 }],
  summarized: ['chat', 'res'],
  dropped: ['old'],
  summary: 'Compacted 12k tokens of old tool logs'
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const AgentCheckpoints: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentCheckpointsComponent checkpoints={checkpoints} head="c5" task="Fix the checkout crash" onRewind={() => {}} />
    </div>
  )
}

export const AgentCrew: Story = {
  render: () => {
    const [last, setLast] = useState<string | null>(null)
    return (
      <div className="w-full max-w-3xl space-y-2">
        <AgentCrewComponent
          root={crewRoot}
          handoffs={crewHandoffs}
          title="Fix the checkout crash"
          onSteer={(agent, action) => setLast(`${agent.name}: ${action}`)}
        />
        {last ? <p className="text-[11px] text-muted-foreground">Last steer: {last}</p> : null}
      </div>
    )
  }
}

export const AgentCursors: Story = {
  render: () => {
    const [suggestions, setSuggestions] = useState(docSuggestions)
    return (
      <div className="w-full max-w-3xl">
        <AgentCursorsComponent
          agents={cursorAgents}
          blocks={docBlocks}
          cursors={docCursors}
          suggestions={suggestions}
          comments={docComments}
          title="Release notes"
          onAccept={(suggestion) => setSuggestions((list) => list.filter((item) => item.id !== suggestion.id))}
          onReject={(suggestion) => setSuggestions((list) => list.filter((item) => item.id !== suggestion.id))}
          onAcceptAll={() => setSuggestions([])}
        />
      </div>
    )
  }
}

export const AgentFindings: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentFindingsComponent agents={findingAgents} findings={findings} now={now} title="Verification" />
    </div>
  )
}

export const AgentFleet: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentFleetComponent agents={fleetAgents} now={now} defaultOpen="lead" title="Agent fleet" onResolve={() => {}} />
    </div>
  )
}

export const AgentGraph: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentGraphComponent nodes={graphNodes} calls={graphCalls} now={now + 3000} title="Live graph" height={360} />
    </div>
  )
}

export const AgentHandoff: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentHandoffComponent agents={handoffAgents} handoffs={handoffs} tasks={handoffTasks} />
    </div>
  )
}

export const AgentInbox: Story = {
  render: () => {
    const [tasks, setTasks] = useState(inboxTasks)
    const setStatus = (id: string, status: AgentTask['status']) =>
      setTasks((list) => list.map((task) => (task.id === id ? { ...task, status } : task)))
    return (
      <div className="w-full max-w-3xl">
        <AgentInboxComponent
          tasks={tasks}
          title="Agent inbox"
          onApprove={(task) => setStatus(task.id, 'running')}
          onReject={(task) => setStatus(task.id, 'failed')}
          onRetry={(task) => setStatus(task.id, 'running')}
        />
      </div>
    )
  }
}

export const AgentLanes: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentLanesComponent agents={laneAgents} tasks={laneTasks} now={now} title="Agent lanes" onApprove={() => {}} onReject={() => {}} />
    </div>
  )
}

export const AgentLedger: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentLedgerComponent entries={ledgerEntries} agent="Coder" now={now} title="Ledger" />
    </div>
  )
}

export const AgentMonitor: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentMonitorComponent
        state="running"
        agent={{ name: 'Coder', role: 'Fix the checkout crash', mark: 'C' }}
        steps={monitorSteps}
        since={now - 30_000}
        until={now}
        cost={0.18}
        onPause={() => {}}
        onCancel={() => {}}
        onOpenLog={() => {}}
      />
    </div>
  )
}

export const AgentPlan: Story = {
  render: () => {
    const [steps, setSteps] = useState(planSteps)
    return (
      <div className="w-full max-w-3xl">
        <AgentPlanComponent steps={steps} status="draft" title="Pricing update" estimate="~4 min" onChange={setSteps} onRun={() => {}} onCancel={() => {}} />
      </div>
    )
  }
}

export const AgentQueue: Story = {
  render: () => {
    const [paused, setPaused] = useState(false)
    const [workerCount, setWorkerCount] = useState(3)
    return (
      <div className="w-full max-w-3xl">
        <AgentQueueComponent
          jobs={queueJobs}
          workers={allQueueWorkers.slice(0, workerCount)}
          now={now}
          paused={paused}
          onPausedChange={setPaused}
          onConcurrencyChange={setWorkerCount}
          minConcurrency={1}
          maxConcurrency={5}
          title="Queue"
          name="Build jobs"
        />
      </div>
    )
  }
}

export const AgentRecap: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentRecapComponent events={recapEvents} since={now - 3_600_000} until={now} onAction={() => {}} />
    </div>
  )
}

export const AgentRouter: Story = {
  render: () => {
    const [requests, setRequests] = useState(routerRequests)
    return (
      <div className="w-full max-w-3xl">
        <AgentRouterComponent
          router={routerAgent}
          agents={routerAgents}
          requests={requests}
          title="Request router"
          onReroute={(request, agentId) =>
            setRequests((list) => list.map((item) => (item.id === request.id ? { ...item, to: agentId, status: 'routed' as const } : item)))
          }
        />
      </div>
    )
  }
}

export const AgentSequence: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentSequenceComponent participants={seqParticipants} messages={seqMessages} title="Run sequence" times />
    </div>
  )
}

export const AgentSteering: Story = {
  render: () => {
    const [queue, setQueue] = useState(steerQueue)
    return (
      <div className="w-full max-w-3xl">
        <AgentSteeringComponent
          title="Migration"
          agent="Coder"
          steps={steerSteps}
          queue={queue}
          status="running"
          startedAt={now - 30_000}
          onQueue={(text) => setQueue((list) => [...list, { id: `n-${Date.now()}`, text }])}
          onInterrupt={(text, queuedId) =>
            setQueue((list) => [...list.filter((note) => note.id !== queuedId), { id: `n-${Date.now()}`, text: `Now: ${text}` }])
          }
          onRemove={(id) => setQueue((list) => list.filter((note) => note.id !== id))}
        />
      </div>
    )
  }
}

export const AgentTiming: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentTimingComponent participants={timingParticipants} segments={timingSegments} handoffs={timingHandoffs} now={12} duration={26} title="Timing" />
    </div>
  )
}

export const AgentTrail: Story = {
  render: () => {
    const [steps, setSteps] = useState(trailSteps)
    return (
      <div className="w-full max-w-3xl">
        <AgentTrailComponent
          steps={steps}
          title="Release steps"
          agent={{ name: 'Coder' }}
          onApprove={(step) => setSteps((list) => list.map((item) => (item.id === step.id ? { ...item, state: 'done' as const } : item)))}
          onDecline={(step) => setSteps((list) => list.map((item) => (item.id === step.id ? { ...item, state: 'declined' as const } : item)))}
        />
      </div>
    )
  }
}

export const AgentWorkbench: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentWorkbenchComponent
        user={{ name: 'Dana', message: 'The checkout crashes with an empty cart. Can you fix it?' }}
        agent={{ id: 'coder', name: 'Coder', subtitle: 'Fixing the checkout crash' }}
        tools={benchTools}
        files={benchFiles}
        steps={benchSteps}
        reading="cart"
      />
    </div>
  )
}

export const ApprovalCard: Story = {
  render: () => {
    const [status, setStatus] = useState<ApprovalStatus>('pending')
    return (
      <div className="w-full max-w-3xl">
        <ApprovalCardComponent
          title="Deploy to production"
          description="Publish the price change to all customers"
          risk="high"
          status={status}
          details={[{ label: 'Command', value: 'npm run deploy' }, { label: 'Target', value: 'production' }]}
          onApprove={() => setStatus('approved')}
          onDeny={() => setStatus('denied')}
          onEdit={() => {}}
        />
      </div>
    )
  }
}

export const ApprovalGates: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ApprovalGatesComponent gates={approvalGates} task="Launch the new pricing page" live onDecide={() => {}} />
    </div>
  )
}

export const AutonomyDial: Story = {
  render: () => {
    const [level, setLevel] = useState<AutonomyLevel>(1)
    const [pinned, setPinned] = useState<string[]>(['deploy'])
    return (
      <div className="w-full max-w-3xl">
        <AutonomyDialComponent actions={autonomyActions} level={level} pinned={pinned} onLevelChange={setLevel} onPinnedChange={setPinned} />
      </div>
    )
  }
}

export const AwaySummary: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AwaySummaryComponent since={now - 1_800_000} now={now} items={awayItems} onAction={() => {}} />
    </div>
  )
}

export const CollaborationStream: Story = {
  render: () => {
    const [messages, setMessages] = useState(streamMessages)
    return (
      <div className="w-full max-w-3xl">
        <CollaborationStreamComponent
          agents={streamAgents}
          messages={messages}
          task="Fix the checkout crash"
          live
          onSend={({ text, to, replyTo }) =>
            setMessages((list) => [
              ...list,
              { id: `cm-${Date.now()}`, from: 'you', to: to[0] ?? 'all', kind: 'ask', text, at: 'now', replyTo }
            ])
          }
        />
      </div>
    )
  }
}

export const CommitTrail: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <CommitTrailComponent commits={commitTrail} branches={['main', 'feature/pricing']} defaultBranch="main" hasMore title="Commit history" />
    </div>
  )
}

export const ConflictRadar: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ConflictRadarComponent agents={radarAgents} files={radarFiles} onResolve={() => {}} onMerge={() => {}} />
    </div>
  )
}

export const ContextMap: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ContextMapComponent
        blocks={contextBlocks}
        limit={20_000}
        model="Claude Opus"
        agents={[{ id: 'coder', name: 'Coder' }, { id: 'researcher', name: 'Researcher' }]}
        agent="coder"
        compaction={contextCompaction}
        status="Compacting"
      />
    </div>
  )
}

const treeRoot: TreeAgent = {
  id: 'lead',
  name: 'Orchestrator',
  task: 'Launch the new pricing page',
  model: 'Opus',
  status: 'running',
  cost: 0.42,
  tools: ['repo', 'browser'],
  children: [
    { id: 'research', name: 'Researcher', task: 'Compare five competitors', status: 'done', cost: 0.29 },
    { id: 'build', name: 'Coder', task: 'Update pricing.ts', status: 'waiting', cost: 0.13, ask: 'Approve the price change' },
    { id: 'qa', name: 'Reviewer', task: 'Check the copy', status: 'queued' }
  ]
}

export const AgentTree: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <AgentTreeComponent root={treeRoot} />
    </div>
  )
}
