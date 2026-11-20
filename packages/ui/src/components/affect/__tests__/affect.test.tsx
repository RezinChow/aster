// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AgentTree, Button } from '../index'
import * as affect from '../index'

const SLUGS = `agent-checkpoints agent-crew agent-cursors agent-findings agent-fleet agent-graph agent-handoff agent-inbox agent-lanes agent-ledger agent-monitor agent-plan agent-queue agent-recap agent-router agent-sequence agent-steering agent-timing agent-trail agent-tree agent-workbench ai-answer approval-card approval-gates autonomy-dial avatar away-summary badge billing-schedule breadcrumb breakdown-chart button card change-summary chat-composer checkbox cited-answer code-block collaboration-stream color-picker combobox command-menu comment-thread comments-panel commit-trail compact-breakdown conflict-radar context-map context-menu context-window cost-waterfall data-table date-picker date-range-picker decision-card decision-inbox decision-tree delegate-board dialog diff-timeline dropdown-menu dropzone email-draft empty-state experiment-card fallback-chain fan-out-grid filter-menu flow-builder form-field hover-card icon-button inline-diff integration-picker integration-settings judge-bracket kbd kpi-chart memory-graph memory-panel message-actions model-picker model-usage notification-stack number-input otp-input pagination parallel-attempts permission-request plan-vs-actual popover profile-menu progress-tracker project-card prompt-library rate-limit-planner rating reaction-bar reasoning-summary repo-map resizable review-center root-cause-tree run-controls running-now scheduled-runs scroll-area segmented-control select separator setup-guide skeleton smart-recommendation spinner stat-card stepper-form switch tag-input text-area text-field thinking-loader thinking-state time-picker tips-panel toaster toggle-group tool-access-map tool-call-card tooltip trace-waterfall tree-view trend-chart usage-meter writing-assistant`.split(' ')

const ACRONYMS: Record<string, string> = { ai: 'Ai', kpi: 'Kpi', otp: 'Otp', kbd: 'Kbd' }

function componentName(slug: string): string {
  return slug
    .split('-')
    .map((part) => ACRONYMS[part] ?? `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('')
}

afterEach(cleanup)

describe('affect component namespace', () => {
  it('exports every component', () => {
    expect(SLUGS).toHaveLength(134)
    const missing = SLUGS.map(componentName).filter((name) => !(name in affect))
    expect(missing).toEqual([])
  })

  it('renders the reference components', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()

    cleanup()

    render(
      <AgentTree
        root={{ id: 'lead', name: 'Orchestrator', task: 'Ship release', status: 'running', cost: 0.4 }}
      />
    )
    expect(screen.getByText('Orchestrator')).toBeTruthy()
  })
})
