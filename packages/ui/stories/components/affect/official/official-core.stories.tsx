import type { Meta, StoryObj } from '@storybook/react'

import {
  Avatar as AvatarComponent,
  AvatarGroup,
  Badge as BadgeComponent,
  Button as ButtonComponent,
  TextField as TextFieldComponent,
  ThinkingLoader as ThinkingLoaderComponent
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Core',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const canvas = { padding: 24, minWidth: 340 }

/** Verbatim official source · https://www.affectui.com/components/button */
export const Button: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'flex', gap: 10, alignItems: 'center' }}>
      <ButtonComponent variant="ghost">Cancel</ButtonComponent>
      <ButtonComponent>Save changes</ButtonComponent>
      <ButtonComponent variant="destructive">Delete</ButtonComponent>
      <ButtonComponent loading>Working</ButtonComponent>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/badge */
export const Badge: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <BadgeComponent tone="info" live>Running</BadgeComponent>
      <BadgeComponent tone="warning" dot>Needs you</BadgeComponent>
      <BadgeComponent tone="success">Done</BadgeComponent>
      <BadgeComponent tone="danger">Failed</BadgeComponent>
      <BadgeComponent tone="neutral">Queued</BadgeComponent>
      <BadgeComponent count={12} max={9} tone="info" />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/avatar */
export const Avatar: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'flex', alignItems: 'center', gap: 16 }}>
      <AvatarComponent name="Lena Hartmann" size={40} status="online" />
      <AvatarComponent name="Atlas" size={40} kind="agent" working />
      <AvatarGroup size={32} max={4} total={9}>
        <AvatarComponent name="Lena Hartmann" />
        <AvatarComponent name="Kai Novak" />
        <AvatarComponent name="Mira Chen" />
        <AvatarComponent name="Sam Park" />
      </AvatarGroup>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/text-field */
export const TextField: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'grid', gap: 14 }}>
      <TextFieldComponent label="Workspace slug" placeholder="acme" prefix="https://" suffix=".acme.app" hint="Lowercase letters and dashes" />
      <TextFieldComponent label="API key" defaultValue="sk_live_51H8x2e" readOnly copyable />
      <TextFieldComponent label="Email" type="email" error="Enter a valid email" />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/components/thinking-loader */
export const ThinkingLoader: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'grid', gap: 16 }}>
      <ThinkingLoaderComponent />
      <ThinkingLoaderComponent variant="plain" />
      <ThinkingLoaderComponent done doneLabel={(seconds: number) => `Thought for ${seconds}s`} />
    </div>
  )
}
