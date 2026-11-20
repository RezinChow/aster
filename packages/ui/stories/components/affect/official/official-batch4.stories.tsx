import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Code, FileText, Folder, FolderOpen, Plug, Search } from 'lucide-react'

import {
  Spinner as SpinnerComponent,
  Switch as SwitchComponent,
  TagInput as TagInputComponent,
  TextArea as TextAreaComponent,
  TimePicker as TimePickerComponent,
  TipsPanel as TipsPanelComponent,
  TipsKbd,
  ToggleGroup as ToggleGroupComponent,
  ToolCallCard as ToolCallCardComponent,
  ToolCallGroup,
  Tooltip as TooltipComponent,
  TreeView as TreeViewComponent,
  type Tip,
  type ToolCallStatus,
  type TreeNode
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Components',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const canvas = { padding: 24, minWidth: 340 }

/* ------------------------------- spinner ------------------------------- */

function ConnectButton({ busy, onConnect }: { busy: boolean; onConnect: () => void }) {
  return (
    <button type="button" aria-disabled={busy || undefined} onClick={() => !busy && onConnect()}>
      {busy ? <SpinnerComponent /> : <Plug size={14} />}
      {busy ? 'Connecting' : 'Connect GitHub'}
    </button>
  )
}

function SpinnerDemo() {
  const [busy, setBusy] = useState(false)
  return (
    <div style={{ ...canvas, display: 'flex', gap: 20, alignItems: 'center' }}>
      <ConnectButton
        busy={busy}
        onConnect={() => {
          setBusy(true)
          window.setTimeout(() => setBusy(false), 1600)
        }}
      />
      {/* On its own, without words next to it: give it a label */}
      <SpinnerComponent size={12} label="Checking domain" />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/spinner */
export const Spinner: Story = {
  render: () => <SpinnerDemo />
}

/* -------------------------------- switch -------------------------------- */

function DigestSetting({ onSave }: { onSave: (on: boolean) => void }) {
  const [on, setOn] = useState(true)
  return (
    <SwitchComponent
      placement="end"
      label="Daily digest"
      description="Approvals waiting, runs that finished or failed"
      checked={on}
      onChange={(e) => {
        setOn(e.target.checked)
        onSave(e.target.checked)
      }}
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/switch */
export const Switch: Story = {
  render: () => (
    <div style={{ ...canvas, width: 340 }}>
      <DigestSetting onSave={() => {}} />
    </div>
  )
}

/* ------------------------------- tag-input ------------------------------ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function InviteField() {
  const [emails, setEmails] = useState<string[]>([])
  return (
    <TagInputComponent
      label="Invite people"
      value={emails}
      onChange={setEmails}
      placeholder="name@company.com"
      avatar
      splitOnSpace
      max={10}
      normalize={(t) => t.trim().toLowerCase()}
      validate={(t) => (EMAIL.test(t) ? true : `“${t}” doesn't look like an email address.`)}
      name="emails"
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/tag-input */
export const TagInput: Story = {
  render: () => (
    <div style={{ ...canvas, width: 360 }}>
      <InviteField />
    </div>
  )
}

/* ------------------------------- text-area ------------------------------ */

function CompanyContext({ onSave }: { onSave: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <TextAreaComponent
      label="Company context"
      hint="Added to every chat in this workspace."
      value={text}
      onChange={(e) => setText(e.target.value)}
      maxLength={2000}
      counter
      minRows={3}
      maxRows={8}
      expandable
      onSubmitShortcut={onSave}
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/text-area */
export const TextArea: Story = {
  render: () => (
    <div style={{ ...canvas, width: 420 }}>
      <CompanyContext onSave={() => {}} />
    </div>
  )
}

/* ------------------------------ time-picker ----------------------------- */

function RunAt() {
  const [time, setTime] = useState<string | null>('09:30')
  return (
    <TimePickerComponent
      label="Run at"
      value={time}
      onChange={setTime}
      step={15}
      hint="Every weekday, in your time zone."
      name="runAt"
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/time-picker */
export const TimePicker: Story = {
  render: () => (
    <div style={{ ...canvas, width: 320 }}>
      <RunAt />
    </div>
  )
}

/* ------------------------------- tips-panel ----------------------------- */

const tips: Tip[] = [
  {
    id: 'search',
    title: 'Quick search',
    description: (
      <>
        Press <TipsKbd>⌘K</TipsKbd> to jump anywhere.
      </>
    ),
    action: 'Try it'
  },
  {
    id: 'pro',
    title: 'Ready for Pro?',
    description: 'Unlimited projects and priority support.',
    action: 'See plans',
    primary: true
  }
]

function Tips({ onClose }: { onClose: () => void }) {
  return <TipsPanelComponent tips={tips} onClose={onClose} />
}

function TipsDemo() {
  const [open, setOpen] = useState(true)
  return open ? (
    <Tips onClose={() => setOpen(false)} />
  ) : (
    <button type="button" onClick={() => setOpen(true)}>
      Show tips
    </button>
  )
}

/** Verbatim official source · https://www.affectui.com/components/tips-panel */
export const TipsPanel: Story = {
  render: () => (
    <div style={{ ...canvas, width: 720, maxWidth: '100%' }}>
      <TipsDemo />
    </div>
  )
}

/* ------------------------------ toggle-group ---------------------------- */

function RunFilters() {
  const [status, setStatus] = useState(['running', 'needs-you'])
  return (
    <ToggleGroupComponent
      aria-label="Show runs"
      value={status}
      onChange={setStatus}
      items={[
        { value: 'running', label: 'Running' },
        { value: 'needs-you', label: 'Needs you' },
        { value: 'done', label: 'Done' },
        { value: 'failed', label: 'Failed' }
      ]}
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/toggle-group */
export const ToggleGroup: Story = {
  render: () => (
    <div style={canvas}>
      <RunFilters />
    </div>
  )
}

/* ----------------------------- tool-call-card --------------------------- */

type ToolCall = {
  id: string
  name: string
  summary: string
  status: ToolCallStatus
  args?: unknown
  result?: unknown
  error?: string
  startedAt?: number
  durationMs?: number
}

const calls: ToolCall[] = [
  {
    id: 'search',
    name: 'search_web',
    summary: "Searched the web for 'CRM pricing 2026'",
    status: 'success',
    args: { query: 'CRM pricing 2026', limit: 5 },
    result: { results: 5, top: 'Acme CRM — Plans & Pricing' },
    startedAt: Date.now() - 3120,
    durationMs: 2340
  },
  {
    id: 'fetch',
    name: 'fetch_page',
    summary: 'Reading the pricing page',
    status: 'running',
    args: { url: 'https://example.com/pricing' },
    startedAt: Date.now()
  },
  {
    id: 'save',
    name: 'save_notes',
    summary: 'Saving research notes',
    status: 'error',
    args: { file: 'notes.md' },
    error: 'Permission denied: cannot write to notes.md',
    durationMs: 412
  }
]

function ToolCalls({ calls, onRetry }: { calls: ToolCall[]; onRetry: (id: string) => void }) {
  return (
    <ToolCallGroup>
      {calls.map((call) => (
        <ToolCallCardComponent
          key={call.id}
          name={call.name}
          summary={call.summary}
          status={call.status}
          args={call.args}
          result={call.result}
          error={call.error}
          startedAt={call.startedAt}
          duration={call.durationMs}
          onRetry={() => onRetry(call.id)}
        />
      ))}
    </ToolCallGroup>
  )
}

/** Verbatim official source · https://www.affectui.com/components/tool-call-card */
export const ToolCallCard: Story = {
  render: () => (
    <div style={{ ...canvas, width: 520, maxWidth: '100%' }}>
      <ToolCalls calls={calls} onRetry={() => {}} />
    </div>
  )
}

/* -------------------------------- tooltip ------------------------------- */

function SearchTool({ onSearch }: { onSearch: () => void }) {
  return (
    // One child element: the Tooltip clones it and adds its handlers, ref and aria-describedby
    <TooltipComponent content="Search runs" shortcut="⌘K" side="bottom">
      {/* title="" leaves out the button's own browser tooltip */}
      <button
        type="button"
        aria-label="Search runs"
        title=""
        onClick={onSearch}
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: 32,
          height: 32,
          padding: 0,
          borderRadius: 7,
          border: '1px solid rgba(0,0,0,0.12)',
          background: '#fff',
          color: 'rgba(0,0,0,0.7)',
          cursor: 'pointer'
        }}
      >
        <Search size={16} />
      </button>
    </TooltipComponent>
  )
}

/** Verbatim official source · https://www.affectui.com/components/tooltip */
export const Tooltip: Story = {
  render: () => (
    <div style={{ ...canvas, padding: 60 }}>
      <SearchTool onSearch={() => {}} />
    </div>
  )
}

/* ------------------------------- tree-view ------------------------------ */

const files: TreeNode[] = [
  {
    id: 'prompts',
    label: 'prompts',
    icon: <Folder size={16} />,
    openIcon: <FolderOpen size={16} />,
    children: [
      { id: 'prompts/system', label: 'system.md', icon: <FileText size={16} /> },
      { id: 'prompts/tools', label: 'tools.md', icon: <FileText size={16} /> }
    ]
  },
  { id: 'agent', label: 'agent.yaml', icon: <Code size={16} />, meta: '2 KB' }
]

function Workspace({ onOpen }: { onOpen: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <TreeViewComponent
      aria-label="Workspace"
      items={files}
      defaultExpanded={['prompts']}
      selected={selected}
      onSelect={(id, node) => {
        setSelected(id)
        if (!node.children) onOpen(id)
      }}
    />
  )
}

/** Verbatim official source · https://www.affectui.com/components/tree-view */
export const TreeView: Story = {
  render: () => (
    <div style={{ ...canvas, width: 320 }}>
      <Workspace onOpen={() => {}} />
    </div>
  )
}
