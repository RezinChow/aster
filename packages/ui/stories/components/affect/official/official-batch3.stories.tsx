import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import {
  Loading as LoadingComponent,
  LogoutIcon,
  Popover as PopoverComponent,
  ProfileMenu as ProfileMenuComponent,
  ProgressTracker as ProgressTrackerComponent,
  Rating as RatingComponent,
  ReactionBar as ReactionBarComponent,
  ResizableHandle as ResizableHandleComponent,
  ResizablePanel as ResizablePanelComponent,
  ResizablePanelGroup as ResizablePanelGroupComponent,
  ScrollArea as ScrollAreaComponent,
  SegmentedControl as SegmentedControlComponent,
  Select as SelectComponent,
  Separator as SeparatorComponent,
  SettingsIcon,
  Skeleton as SkeletonComponent,
  SmartRecommendation as SmartRecommendationComponent
} from '../../../../src/components/affect/official'
import type { Recommendation, SelectOption } from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Components',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const canvas = { padding: 24, minWidth: 340 }

/* ---------- popover ---------- */
function PopoverDemo() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  return (
    // The Popover attaches to its parent – wrap the trigger and the Popover in one element
    <span style={{ display: 'inline-flex' }}>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Invite members
      </button>
      <PopoverComponent
        open={open}
        onClose={() => setOpen(false)}
        align="end"
        width={300}
        title="Invite to the workspace"
        description="They get an email with a link to join."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setOpen(false)
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            aria-label="Email address"
          />
          <button type="submit">Send invite</button>
        </form>
      </PopoverComponent>
    </span>
  )
}

/** Verbatim official source · https://www.affectui.com/components/popover */
export const Popover: Story = {
  render: () => <PopoverDemo />
}

/* ---------- profile-menu ---------- */
/** Verbatim official source · https://www.affectui.com/components/profile-menu */
export const ProfileMenu: Story = {
  render: () => (
    <div style={canvas}>
      <ProfileMenuComponent
        name="Lena Hartmann"
        email="lena.hartmann@fastmail.com"
        items={[
          { id: 'settings', label: 'Settings', icon: <SettingsIcon />, onSelect: () => {} },
          { id: 'logout', label: 'Logout', icon: <LogoutIcon />, onSelect: () => {} },
        ]}
        setup={{ done: 3, total: 5, next: 'Add a profile photo', onContinue: () => {} }}
      />
    </div>
  )
}

/* ---------- progress-tracker ---------- */
const steps = [
  { id: 'tools', label: 'Connect your imported tools' },
  { id: 'notify', label: 'Turn on notifications' },
  { id: 'project', label: 'Create a project', done: true },
]

/** Verbatim official source · https://www.affectui.com/components/progress-tracker */
export const ProgressTracker: Story = {
  render: () => (
    <div style={canvas}>
      <ProgressTrackerComponent title="Getting started" steps={steps} onChange={() => {}} />
    </div>
  )
}

/* ---------- rating ---------- */
function RatingDemo() {
  const [stars, setStars] = useState<number | null>(null)
  return (
    <RatingComponent
      aria-label="Rate this run"
      value={stars}
      onValueChange={(v) => setStars(v)}
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/rating */
export const Rating: Story = {
  render: () => (
    <div style={canvas}>
      <RatingDemo />
    </div>
  )
}

/* ---------- reaction-bar ---------- */
/** Verbatim official source · https://www.affectui.com/components/reaction-bar */
export const ReactionBar: Story = {
  render: () => (
    <div style={canvas}>
      <ReactionBarComponent
        reactions={{
          like: { count: 128, active: true },
          comment: { count: 24 },
        }}
        onReact={() => {}}
      />
    </div>
  )
}

/* ---------- resizable ---------- */
const paneStyle = { padding: 16, height: '100%', background: '#ffffff', fontSize: 13, color: 'rgba(0,0,0,0.7)' }

/** Verbatim official source · https://www.affectui.com/components/resizable */
export const Resizable: Story = {
  render: () => (
    <div style={canvas}>
      <div style={{ height: 480, width: 640, border: '0.5px solid rgba(0,0,0,0.1)', background: '#fafafa' }}>
        <ResizablePanelGroupComponent direction="horizontal" onLayout={(sizes) => localStorage.setItem('workspace', JSON.stringify(sizes))}>
          <ResizablePanelComponent defaultSize={30} minSize={20} maxSize={50} collapsible>
            <div style={paneStyle}>Run list</div>
          </ResizablePanelComponent>
          <ResizableHandleComponent withHandle aria-label="Resize the runs list" />
          <ResizablePanelComponent defaultSize={70} minSize={40}>
            <ResizablePanelGroupComponent direction="vertical">
              <ResizablePanelComponent defaultSize={65}>
                <div style={paneStyle}>Run output</div>
              </ResizablePanelComponent>
              <ResizableHandleComponent aria-label="Resize the log" />
              <ResizablePanelComponent defaultSize={35} minSize={15} collapsible>
                <div style={paneStyle}>Run log</div>
              </ResizablePanelComponent>
            </ResizablePanelGroupComponent>
          </ResizablePanelComponent>
        </ResizablePanelGroupComponent>
      </div>
    </div>
  )
}

/* ---------- scroll-area ---------- */
const sources = [
  { title: 'AffectUI docs', site: 'affectui.com' },
  { title: 'React 19 release notes', site: 'react.dev' },
  { title: 'TypeScript handbook', site: 'typescriptlang.org' },
  { title: 'Radix primitives', site: 'radix-ui.com' },
  { title: 'Storybook docs', site: 'storybook.js.org' },
  { title: 'Bun runtime', site: 'bun.sh' },
  { title: 'MDN Web Docs', site: 'developer.mozilla.org' },
  { title: 'Web.dev', site: 'web.dev' },
]

/** Verbatim official source · https://www.affectui.com/components/scroll-area */
export const ScrollArea: Story = {
  render: () => (
    <div style={canvas}>
      <ScrollAreaComponent
        maxHeight={240}
        fade
        aria-label="Sources"
        style={{ width: 280, border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}
      >
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {sources.map((s) => (
            <li key={s.title} style={{ padding: '8px 12px', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
              {s.title} · {s.site}
            </li>
          ))}
        </ul>
      </ScrollAreaComponent>
    </div>
  )
}

/* ---------- segmented-control ---------- */
function DashboardTabsDemo() {
  const [section, setSection] = useState('overview')
  return (
    <SegmentedControlComponent
      aria-label="Dashboard section"
      kind="tabs"
      value={section}
      onChange={setSection}
      options={[
        { value: 'overview', label: 'Overview', controls: 'panel-overview' },
        { value: 'analytics', label: 'Analytics', controls: 'panel-analytics' },
        { value: 'reports', label: 'Reports', controls: 'panel-reports' },
        { value: 'notifications', label: 'Notifications', count: 3, controls: 'panel-notifications' },
      ]}
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/segmented-control */
export const SegmentedControl: Story = {
  render: () => (
    <div style={canvas}>
      <DashboardTabsDemo />
    </div>
  )
}

/* ---------- select ---------- */
const models: SelectOption[] = [
  { value: 'auto', label: 'Auto', description: 'Picks the model for each message' },
  { value: 'opus', label: 'Claude Opus 5.5', description: 'Best for hard, long questions' },
  { value: 'custom', label: 'Your own model', description: 'Add an endpoint first', disabled: true },
]

function ModelSettingDemo() {
  const [model, setModel] = useState<string | null>('auto')
  return (
    <SelectComponent
      label="Default model"
      options={models}
      value={model}
      onChange={(v) => setModel(v)}
      name="model"
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/select */
export const Select: Story = {
  render: () => (
    <div style={{ ...canvas, width: 300 }}>
      <ModelSettingDemo />
    </div>
  )
}

/* ---------- separator ---------- */
/** Verbatim official source · https://www.affectui.com/components/separator */
export const Separator: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span>12 runs</span>
      <SeparatorComponent orientation="vertical" />
      <span>1 failed</span>
    </div>
  )
}

/* ---------- skeleton ---------- */
/** Verbatim official source · https://www.affectui.com/components/skeleton */
export const Skeleton: Story = {
  render: () => (
    <div style={canvas}>
      <LoadingComponent label="Loading runs">
        <div style={{ display: 'grid', gap: 10, width: 260 }}>
          {[212, 164, 176].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SkeletonComponent width={16} height={16} radius={4} />
              <span style={{ display: 'flex', alignItems: 'center', height: 20 }}>
                <SkeletonComponent line width={w} height={10} />
              </span>
            </div>
          ))}
        </div>
      </LoadingComponent>
    </div>
  )
}

/* ---------- smart-recommendation ---------- */
const recommendations: Recommendation[] = [
  { id: 'incremental', label: 'Incremental sync', reason: 'Only 4% of rows changed.', signal: 3 },
  { id: 'full', label: 'Full refresh', reason: 'Rebuilds every table.', signal: 1 },
]

/** Verbatim official source · https://www.affectui.com/components/smart-recommendation */
export const SmartRecommendation: Story = {
  render: () => (
    <div style={canvas}>
      <SmartRecommendationComponent options={recommendations} onAccept={() => {}} />
    </div>
  )
}
