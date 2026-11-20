import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import type { Decision } from '../../../src/components/affect/feedback/decision-inbox'
import type { Notice } from '../../../src/components/affect/feedback/notification-stack'
import type { ProgressStep } from '../../../src/components/affect/feedback/progress-tracker'
import type { SetupGroup } from '../../../src/components/affect/feedback/setup-guide'
import { toast } from '../../../src/components/affect/feedback/toaster'
import {
  Button as ButtonComponent,
  DecisionInbox as DecisionInboxComponent,
  Dialog as DialogComponent,
  EmptyState as EmptyStateComponent,
  NotificationStack as NotificationStackComponent,
  ProgressTracker as ProgressTrackerComponent,
  SetupGuide as SetupGuideComponent,
  Skeleton as SkeletonComponent,
  Spinner as SpinnerComponent,
  Toaster as ToasterComponent,
  Tooltip as TooltipComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Feedback',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const decisions: Decision[] = [
  {
    id: 'renewal',
    title: 'Renew Figma for the design team?',
    detail: '12 seats · $1,800 per year · renews in 5 days',
    primary: 'Renew',
    secondary: 'Change seats'
  },
  {
    id: 'migration',
    title: 'Allow Coder to run the migration?',
    detail: 'Writes to the production database',
    primary: 'Approve',
    secondary: 'Reject',
    collapsed: true
  }
]

export const DecisionInbox: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <DecisionInboxComponent decisions={decisions} onDecide={() => {}} />
    </div>
  )
}

export const Dialog: Story = {
  render: function DialogExample() {
    const [open, setOpen] = useState(false)
    return (
      <div className="w-full max-w-3xl">
        <ButtonComponent onClick={() => setOpen(true)}>Delete run</ButtonComponent>
        <DialogComponent
          open={open}
          onOpenChange={setOpen}
          title="Delete this run?"
          description="This action cannot be undone."
          footer={
            <>
              <ButtonComponent variant="outline" onClick={() => setOpen(false)}>Cancel</ButtonComponent>
              <ButtonComponent variant="danger" onClick={() => setOpen(false)}>Delete</ButtonComponent>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">The run and all of its artifacts will be permanently removed.</p>
        </DialogComponent>
      </div>
    )
  }
}

export const EmptyState: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <EmptyStateComponent
        title="No runs yet"
        text="Start a run to see its progress, cost and outputs here."
        action={<ButtonComponent size="sm">Start run</ButtonComponent>}
      />
    </div>
  )
}

const notices: Notice[] = [
  {
    id: 'n1',
    badge: 'DONE',
    title: 'Run finished',
    text: 'Launch pricing page completed in 4m 12s.',
    tone: 'success'
  },
  {
    id: 'n2',
    badge: 'NEW',
    title: 'Approval needed',
    text: 'Coder wants to run a production migration.',
    tone: 'warning',
    action: { label: 'Review', onClick: () => {} }
  },
  {
    id: 'n3',
    title: 'Weekly recap is ready',
    text: '128 runs, 7 approvals, $24.80 spent.',
    tone: 'info'
  }
]

export const NotificationStack: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <NotificationStackComponent notices={notices} onDismiss={() => {}} />
    </div>
  )
}

const progressSteps: ProgressStep[] = [
  { id: '1', label: 'Create workspace', done: true },
  { id: '2', label: 'Invite teammates', done: true },
  { id: '3', label: 'Connect a model' },
  { id: '4', label: 'Run your first agent' }
]

export const ProgressTracker: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <ProgressTrackerComponent title="Getting started" steps={progressSteps} />
    </div>
  )
}

const setupGroups: SetupGroup[] = [
  {
    id: 'workspace',
    title: 'Set up your workspace',
    tasks: [
      { id: 'name', label: 'Choose a workspace name', done: true },
      { id: 'invite', label: 'Invite your teammates' }
    ]
  },
  {
    id: 'verify',
    title: 'Verify your account',
    tasks: [{ id: 'email', label: 'Confirm your email' }]
  }
]

export const SetupGuide: Story = {
  render: () => (
    <div className="w-full max-w-3xl">
      <SetupGuideComponent groups={setupGroups} onChange={() => {}} onEdit={() => {}} onClose={() => {}} />
    </div>
  )
}

export const Skeleton: Story = {
  render: () => (
    <div className="w-full max-w-3xl space-y-2 rounded-lg border border-border bg-card p-4">
      <SkeletonComponent width="45%" height={16} />
      <SkeletonComponent width="80%" height={12} />
      <SkeletonComponent width="65%" height={12} />
      <SkeletonComponent width="30%" height={12} />
    </div>
  )
}

export const Spinner: Story = {
  render: () => (
    <div className="flex w-full max-w-3xl flex-wrap items-center gap-6 text-xs text-muted-foreground">
      <span className="flex items-center gap-2"><SpinnerComponent label="Loading" /> Small</span>
      <span className="flex items-center gap-2"><SpinnerComponent size={24} className="text-primary" label="Loading" /> Medium</span>
      <span className="flex items-center gap-2"><SpinnerComponent size={32} label="Loading" /> Large</span>
    </div>
  )
}

export const Toaster: Story = {
  render: function ToasterExample() {
    return (
      <div className="relative min-h-64 w-full max-w-3xl rounded-lg border border-dashed border-border p-6">
        <div className="flex flex-wrap gap-2">
          <ButtonComponent size="sm" onClick={() => toast.success('Run saved', { description: 'Your changes were saved.' })}>
            Success
          </ButtonComponent>
          <ButtonComponent size="sm" variant="outline" onClick={() => toast.error('Run failed', { description: 'Please try again.' })}>
            Error
          </ButtonComponent>
          <ButtonComponent size="sm" variant="outline" onClick={() => toast.info('New version available')}>
            Info
          </ButtonComponent>
          <ButtonComponent size="sm" variant="outline" onClick={() => toast.loading('Running agent…')}>
            Loading
          </ButtonComponent>
        </div>
        <ToasterComponent inline position="bottom-center" duration={8000} />
      </div>
    )
  }
}

export const Tooltip: Story = {
  render: () => (
    <div className="flex w-full max-w-3xl items-center gap-2">
      <TooltipComponent content="Open the command menu" shortcut="⌘K">
        <ButtonComponent variant="outline" size="sm">Command menu</ButtonComponent>
      </TooltipComponent>
      <span className="text-xs text-muted-foreground">Hover or focus the button</span>
    </div>
  )
}
