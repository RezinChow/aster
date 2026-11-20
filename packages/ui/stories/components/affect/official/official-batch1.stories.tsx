import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import {
  Copy,
  Eye,
  FilePlus,
  Folder,
  FolderOpen,
  Link,
  MoreHorizontal,
  RotateCcw,
  Trash2
} from 'lucide-react'

import {
  AssistantMark as AssistantMarkComponent,
  Breadcrumb as BreadcrumbComponent,
  Button as ButtonComponent,
  Card as CardComponent,
  CardContent,
  CardFooter,
  CardHeader,
  ChangeSummary as ChangeSummaryComponent,
  Checkbox as CheckboxComponent,
  CodeBlock as CodeBlockComponent,
  ColorPicker as ColorPickerComponent,
  CommentThread as CommentThreadComponent,
  ContextMenu as ContextMenuComponent,
  DatePicker as DatePickerComponent,
  DecisionInbox as DecisionInboxComponent,
  Dialog as DialogComponent,
  DropdownMenu as DropdownMenuComponent
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Components',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const canvas = { padding: 24, minWidth: 340 }

/** Verbatim official source · https://www.affectui.com/components/breadcrumb */
export const Breadcrumb: Story = {
  render: () => {
    const agent = { id: 'atlas', name: 'Atlas' }
    const run = { title: 'Run #2481' }
    return (
      <div style={{ ...canvas, minWidth: 560 }}>
        <BreadcrumbComponent
          items={[
            { label: 'Agents', href: '/agents' },
            { label: agent.name, href: `/agents/${agent.id}` },
            { label: 'Runs', href: `/agents/${agent.id}/runs` },
            { label: run.title }
          ]}
        />
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/card */
export const Card: Story = {
  render: () => (
    <div style={{ ...canvas, width: 380 }}>
      <CardComponent>
        <CardHeader
          title="Support triage"
          description="Sorts new tickets and drafts the first reply"
          action={<button type="button" aria-label="More">⋯</button>}
        />
        <CardContent>142 tickets this week · 96% resolved</CardContent>
        <CardFooter>
          Running · started 2 min ago
          <button type="button" style={{ marginInlineStart: 'auto' }}>Open</button>
        </CardFooter>
      </CardComponent>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/change-summary */
export const ChangeSummary: Story = {
  render: () => {
    const changes = [
      { label: 'Active users', change: 'Up 6.1% to 18.2K', tone: 'good' as const },
      { label: 'Churn', change: 'Down to 2.1% from 2.6%', tone: 'good' as const, direction: 'down' as const },
      { label: 'Support tickets', change: 'Up 14% to 312', tone: 'bad' as const, direction: 'up' as const }
    ]
    return (
      <div style={canvas}>
        <ChangeSummaryComponent period="This week" changes={changes} />
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/checkbox */
export const Checkbox: Story = {
  render: () => <TopicsDemo />
}

function TopicsDemo() {
  const all = ['mentions', 'approvals', 'summary']
  const [picked, setPicked] = useState<string[]>([])
  return (
    <div style={canvas}>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        <legend style={{ padding: 0, marginBottom: 8, fontWeight: 500 }}>Email me about</legend>
        <CheckboxComponent
          label="Everything"
          checked={picked.length === all.length}
          indeterminate={picked.length > 0 && picked.length < all.length}
          onChange={() => setPicked(picked.length === all.length ? [] : all)}
        />
        {all.map((id) => (
          <CheckboxComponent
            key={id}
            label={id}
            checked={picked.includes(id)}
            onChange={(e) => setPicked((p) => (e.target.checked ? [...p, id] : p.filter((x) => x !== id)))}
          />
        ))}
      </fieldset>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/code-block */
export const CodeBlock: Story = {
  render: () => (
    <div style={{ ...canvas, width: 560 }}>
      <CodeBlockComponent
        language="ts"
        filename="agents/reviewer.ts"
        showLineNumbers
        highlightLines={[8, 9]}
        code={`import { defineAgent } from "@acme/agents";

export const reviewer = defineAgent({
  name: "Code reviewer",
  model: "claude-opus",
  tools: ["github", "linear"],
  // Ask before anything leaves the repo
  approval: { required: true, timeout: "2h" },
  maxSteps: 24,
});`}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/color-picker */
export const ColorPicker: Story = {
  render: () => <AgentColorDemo />
}

const PRESETS = [
  { value: '#0190fe', label: 'Blue' },
  { value: '#13b3a0', label: 'Teal' },
  { value: '#e8b000', label: 'Amber' },
  { value: '#a651f0', label: 'Purple' }
]

function AgentColorDemo() {
  const [color, setColor] = useState('#0190fe')
  return (
    <div style={{ ...canvas, minHeight: 160 }}>
      <ColorPickerComponent
        label="Agent color"
        value={color}
        onValueChange={setColor}
        onOpenChange={(open) => {
          if (!open) void color
        }}
        presets={PRESETS}
        align="end"
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/comment-thread */
export const CommentThread: Story = {
  render: () => {
    const atlas = { name: 'Atlas', avatar: <AssistantMarkComponent />, assistant: true }
    const me = { name: 'Lena Hartmann' }
    const messages = [
      {
        id: 'm1',
        author: me,
        createdAt: Date.now() - 1000 * 60 * 12,
        text: 'Can someone check the reviewer config before we enable it?'
      },
      {
        id: 'm2',
        author: atlas,
        createdAt: Date.now() - 1000 * 60 * 10,
        text: 'Reviewed the config and queued it for the next run.',
        status: 'Review complete',
        details: ['Checked 3 files', 'No blocking issues found']
      }
    ]
    return (
      <div style={canvas}>
        <CommentThreadComponent
          messages={messages}
          currentUser={me}
          assistant={atlas}
          onReply={async (text) =>
            text.includes('@Atlas')
              ? {
                  id: `reply-${Date.now()}`,
                  author: atlas,
                  createdAt: Date.now(),
                  text: 'On it — I have queued a fresh review of those changes.',
                  status: 'Review queued',
                  details: ['Opened 3 files', 'Ran typecheck']
                }
              : undefined
          }
        />
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/context-menu */
export const ContextMenu: Story = {
  render: () => {
    const files = [
      { id: 'readme', name: 'README.md' },
      { id: 'config', name: 'agent.config.ts' }
    ]
    return (
      <div style={canvas}>
        <ContextMenuComponent
          aria-label="File actions"
          items={(target) => {
            const id = target.closest<HTMLElement>('[data-file]')?.dataset.file
            const file = files.find((f) => f.id === id)
            if (!file) {
              return [{ label: 'New file', icon: <FilePlus size={16} />, shortcut: '⌘N', onSelect: () => {} }]
            }
            return [
              { label: 'Open', icon: <Eye size={16} />, onSelect: () => {} },
              { label: 'Copy link', icon: <Link size={16} />, onSelect: () => {} },
              { label: 'Duplicate', icon: <Copy size={16} />, onSelect: () => {} },
              { label: 'Delete file', icon: <Trash2 size={16} />, danger: true, divider: true, onSelect: () => {} }
            ]
          }}
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4, width: 220 }}>
            {files.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  data-file={f.id}
                  style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: '1px solid #e5e5e5', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                >
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        </ContextMenuComponent>
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/date-picker */
export const DatePicker: Story = {
  render: () => <FirstRunDemo />
}

const weekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

function FirstRunDemo() {
  const [day, setDay] = useState<Date | null>(null)
  return (
    <div style={{ ...canvas, width: 300 }}>
      <DatePickerComponent
        label="First run"
        value={day}
        onChange={setDay}
        min={new Date()}
        isDateDisabled={weekend}
        hint="Research Agent only runs on weekdays."
        name="firstRun"
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/decision-inbox */
export const DecisionInbox: Story = {
  render: () => {
    const decisions = [
      {
        id: 'renewal',
        title: 'Renew Figma for the design team?',
        detail: '12 seats · $1,800 per year · renews in 5 days',
        primary: 'Renew',
        secondary: 'Change seats'
      }
    ]
    return (
      <div style={canvas}>
        <DecisionInboxComponent
          decisions={decisions}
          onDecide={(d, answer) => {
            void d.id
            void answer
          }}
        />
      </div>
    )
  }
}

/** Verbatim official source · https://www.affectui.com/components/dialog */
export const Dialog: Story = {
  render: () => <EditAgentDemo />
}

function EditAgentDemo() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('Support triage')
  return (
    <div style={canvas}>
      <DialogComponent
        open={open}
        onOpenChange={setOpen}
        trigger={<ButtonComponent variant="secondary">Edit</ButtonComponent>}
        title="Edit agent"
        description="Changes apply from its next run."
        footer={
          <>
            <ButtonComponent variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </ButtonComponent>
            <ButtonComponent
              onClick={() => {
                void name
                setOpen(false)
              }}
            >
              Save
            </ButtonComponent>
          </>
        }
      >
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </DialogComponent>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/dropdown-menu */
export const DropdownMenu: Story = {
  render: () => {
    const run = { id: 'r-2481', name: 'Nightly review', folder: 'design' }
    const folders = [
      { id: 'design', name: 'Design', icon: <Folder size={16} /> },
      { id: 'engineering', name: 'Engineering', icon: <FolderOpen size={16} /> }
    ]
    return (
      <div style={{ ...canvas, minHeight: 200 }}>
        <DropdownMenuComponent
          align="end"
          items={[
            { label: 'Rerun', icon: <RotateCcw size={16} />, shortcut: '⌘R', onSelect: () => {} },
            { label: 'Duplicate', icon: <Copy size={16} />, onSelect: () => {} },
            {
              label: 'Move to',
              icon: <Folder size={16} />,
              divider: true,
              submenu: folders.map((f) => ({
                label: f.name,
                icon: f.icon,
                checked: f.id === run.folder,
                onSelect: () => {}
              }))
            },
            { label: 'Delete run', icon: <Trash2 size={16} />, danger: true, divider: true, onSelect: () => {} }
          ]}
          trigger={({ triggerProps }) => (
            <button type="button" aria-label={`Actions for ${run.name}`} {...triggerProps}>
              <MoreHorizontal size={16} />
            </button>
          )}
        />
      </div>
    )
  }
}
