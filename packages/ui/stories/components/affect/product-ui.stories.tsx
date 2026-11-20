import type { Meta, StoryObj } from '@storybook/react'
import { Bell, Check, ChevronRight, Home, Search, Settings, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'

import type { AnswerSource } from '../../../src/components/affect/chat/ai-answer'
import type { ThinkingStep } from '../../../src/components/affect/chat/thinking-state'
import type { CitedSegment, CitedSource } from '../../../src/components/affect/chat/cited-answer'
import type { PickerModel } from '../../../src/components/affect/chat/model-picker'
import type { CommandGroup } from '../../../src/components/affect/navigation/command-menu'
import type { Notice } from '../../../src/components/affect/feedback/notification-stack'
import type { BadgeTone } from '../../../src/components/affect/data-display/badge'
import {
  AiAnswer,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  ChatComposer,
  Checkbox,
  CodeBlock,
  CommandMenu,
  CitedAnswer,
  DataTable,
  EmailDraft,
  EmptyState,
  IconButton,
  Kbd,
  KpiChart,
  ModelPicker,
  NotificationStack,
  NumberInput,
  OtpInput,
  Pagination,
  Popover,
  ProgressTracker,
  ProjectCard,
  Rating,
  ReactionBar,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  Switch,
  TagInput,
  TextField,
  ThinkingState,
  TipsPanel,
  ToggleGroup,
  Tooltip,
  TrendChart,
  UsageMeter,
  BreakdownChart
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Product UI',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const models: PickerModel[] = [
  { id: 'auto', name: 'Auto', description: 'Picks the best model', speed: 4, quality: 4, cost: 2 },
  { id: 'opus', name: 'Opus', description: 'Deep reasoning', speed: 2, quality: 5, cost: 5 },
  { id: 'flash', name: 'Flash', description: 'Fast and cheap', speed: 5, quality: 3, cost: 1 }
]

const sources: AnswerSource[] = [
  { name: 'docs', title: 'affectUI docs', snippet: '134 React components for AI products' },
  { name: 'blog', title: 'Agent UI patterns', snippet: 'Cost, status and approvals belong on the card' }
]

const thinkingSteps: ThinkingStep[] = [
  { kind: 'step', label: 'Reading the question' },
  { kind: 'search', label: 'Searching component docs', sources: [{ label: 'affectUI', href: 'https://www.affectui.com' }] },
  { kind: 'step', label: 'Drafting the answer' }
]

const citedSegments: CitedSegment[] = [
  { text: 'affectUI ships ', paragraph: false },
  { text: '134 React components', cite: ['s1'] },
  { text: ' for AI products, including agent trees and approval gates.', paragraph: true }
]

const citedSources: CitedSource[] = [
  { id: 's1', title: 'Components · affectUI', site: 'affectui.com', url: 'https://www.affectui.com/components', quote: '134 React components for AI products and SaaS' }
]

export const Chat: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-2">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">ChatComposer</h3>
        <ChatComposer placeholder="Ask about the release…" models={models} onSend={() => {}} />
        <h3 className="pt-2 text-sm font-medium text-foreground">ModelPicker</h3>
        <ModelPicker models={models} defaultValue="opus" />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">AiAnswer</h3>
        <AiAnswer
          question="How many components does affectUI have?"
          answer="affectUI has 134 React components across nine categories, plus screens, blocks, illustrations and motion effects."
          sources={sources}
          followUps={['Which are free?', 'Show the agent components']}
        />
        <h3 className="pt-2 text-sm font-medium text-foreground">ThinkingState</h3>
        <ThinkingState steps={thinkingSteps} loop={false} doneLabel="Answered" />
        <h3 className="pt-2 text-sm font-medium text-foreground">CitedAnswer</h3>
        <CitedAnswer segments={citedSegments} sources={citedSources} />
      </section>
    </div>
  )
}

export const Inputs: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-5xl gap-5 md:grid-cols-2">
      <TextField label="Project name" hint="Shown in the sidebar" placeholder="Launch pricing" />
      <TextField label="Secret key" suffix={<Check className="size-3" />} defaultValue="sk-live-1234" />
      <NumberInput label="Monthly budget" defaultValue={1200} min={0} step={100} />
      <OtpInput label="Verification code" length={6} onComplete={() => {}} />
      <Select label="Model" options={models.map((m) => ({ value: m.id, label: m.name, description: m.description }))} defaultValue="auto" />
      <TagInput label="Reviewers" defaultValue={['mira', 'lyon']} placeholder="Add a name" />
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <Checkbox label="Send notifications" description="Email me when a run needs approval" defaultChecked />
        <Switch label="Auto-approve safe tools" description="Only read-only tools" />
        <Rating defaultValue={4} />
      </div>
    </div>
  )
}

const chartSeries = [{ label: 'This week', color: '#3b82f6', values: [12, 19, 14, 22, 18, 27, 24] }]
const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const DataDisplay: Story = {
  render: () => (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Runs" value={128} change={12.4} changeLabel="vs last week" />
        <StatCard label="Spend" value="$24.80" change={-4.2} changeLabel="lower is better" lowerIsBetter />
        <StatCard label="Approvals" value={7} footer="2 waiting on you" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <KpiChart title="Requests" value="1,284" delta={8.2} labels={chartLabels} series={chartSeries} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <TrendChart label="Cost" labels={chartLabels} series={chartSeries} height={160} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <UsageMeter total={1000000} used={[{ label: 'Input', value: 420000 }, { label: 'Output', value: 180000 }]} plan="Pro" title="Token usage" unit="tokens" />
        <BreakdownChart
          title="Spend by model"
          records={[
            { model: 'Opus', task: 'Plan', cost: 0.42 },
            { model: 'Opus', task: 'Review', cost: 0.18 },
            { model: 'Flash', task: 'Search', cost: 0.05 }
          ]}
          dimensions={[
            { key: 'model', label: 'Model', values: ['Opus', 'Flash'] },
            { key: 'task', label: 'Task', values: ['Plan', 'Review', 'Search'] }
          ]}
          measures={[{ key: 'cost', label: 'Cost', unit: '$' }]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {(['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as BadgeTone[]).map((tone) => (
          <Badge key={tone} tone={tone}>{tone}</Badge>
        ))}
        <Avatar name="Mira Chen" status="online" size={40} />
        <Avatar name="Lyon" size={32} />
      </div>
      <DataTable
        title="Runs"
        columns={[
          { key: 'task', label: 'Task', width: 220 },
          { key: 'model', label: 'Model', type: 'tag' },
          { key: 'cost', label: 'Cost', type: 'number', format: (v) => `$${v.toFixed(2)}` }
        ]}
        rows={[
          { id: '1', task: 'Launch pricing page', model: 'Opus', cost: 0.42 },
          { id: '2', task: 'Competitor research', model: 'Flash', cost: 0.08 },
          { id: '3', task: 'Copy review', model: 'Opus', cost: 0.17 }
        ]}
      />
    </div>
  )
}

const notices: Notice[] = [
  { id: 'n1', title: 'Run finished', text: 'Launch pricing page completed in 4m 12s.', tone: 'success' },
  { id: 'n2', badge: 'NEW', title: 'Approval needed', text: 'Coder wants to run a migration.', tone: 'warning', action: { label: 'Review', onClick: () => {} } }
]

export const Feedback: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2">
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">ProgressTracker</h3>
        <ProgressTracker steps={[{ id: '1', label: 'Plan', done: true }, { id: '2', label: 'Research', done: true }, { id: '3', label: 'Implement' }, { id: '4', label: 'Review' }]} />
        <h3 className="pt-2 text-sm font-medium text-foreground">NotificationStack</h3>
        <NotificationStack notices={notices} />
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">EmptyState / Skeleton / Spinner</h3>
        <EmptyState title="No runs yet" text="Start a run to see it here." action={<Button size="sm">Start run</Button>} />
        <div className="space-y-2">
          <Skeleton width="60%" height={12} />
          <Skeleton width="80%" height={12} />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner /> Loading agents…</div>
        <Tooltip content="Shortcut: ⌘K" shortcut="⌘K"><Button variant="outline" size="sm">Hover me</Button></Tooltip>
      </section>
    </div>
  )
}

const commandGroups: CommandGroup[] = [
  { id: 'nav', label: 'Navigate', commands: [{ id: 'home', label: 'Home', icon: <Home className="size-3.5" />, keys: 'G H' }, { id: 'settings', label: 'Settings', icon: <Settings className="size-3.5" /> }] },
  { id: 'actions', label: 'Actions', commands: [{ id: 'new', label: 'New run', icon: <Sparkles className="size-3.5" />, keys: '⌘ N' }, { id: 'search', label: 'Search', icon: <Search className="size-3.5" /> }] }
]

export const Navigation: Story = {
  render: function NavigationExample() {
    const anchor = useRef<HTMLSpanElement>(null)
    const [open, setOpen] = useState(false)
    const [page, setPage] = useState(2)
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Breadcrumb items={[{ label: 'Workspace', href: '#' }, { label: 'Agents', href: '#' }, { label: 'Run 42' }]} />
        <div className="flex flex-wrap items-center gap-6">
          <SegmentedControl options={[{ value: 'all', label: 'All', count: 12 }, { value: 'running', label: 'Running', count: 3 }, { value: 'waiting', label: 'Waiting', count: 2 }]} defaultValue="all" />
          <Pagination page={page} onPageChange={setPage} total={96} pageSize={10} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <CommandMenu groups={commandGroups} placeholder="Type a command…" />
        </div>
        <div className="flex items-center gap-3">
          <span ref={anchor}><Button variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>Open popover</Button></span>
          <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} title="Run options" description="Pick what happens next" width={260}>
            <div className="p-3 text-xs text-muted-foreground">Popover content goes here.</div>
          </Popover>
          <Kbd keys={['mod', 'k']} />
        </div>
      </div>
    )
  }
}

export const Basics: Story = {
  render: () => (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button>Save</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="ghost" icon={<Sparkles className="size-3.5" />}>Generate</Button>
        <Button variant="danger" size="sm">Delete</Button>
        <IconButton icon={<Bell className="size-4" />} label="Notifications" />
        <ReactionBar reactions={{ like: { count: 12 }, comment: { count: 3, active: true } }} />
        <ToggleGroup items={[{ value: '1h', label: '1h' }, { value: '24h', label: '24h' }, { value: '7d', label: '7d' }]} defaultValue="24h" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Review center" description="3 items need your decision" action={<ChevronRight className="size-4 text-muted-foreground" />} />
          <CardContent className="text-xs text-muted-foreground">Cards hold one thing well and keep their own actions.</CardContent>
          <CardFooter><Button size="sm">Open queue</Button></CardFooter>
        </Card>
        <TipsPanel tips={[{ id: 't1', title: 'Steer a run', description: 'Queue a note for the next step.', action: 'Try it' }]} />
      </div>
      <ProjectCard
        title="Launch pricing page"
        status="In progress"
        tasks={[{ id: 'a', label: 'Research competitors', done: true }, { id: 'b', label: 'Update pricing.ts' }, { id: 'c', label: 'Publish page' }]}
        members={[{ name: 'Mira Chen' }, { name: 'Lyon' }]}
      />
      <EmailDraft
        reference="Renewal"
        account="Acme"
        amount="$240"
        agent="Mira"
        contacts={[{ name: 'Lyon', email: 'lyon@example.com' }]}
      />
      <CodeBlock code={'const run = await agent.start({\n  task: "Launch the pricing page",\n  model: "opus",\n})'} language="tsx" filename="run.ts" showLineNumbers highlightLines={[2]} />
    </div>
  )
}
