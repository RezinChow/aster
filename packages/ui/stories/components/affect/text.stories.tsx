import type { Meta, StoryObj } from '@storybook/react'

import {
  CodeBlock as CodeBlockComponent,
  Kbd as KbdComponent
} from '../../../src/components/affect'

const meta = {
  title: 'Affect/Components/Text',
  parameters: { layout: 'padded' },
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const CodeBlock: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <CodeBlockComponent
        language="ts"
        filename="agents/reviewer.ts"
        showLineNumbers
        highlightLines={[3, 4]}
        code={`import { defineAgent } from "agents";

export const reviewer = defineAgent({
  name: "Code reviewer",
  model: "claude-opus",
  // Ask before pushing any change
  approvals: true,
});`}
      />
    </div>
  )
}

export const Kbd: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
        <span>Search <KbdComponent keys={['mod', 'K']} /></span>
        <span>Save <KbdComponent keys={['mod', 'enter']} /></span>
        <span>Close <KbdComponent keys="esc" platform="mac" /></span>
      </div>
    </div>
  )
}
