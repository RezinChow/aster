import type { Meta, StoryObj } from '@storybook/react'

const catalog: Record<string, string[]> = {
  Agents: [
    'AgentCheckpoints', 'AgentCrew', 'AgentCursors', 'AgentFindings', 'AgentFleet', 'AgentGraph',
    'AgentHandoff', 'AgentInbox', 'AgentLanes', 'AgentLedger', 'AgentMonitor', 'AgentPlan',
    'AgentQueue', 'AgentRecap', 'AgentRouter', 'AgentSequence', 'AgentSteering', 'AgentTiming',
    'AgentTrail', 'AgentTree', 'AgentWorkbench', 'ApprovalCard', 'ApprovalGates', 'AutonomyDial',
    'AwaySummary', 'CollaborationStream', 'CommitTrail', 'ConflictRadar', 'ContextMap',
    'ContextWindow', 'CostWaterfall', 'DecisionCard', 'DecisionTree', 'DelegateBoard',
    'DiffTimeline', 'FallbackChain', 'FanOutGrid', 'FlowBuilder', 'InlineDiff', 'JudgeBracket',
    'MemoryGraph', 'MemoryPanel', 'ParallelAttempts', 'PermissionRequest', 'PlanVsActual',
    'RateLimitPlanner', 'ReasoningSummary', 'RepoMap', 'ReviewCenter', 'RootCauseTree',
    'RunControls', 'RunningNow', 'ScheduledRuns', 'ToolAccessMap', 'ToolCallCard', 'TraceWaterfall'
  ],
  Inputs: [
    'BillingSchedule', 'Checkbox', 'ColorPicker', 'Combobox', 'DatePicker', 'DateRangePicker',
    'Dropzone', 'FilterMenu', 'FormField', 'IntegrationSettings', 'NumberInput', 'OtpInput',
    'PromptLibrary', 'Rating', 'Select', 'StepperForm', 'Switch', 'TagInput', 'TextArea',
    'TextField', 'TimePicker'
  ],
  'Data display': [
    'Avatar', 'Badge', 'BreakdownChart', 'ChangeSummary', 'CompactBreakdown', 'DataTable',
    'ExperimentCard', 'HoverCard', 'KpiChart', 'ModelUsage', 'Resizable', 'ScrollArea',
    'Separator', 'StatCard', 'TreeView', 'TrendChart', 'UsageMeter'
  ],
  Chat: [
    'AiAnswer', 'ChatComposer', 'CitedAnswer', 'CommentThread', 'CommentsPanel', 'MessageActions',
    'ModelPicker', 'ThinkingLoader', 'ThinkingState', 'WritingAssistant'
  ],
  Feedback: [
    'DecisionInbox', 'Dialog', 'EmptyState', 'NotificationStack', 'ProgressTracker', 'SetupGuide',
    'Skeleton', 'Spinner', 'Toaster', 'Tooltip'
  ],
  Navigation: [
    'Breadcrumb', 'CommandMenu', 'ContextMenu', 'DropdownMenu', 'IntegrationPicker', 'Pagination',
    'Popover', 'ProfileMenu', 'SegmentedControl'
  ],
  Cards: ['Card', 'EmailDraft', 'ProjectCard', 'SmartRecommendation', 'TipsPanel'],
  Buttons: ['Button', 'IconButton', 'ReactionBar', 'ToggleGroup'],
  Text: ['CodeBlock', 'Kbd']
}

const meta = {
  title: 'Affect/Overview',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'affect 组件家族的完整目录（134 个复刻 + 官网免费源码 1:1）。复刻实现位于 `src/components/affect/`，官网 51 个免费组件与 4 个免费动效的 MIT 原始源码位于 `src/components/affect/official/`（@aster-ai-lab/ui/affect/official，逐字复制、可核查）；Pro 动效复刻位于 `src/components/affect/pro-motion/`。场景组合见 Affect/Agent runs 与 Affect/Product UI。'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Catalog: Story = {
  render: () => (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-lg font-medium text-foreground">affectUI component catalog</div>
        <div className="mt-1 text-sm text-muted-foreground">
          134 components · 9 categories · source-exported from @aster-ai-lab/ui/affect
        </div>
        <div className="mt-3 rounded-md border border-info/30 bg-info-subtle px-3 py-2 text-xs leading-relaxed text-info-subtle-foreground">
          <strong>保真度说明：</strong>本目录中的 134 个组件是基于 affectUI 公开文档的高保真复刻实现（Tailwind token 体系）。
          官网 <strong>74 个免费资源的 MIT 原始源码</strong>（51 组件 + 4 动效 + 2 block + 17 插画，1:1 逐字复制）见 <code>Affect/Official (MIT 1:1)</code> 分组；
          <strong>Pro 组件与 Pro 动效</strong>无公开源码，见 <code>Affect/Pro Motion (recreation)</code> 的高保真复刻并已逐处标注。
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Object.entries(catalog).map(([category, names]) => (
          <section key={category} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">{category}</h3>
              <span className="text-xs tabular-nums text-muted-foreground">{names.length}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {names.map((name) => (
                <span
                  key={name}
                  className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
