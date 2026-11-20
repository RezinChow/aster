import type { Meta, StoryObj } from '@storybook/react'
import { Copy, Pin, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  Button as ButtonComponent,
  IconButton as IconButtonComponent,
  ReactionBar as ReactionBarComponent,
  ToggleGroup as ToggleGroupComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Buttons',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Button: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonComponent>Save changes</ButtonComponent>
        <ButtonComponent variant="outline">Cancel</ButtonComponent>
        <ButtonComponent variant="ghost">Skip</ButtonComponent>
        <ButtonComponent variant="danger">Delete</ButtonComponent>
        <ButtonComponent loading>Working</ButtonComponent>
      </div>
    </div>
  )
}

export const IconButton: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <IconButtonComponent icon={<Plus />} label="Add item" variant="primary" />
        <IconButtonComponent icon={<Copy />} label="Copy" variant="secondary" />
        <IconButtonComponent icon={<Pin />} label="Pinned runs only" pressed />
      </div>
    </div>
  )
}

export const ReactionBar: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <ReactionBarComponent
        reactions={{
          like: { count: 12 },
          comment: { count: 4 },
          repost: { count: 2 },
          share: { count: 0 }
        }}
      />
    </div>
  )
}

export const ToggleGroup: Story = {
  render: function ToggleGroupStory() {
    const [value, setValue] = useState<string[]>(['running', 'needs-you'])
    return (
      <div className="w-full max-w-2xl">
        <ToggleGroupComponent
          aria-label="Show runs"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
          items={[
            { value: 'running', label: 'Running' },
            { value: 'needs-you', label: 'Needs you' },
            { value: 'done', label: 'Done' },
            { value: 'failed', label: 'Failed' }
          ]}
        />
      </div>
    )
  }
}
