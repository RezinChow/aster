import type { Meta, StoryObj } from '@storybook/react'

import {
  LogoMarquee as LogoMarqueeComponent,
  TestimonialWall as TestimonialWallComponent
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Blocks',
  parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Verbatim official source · https://www.affectui.com/blocks/logo-marquee */
export const LogoMarquee: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <LogoMarqueeComponent
        labels="below"
        pauseOnHover
        logos={[
          { name: 'Figma', color: '#F24E1E' },
          { name: 'Slack', color: '#4A154B' },
          { name: 'Stripe', color: '#635BFF' },
          { name: 'Linear', color: '#5E6AD2' },
          { name: 'Notion' },
          { name: 'Vercel' }
        ]}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/blocks/testimonial-wall */
export const TestimonialWall: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <TestimonialWallComponent
        columns={3}
        pauseOnHover
        items={[
          { quote: 'We shipped in days what would have taken us weeks.', name: 'Mike', role: 'recruitpilot', rating: 5, verified: true },
          { quote: 'Every component feels like a senior designer obsessed over it.', name: 'Matt', role: 'OpenRouter', rating: 5 },
          { quote: 'The agents-first patterns dropped straight into our console.', name: 'Lena', role: 'Northwind', rating: 4 },
          { quote: 'Dark mode and motion just work, out of the box.', name: 'Kai', role: 'Acme', rating: 5 },
          { quote: 'One file per piece made adoption trivial for the team.', name: 'Mira', role: 'Contoso', rating: 4 },
          { quote: 'Our users noticed the polish immediately.', name: 'Sam', role: 'Globex', rating: 5 }
        ]}
      />
    </div>
  )
}
