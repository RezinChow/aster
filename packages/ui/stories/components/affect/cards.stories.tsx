import type { Meta, StoryObj } from '@storybook/react'

import {
  Card as CardComponent,
  CardContent,
  CardFooter,
  CardHeader,
  EmailDraft as EmailDraftComponent,
  ProjectCard as ProjectCardComponent,
  SmartRecommendation as SmartRecommendationComponent,
  TipsPanel as TipsPanelComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Cards',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Card: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <CardComponent>
        <CardHeader
          title="Support triage"
          description="Sorts new tickets and drafts the first reply"
          action={<button type="button" aria-label="More options">⋯</button>}
        />
        <CardContent>142 tickets this week · 96% resolved</CardContent>
        <CardFooter>Updated 2 hours ago</CardFooter>
      </CardComponent>
    </div>
  )
}

export const EmailDraft: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <EmailDraftComponent onSend={() => {}} onDiscard={() => {}} />
    </div>
  )
}

export const ProjectCard: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <ProjectCardComponent
        title="Onboarding flow"
        trigger="click"
        defaultOpen
        status="progress"
        due="Oct 24"
        tasks={[
          { id: 'welcome', label: 'Welcome screen', done: true, assignee: 'Mara' },
          { id: 'workspace', label: 'Workspace setup', done: true, assignee: 'Jonas' },
          { id: 'invite', label: 'Invite teammates', assignee: 'Mara' }
        ]}
        members={[{ name: 'Mara' }, { name: 'Jonas' }]}
      />
    </div>
  )
}

export const SmartRecommendation: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <SmartRecommendationComponent
        options={[
          { id: 'incremental', label: 'Incremental sync', reason: 'Only 4% of rows changed.', signal: 3 },
          { id: 'full', label: 'Full refresh', reason: 'Rebuilds every table.', signal: 1 }
        ]}
        onAccept={() => {}}
      />
    </div>
  )
}

export const TipsPanel: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <TipsPanelComponent
        tips={[
          { id: 'search', title: 'Quick search', description: 'Use the shortcut to jump anywhere.', action: 'Try it' },
          { id: 'pro', title: 'Ready for Pro?', description: 'Unlimited projects and priority support.', action: 'See plans', primary: true }
        ]}
      />
    </div>
  )
}
