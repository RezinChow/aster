import type { Meta, StoryObj } from '@storybook/react'
import { Copy, Home, LogOut, Search, Settings, Sparkles, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import type { CommandGroup } from '../../../src/components/affect/navigation/command-menu'
import type { MenuItem } from '../../../src/components/affect/navigation/dropdown-menu'
import type { Integration } from '../../../src/components/affect/navigation/integration-picker'
import type { ProfileMenuItem } from '../../../src/components/affect/navigation/profile-menu'
import {
  Breadcrumb as BreadcrumbComponent,
  CommandMenu as CommandMenuComponent,
  ContextMenu as ContextMenuComponent,
  DropdownMenu as DropdownMenuComponent,
  IntegrationPicker as IntegrationPickerComponent,
  Pagination as PaginationComponent,
  Popover as PopoverComponent,
  ProfileMenu as ProfileMenuComponent,
  SegmentedControl as SegmentedControlComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Navigation',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

const commandGroups: CommandGroup[] = [
  {
    id: 'suggestions',
    label: 'Suggestions',
    commands: [
      { id: 'ask', label: 'Ask the assistant', icon: <Sparkles className="size-4" />, keys: '⌘ K' }
    ]
  },
  {
    id: 'nav',
    label: 'Navigate',
    commands: [
      { id: 'home', label: 'Home', icon: <Home className="size-4" />, keys: 'G H' },
      { id: 'search', label: 'Search', icon: <Search className="size-4" /> },
      { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> }
    ]
  }
]

const contextItems: MenuItem[] = [
  { label: 'Copy', icon: <Copy className="size-4" />, onSelect: () => {} },
  {
    label: 'Delete',
    icon: <Trash2 className="size-4" />,
    danger: true,
    divider: true,
    onSelect: () => {}
  }
]

const dropdownItems: MenuItem[] = [
  { label: 'Rerun', shortcut: '⌘R', onSelect: () => {} },
  { label: 'Duplicate', onSelect: () => {} },
  {
    label: 'Move to',
    divider: true,
    submenu: [{ label: 'Archive', onSelect: () => {} }]
  },
  { label: 'Delete run', danger: true, divider: true, onSelect: () => {} }
]

const integrations: Integration[] = [
  {
    id: 'linear',
    name: 'Linear',
    domain: 'linear.app',
    category: 'Productivity',
    description: 'Track issues and projects',
    color: '#5e6ad2',
    connected: true
  },
  {
    id: 'slack',
    name: 'Slack',
    domain: 'slack.com',
    category: 'Communication',
    description: 'Team messaging',
    color: '#4a154b'
  },
  {
    id: 'github',
    name: 'GitHub',
    domain: 'github.com',
    category: 'Development',
    description: 'Source code and pull requests',
    color: '#24292f'
  }
]

const profileItems: ProfileMenuItem[] = [
  { id: 'settings', label: 'Settings', icon: <Settings className="size-4" /> },
  { id: 'logout', label: 'Logout', icon: <LogOut className="size-4" /> }
]

export const Breadcrumb: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <BreadcrumbComponent
        items={[
          { label: 'Workspace', href: '#' },
          { label: 'Agents', href: '#' },
          { label: 'Run 42' }
        ]}
      />
    </div>
  )
}

export const CommandMenu: Story = {
  render: () => (
    <div className="w-full max-w-xl rounded-lg border border-border bg-card p-4">
      <CommandMenuComponent
        groups={commandGroups}
        placeholder="Type a command…"
        onRun={() => {}}
      />
    </div>
  )
}

export const ContextMenu: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <ContextMenuComponent aria-label="Item actions" items={contextItems}>
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-foreground">
          Right-click this card to open the context menu.
        </div>
      </ContextMenuComponent>
    </div>
  )
}

export const DropdownMenu: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <DropdownMenuComponent
        items={dropdownItems}
        trigger={({ triggerProps }) => (
          <button
            type="button"
            {...triggerProps}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            Open menu
          </button>
        )}
      />
    </div>
  )
}

export const IntegrationPicker: Story = {
  render: () => (
    <div className="w-full max-w-xl">
      <IntegrationPickerComponent
        integrations={integrations}
        appName="affectUI"
        onToggle={() => {}}
        onExplore={() => {}}
      />
    </div>
  )
}

export const Pagination: Story = {
  render: function PaginationStory() {
    const [page, setPage] = useState(2)
    return (
      <div className="w-full max-w-md">
        <PaginationComponent page={page} onPageChange={setPage} total={96} pageSize={10} />
      </div>
    )
  }
}

export const Popover: Story = {
  render: function PopoverStory() {
    const anchor = useRef<HTMLSpanElement>(null)
    const [open, setOpen] = useState(false)
    return (
      <div className="w-full max-w-md">
        <span ref={anchor} className="inline-flex">
          <button
            type="button"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            onClick={() => setOpen((value) => !value)}
          >
            Open popover
          </button>
        </span>
        <PopoverComponent
          open={open}
          onClose={() => setOpen(false)}
          anchor={anchor}
          title="Invite to the workspace"
          description="They get an email with a link to join."
          width={300}
        >
          <div className="p-3 text-xs text-muted-foreground">Popover content goes here.</div>
        </PopoverComponent>
      </div>
    )
  }
}

export const ProfileMenu: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <ProfileMenuComponent
        name="Lena Hartmann"
        email="lena.hartmann@fastmail.com"
        items={profileItems}
        setup={{ done: 3, total: 5, next: 'Add a profile photo' }}
      />
    </div>
  )
}

export const SegmentedControl: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <SegmentedControlComponent
        options={[
          { value: 'all', label: 'All', count: 12 },
          { value: 'running', label: 'Running', count: 3 },
          { value: 'waiting', label: 'Waiting', count: 2 }
        ]}
        defaultValue="all"
      />
    </div>
  )
}
