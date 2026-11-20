// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'

import * as Official from '../index'

afterEach(cleanup)

/** Every value exported from the official barrel must be a usable React component (or type-only helper omitted). */
const RUNTIME_EXPORTS = [
  'Avatar', 'AvatarGroup', 'Badge', 'Breadcrumb', 'Button', 'Card', 'CardHeader',
  'CardContent', 'CardFooter', 'ChangeSummary', 'Checkbox', 'CodeBlock', 'ColorPicker',
  'ColorPickerPanel', 'CommentThread', 'AssistantMark', 'ContextMenu', 'DatePicker',
  'DecisionInbox', 'Dialog', 'AlertDialog', 'DropdownMenu', 'EmailDraft', 'EmptyState',
  'FilterMenu', 'FormField', 'HoverCard', 'IconButton', 'Kbd', 'MessageText',
  'MessageActions', 'NotificationStack', 'NumberInput', 'OtpInput', 'Pagination',
  'Popover', 'ProfileMenu', 'SettingsIcon', 'LanguageIcon', 'DocsIcon', 'AppsIcon',
  'LogoutIcon', 'ProgressTracker', 'Rating', 'ReactionBar', 'ResizablePanelGroup',
  'ResizablePanel', 'ResizableHandle', 'ScrollArea', 'SegmentedControl', 'Select',
  'Separator', 'Skeleton', 'Loading', 'SmartRecommendation', 'Spinner', 'Switch',
  'TagInput', 'TextArea', 'TextField', 'ThinkingLoader', 'TimePicker', 'TipsPanel',
  'TipsKbd', 'ToggleGroup', 'ToolCallCard', 'ToolCallGroup', 'Tooltip', 'TreeView',
  'GridBackground', 'NumberTicker', 'ShimmerSkeleton', 'ShimmerText', 'TextReveal',
  'LogoMarquee', 'TestimonialWall',
  'AgentTeam', 'CoverFlow', 'EmptyCalendar', 'EnrichmentOrbit', 'FrostCloud',
  'GhostedChat', 'GlowCloud', 'IntegrationBeam', 'IntegrationGrid', 'LayerStack',
  'LeadSourcing', 'LogoCluster', 'ModelWheel', 'RegionDach', 'SideFolder',
  'TabOverload', 'TeamInvite'
] as const

describe('official MIT sources exported and renderable', () => {
  it('exports all component runtime symbols', () => {
    const missing = RUNTIME_EXPORTS.filter((name) => (Official as Record<string, unknown>)[name] === undefined)
    expect(missing).toEqual([])
  })

  for (const name of RUNTIME_EXPORTS) {
    it(`is a valid component: ${name}`, () => {
      const value = (Official as Record<string, unknown>)[name]
      expect(typeof value === 'function' || (typeof value === 'object' && value !== null)).toBe(true)
    })
  }

  it('renders representative components with injected styles', () => {
    const { getByText, getByPlaceholderText } = render(
      <div>
        <Official.Button>Save</Official.Button>
        <Official.Badge tone="info" live>Running</Official.Badge>
        <Official.TextField label="Slug" placeholder="acme" />
        <Official.GridBackground>content</Official.GridBackground>
        <Official.NumberTicker value={1234} />
      </div>
    )
    expect(getByText('Save')).toBeTruthy()
    expect(getByText('Running')).toBeTruthy()
    expect(getByPlaceholderText('acme')).toBeTruthy()
  })
})
