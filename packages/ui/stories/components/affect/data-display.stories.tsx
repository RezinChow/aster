import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import type { MetricChange } from '../../../src/components/affect/data-display/change-summary'
import type {
  BreakdownDimension,
  BreakdownMeasure,
  BreakdownRecord
} from '../../../src/components/affect/data-display/breakdown-chart'
import type { BreakdownItem } from '../../../src/components/affect/data-display/compact-breakdown'
import type { DataColumn, DataRow } from '../../../src/components/affect/data-display/data-table'
import type { ExperimentMetric, ExperimentVariant } from '../../../src/components/affect/data-display/experiment-card'
import type { KpiSeries } from '../../../src/components/affect/data-display/kpi-chart'
import type { UsageCompany } from '../../../src/components/affect/data-display/model-usage'
import type { TreeNode } from '../../../src/components/affect/data-display/tree-view'
import type { TrendSeries } from '../../../src/components/affect/data-display/trend-chart'
import type { UsagePart } from '../../../src/components/affect/data-display/usage-meter'
import {
  Avatar as AvatarComponent,
  Badge as BadgeComponent,
  BreakdownChart as BreakdownChartComponent,
  ChangeSummary as ChangeSummaryComponent,
  CompactBreakdown as CompactBreakdownComponent,
  DataTable as DataTableComponent,
  ExperimentCard as ExperimentCardComponent,
  HoverCard as HoverCardComponent,
  KpiChart as KpiChartComponent,
  ModelUsage as ModelUsageComponent,
  Resizable as ResizableComponent,
  ResizableHandle as ResizableHandleComponent,
  ResizablePanel as ResizablePanelComponent,
  ScrollArea as ScrollAreaComponent,
  Separator as SeparatorComponent,
  StatCard as StatCardComponent,
  TreeView as TreeViewComponent,
  TrendChart as TrendChartComponent,
  UsageMeter as UsageMeterComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Data display',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Avatar: Story = {
  render: () => (
    <div className="flex w-full max-w-3xl flex-wrap items-center gap-4">
      <AvatarComponent name="Mira Chen" size={40} status="online" />
      <AvatarComponent name="Lyon" size={32} shape="square" />
      <AvatarComponent kind="agent" seed="researcher" size={40} working />
      <AvatarComponent name="Ada" size={24} status="busy" />
    </div>
  )
}

export const Badge: Story = {
  render: () => (
    <div className="flex w-full max-w-3xl flex-wrap items-center gap-2">
      <BadgeComponent tone="neutral">Draft</BadgeComponent>
      <BadgeComponent tone="primary">Active</BadgeComponent>
      <BadgeComponent tone="success" dot>Done</BadgeComponent>
      <BadgeComponent tone="warning">Review</BadgeComponent>
      <BadgeComponent tone="danger">Failed</BadgeComponent>
      <BadgeComponent tone="info">Note</BadgeComponent>
      <BadgeComponent tone="purple">Pro</BadgeComponent>
      <BadgeComponent tone="success" live>Live</BadgeComponent>
      <BadgeComponent tone="neutral" count={128} max={99} />
    </div>
  )
}

const breakdownRecords: BreakdownRecord[] = [
  { model: 'Opus', task: 'Plan', cost: 0.42 },
  { model: 'Opus', task: 'Review', cost: 0.18 },
  { model: 'Flash', task: 'Search', cost: 0.05 },
  { model: 'Flash', task: 'Plan', cost: 0.09 }
]

const breakdownDimensions: BreakdownDimension[] = [
  { key: 'model', label: 'Model', values: ['Opus', 'Flash'] },
  { key: 'task', label: 'Task', values: ['Plan', 'Review', 'Search'] }
]

const breakdownMeasures: BreakdownMeasure[] = [{ key: 'cost', label: 'Cost', unit: '$', field: 'cost' }]

export const BreakdownChart: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <BreakdownChartComponent
        title="Spend by model"
        records={breakdownRecords}
        dimensions={breakdownDimensions}
        measures={breakdownMeasures}
      />
    </div>
  )
}

const changes: MetricChange[] = [
  { label: 'Active users', change: 'Up 6.1% to 18.2K', tone: 'good', direction: 'up' },
  { label: 'Churn', change: 'Down to 2.1% from 2.6%', tone: 'good', direction: 'down' },
  { label: 'Support tickets', change: 'Up 14% to 312', tone: 'bad', direction: 'up' },
  { label: 'Runs this week', change: 'Unchanged at 128', tone: 'neutral' }
]

export const ChangeSummary: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ChangeSummaryComponent title="This week" period="Compared with last week" changes={changes} />
    </div>
  )
}

const breakdownByPeriod: Record<string, BreakdownItem[]> = {
  '7d': [
    { label: 'Direct', value: 4200 },
    { label: 'Referral', value: 1800 },
    { label: 'Organic', value: 900 }
  ],
  '30d': [
    { label: 'Direct', value: 16900 },
    { label: 'Referral', value: 7200 },
    { label: 'Organic', value: 4100 },
    { label: 'Paid', value: 1800 }
  ],
  '90d': [
    { label: 'Direct', value: 51200 },
    { label: 'Referral', value: 23800 },
    { label: 'Organic', value: 14400 },
    { label: 'Paid', value: 6200 }
  ]
}

export const CompactBreakdown: Story = {
  render: function CompactBreakdownExample() {
    const [period, setPeriod] = useState('30d')
    return (
      <div className="w-full max-w-3xl">
        <CompactBreakdownComponent
          title="Revenue by channel"
          periods={[
            { id: '7d', label: '7d' },
            { id: '30d', label: '30d' },
            { id: '90d', label: '90d' }
          ]}
          period={period}
          onPeriodChange={setPeriod}
          items={breakdownByPeriod[period]}
          delta={12.4}
          format={(n) => `$${Math.round(n).toLocaleString('en-US')}`}
          totalLabel="Total revenue"
        />
      </div>
    )
  }
}

const tableColumns: DataColumn[] = [
  { key: 'task', label: 'Task', width: 220 },
  { key: 'model', label: 'Model', type: 'tag' },
  { key: 'cost', label: 'Cost', type: 'number', format: (v) => `$${v.toFixed(2)}` }
]

const tableRows: DataRow[] = [
  { id: '1', task: 'Launch pricing page', model: 'Opus', cost: 0.42 },
  { id: '2', task: 'Competitor research', model: 'Flash', cost: 0.08 },
  { id: '3', task: 'Copy review', model: 'Opus', cost: 0.17 }
]

export const DataTable: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <DataTableComponent title="Runs" columns={tableColumns} rows={tableRows} />
    </div>
  )
}

const experimentMetrics: ExperimentMetric[] = [
  { id: 'conversion', label: 'Conversion', format: (n) => `${n.toFixed(1)}%` },
  { id: 'revenue', label: 'Revenue', format: (n) => `$${n.toFixed(2)}` }
]

const experimentVariants: ExperimentVariant[] = [
  {
    id: 'a',
    key: 'A',
    name: 'Start free trial',
    control: true,
    visitors: 4790,
    values: { conversion: 4.2, revenue: 18.4 }
  },
  {
    id: 'b',
    key: 'B',
    name: 'Try it free',
    visitors: 4812,
    values: { conversion: 4.7, revenue: 19.1 },
    confidence: { conversion: 96, revenue: 81 }
  }
]

export const ExperimentCard: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ExperimentCardComponent
        title="Signup button copy"
        status={{ label: 'Running', tone: 'green' }}
        note="Day 9 of 14"
        metrics={experimentMetrics}
        variants={experimentVariants}
        trigger="click"
        defaultOpen
        action={{ label: (variant) => `Ship ${variant.key}`, onClick: () => {} }}
      />
    </div>
  )
}

export const HoverCard: Story = {
  render: () => (
    <div className="flex w-full max-w-3xl items-center gap-2 text-sm">
      <span>Mentioned by</span>
      <HoverCardComponent
        width={288}
        content={
          <div className="space-y-1">
            <div className="text-xs font-medium text-foreground">Mira Chen</div>
            <div className="text-[11px] text-muted-foreground">Research agent · online</div>
            <a href="#agent" className="text-[11px] text-info underline underline-offset-2">Open agent</a>
          </div>
        }
      >
        <button type="button" className="text-info underline underline-offset-2">@mira</button>
      </HoverCardComponent>
    </div>
  )
}

const chartLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const kpiSeries: KpiSeries[] = [
  { label: 'Requests', color: '#2f6bff', values: [820, 932, 901, 1102, 980, 1240, 1180] }
]

export const KpiChart: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <KpiChartComponent
        title="Requests"
        value="1,284"
        delta={8.2}
        labels={chartLabels}
        series={kpiSeries}
        footer="vs the previous 7 days"
      />
    </div>
  )
}

const usageCompanies: UsageCompany[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [
      {
        id: 'sonnet',
        name: 'Claude Sonnet',
        usage: { tokens: 2_180_000, cost: 6.54, requests: 838 },
        tasks: { search: { tokens: 400_000 }, analyze: { tokens: 1_780_000 } }
      },
      {
        id: 'opus',
        name: 'Claude Opus',
        usage: { tokens: 1_240_000, cost: 18.6, requests: 477 },
        tasks: { code: { tokens: 1_240_000 } }
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      {
        id: 'gpt',
        name: 'GPT',
        usage: { tokens: 1_520_000, cost: 15.2, requests: 585 },
        tasks: { test: { tokens: 1_520_000 } }
      }
    ]
  }
]

export const ModelUsage: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ModelUsageComponent
        title="Usage by provider"
        companies={usageCompanies}
        previous={{ tokens: 4_100_000, cost: 31.4, requests: 1620 }}
        since="last week"
      />
    </div>
  )
}

export const Resizable: Story = {
  render: () => (
    <div className="h-80 w-full max-w-3xl">
      <ResizableComponent direction="horizontal" className="overflow-hidden rounded-lg border border-border bg-card">
        <ResizablePanelComponent defaultSize={30} minSize={20} maxSize={50} collapsible className="p-4">
          <div className="text-xs font-medium text-foreground">Runs</div>
          <div className="mt-2 text-[11px] text-muted-foreground">A list of recent agent runs.</div>
        </ResizablePanelComponent>
        <ResizableHandleComponent withHandle />
        <ResizablePanelComponent defaultSize={70} minSize={40} className="p-4">
          <div className="text-xs font-medium text-foreground">Output</div>
          <div className="mt-2 text-[11px] text-muted-foreground">The selected run's output goes here.</div>
        </ResizablePanelComponent>
      </ResizableComponent>
    </div>
  )
}

export const ScrollArea: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ScrollAreaComponent maxHeight={200} fade className="rounded-lg border border-border bg-card p-3" aria-label="Recent runs">
        <ul className="space-y-2">
          {Array.from({ length: 12 }, (_, index) => (
            <li key={index} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs">
              <span className="text-foreground">Run #{128 - index}</span>
              <span className="text-muted-foreground">completed</span>
            </li>
          ))}
        </ul>
      </ScrollAreaComponent>
    </div>
  )
}

export const Separator: Story = {
  render: () => (
    <div className="w-full max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Drafts</span>
        <SeparatorComponent orientation="vertical" />
        <span>In review</span>
        <SeparatorComponent orientation="vertical" />
        <span>Published</span>
      </div>
      <SeparatorComponent />
      <SeparatorComponent label="Or continue with" />
    </div>
  )
}

export const StatCard: Story = {
  render: () => (
    <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
      <StatCardComponent label="Runs" value={128} change={12.4} changeLabel="vs last week" />
      <StatCardComponent label="Spend" value="$24.80" change={-4.2} changeLabel="lower is better" lowerIsBetter />
      <StatCardComponent label="Approvals" value={7} footer="2 waiting on you" />
    </div>
  )
}

const treeItems: TreeNode[] = [
  {
    id: 'src',
    label: 'src',
    children: [
      {
        id: 'src/components',
        label: 'components',
        children: [
          { id: 'src/components/avatar.tsx', label: 'avatar.tsx', meta: '3 KB' },
          { id: 'src/components/badge.tsx', label: 'badge.tsx', meta: '2 KB' }
        ]
      },
      { id: 'src/index.ts', label: 'index.ts', meta: '1 KB' }
    ]
  },
  { id: 'readme', label: 'README.md', meta: '5 KB' }
]

export const TreeView: Story = {
  render: () => (
    <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-3">
      <TreeViewComponent items={treeItems} defaultExpanded={['src', 'src/components']} defaultSelected="src/components/avatar.tsx" />
    </div>
  )
}

const trendSeries: TrendSeries[] = [
  { label: 'This week', values: [12, 19, 14, 22, 18, 27, 24], color: '#2f6bff' },
  { label: 'Last week', values: [9, 15, 11, 18, 14, 20, 19], color: '#94a3b8', previous: true }
]

export const TrendChart: Story = {
  render: () => (
    <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-4">
      <TrendChartComponent label="Cost" labels={chartLabels} series={trendSeries} variant="area" height={180} />
    </div>
  )
}

const usedParts: UsagePart[] = [
  { label: 'Input', value: 420000 },
  { label: 'Output', value: 180000 }
]

export const UsageMeter: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <UsageMeterComponent
        title="Token usage"
        plan="Pro"
        total={1000000}
        used={usedParts}
        unit="tokens"
        limits={[{ label: 'Requests', used: 640, total: 1000 }]}
        daily={[
          { label: 'Mon', value: 12 },
          { label: 'Tue', value: 18 },
          { label: 'Wed', value: 14 },
          { label: 'Thu', value: 22 },
          { label: 'Fri', value: 27 }
        ]}
        onUpgrade={() => {}}
      />
    </div>
  )
}
