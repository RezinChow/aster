import type { Meta, StoryObj } from '@storybook/react'
import type { CSSProperties, ReactNode } from 'react'

import {
  BlurCrossfade as BlurCrossfadeComponent,
  GradientFloor as GradientFloorComponent,
  GradientText as GradientTextComponent,
  TiltCard as TiltCardComponent
} from '../../../../src/components/affect/pro-motion'

const meta = {
  title: 'Affect/Pro Motion (recreation)/Motion',
  parameters: { layout: 'padded' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const panel: CSSProperties = {
  width: 420,
  padding: 26,
  borderRadius: 14,
  color: '#f8fafc',
  background: 'linear-gradient(135deg, #1e1b4b, #0f172a)',
  border: '1px solid rgba(255,255,255,0.08)'
}

const crossfadeItems: ReactNode[] = [
  <div key="a" style={panel}>
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.6 }}>Step 1</div>
    <div style={{ fontSize: 22, fontWeight: 650, marginTop: 8 }}>A quiet beginning</div>
    <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, opacity: 0.75 }}>
      The box holds one thought at a time, then softly blurs as it hands over to the next.
    </p>
  </div>,
  <div key="b" style={{ ...panel, minHeight: 210, background: 'linear-gradient(135deg, #164e63, #0f172a)' }}>
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.6 }}>Step 2</div>
    <div style={{ fontSize: 22, fontWeight: 650, marginTop: 8 }}>Room to breathe</div>
    <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.7, opacity: 0.75 }}>
      This slide is taller. Watch the container glide to the new height while the content crossfades —
      no jump, no clipped text.
    </p>
    <p style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.7, opacity: 0.6 }}>
      Every page is measured automatically.
    </p>
  </div>,
  <div key="c" style={{ ...panel, minHeight: 120, background: 'linear-gradient(135deg, #4a044e, #0f172a)' }}>
    <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.6 }}>Step 3</div>
    <div style={{ fontSize: 22, fontWeight: 650, marginTop: 8 }}>Back to compact</div>
  </div>
]

/** High-fidelity recreation (Pro component, no public source) */
export const BlurCrossfadeAuto: Story = {
  render: () => (
    <div style={{ padding: 24, width: 470 }}>
      <BlurCrossfadeComponent items={crossfadeItems} auto interval={2400} duration={700} blur={12} />
    </div>
  )
}

/** High-fidelity recreation (Pro component, no public source) — manual switching via the dots */
export const BlurCrossfadeManual: Story = {
  render: () => (
    <div style={{ padding: 24, width: 470 }}>
      <BlurCrossfadeComponent items={crossfadeItems} auto={false} duration={520} blur={8} />
    </div>
  )
}

/** High-fidelity recreation (Pro component, no public source) */
export const GradientFloor: Story = {
  render: () => (
    <div style={{ padding: 24, width: 520 }}>
      <GradientFloorComponent height={260} speed={9} blur={40}>
        <div style={{ padding: '44px 32px 40px', minHeight: 260 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: '#c4b5fd' }}>Ambient light</div>
          <div style={{ marginTop: 12, fontSize: 30, fontWeight: 700, color: '#f8fafc' }}>Glow from below</div>
          <p style={{ margin: '12px 0 0', maxWidth: 380, fontSize: 14, lineHeight: 1.7, color: '#cbd5e1' }}>
            Two blurred gradient layers drift and morph behind the content, rising softly from the bottom edge.
          </p>
        </div>
      </GradientFloorComponent>
    </div>
  )
}

/** High-fidelity recreation (Pro component, no public source) — custom palette */
export const GradientFloorCustomColors: Story = {
  render: () => (
    <div style={{ padding: 24, width: 520 }}>
      <GradientFloorComponent colors={['#f97316', '#facc15', '#ef4444']} height={180} speed={6} blur={30}>
        <div style={{ padding: '40px 32px', minHeight: 180 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff7ed' }}>Ember floor</div>
        </div>
      </GradientFloorComponent>
    </div>
  )
}

/** High-fidelity recreation (Pro component, no public source) — the sweep plays on first view */
export const GradientText: Story = {
  render: () => (
    <div style={{ padding: 48, minWidth: 560, minHeight: 220, display: 'grid', placeItems: 'center', background: '#0b0b14', borderRadius: 16 }}>
      <GradientTextComponent as="h2" speed={6} sweepDuration={1400} style={{ fontSize: 58, fontWeight: 800, margin: 0 }}>
        Liquid关键词
      </GradientTextComponent>
    </div>
  )
}

/** High-fidelity recreation (Pro component, no public source) — move the pointer over the card to see the 3D tilt and glare */
export const TiltCard: Story = {
  render: () => (
    <div style={{ padding: 60, minWidth: 520, minHeight: 380, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 360 }}>
        <div style={{ marginBottom: 16, fontSize: 13, color: '#64748b' }}>
          Move your pointer across the card — it tilts in 3D, a soft glare follows, then springs back on leave.
        </div>
        <TiltCardComponent maxTilt={14} springDuration={560}>
          <div style={{ padding: 28, color: '#f8fafc', background: 'linear-gradient(145deg, #1e1b4b, #0f172a)' }}>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.6 }}>Interactive</div>
            <div style={{ marginTop: 10, fontSize: 24, fontWeight: 700 }}>Tilt me</div>
            <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.6, opacity: 0.75 }}>
              The surface follows your cursor and settles back gently when you move away.
            </p>
          </div>
        </TiltCardComponent>
      </div>
    </div>
  )
}

/** High-fidelity recreation (Pro component, no public source) — tilt without the glare layer */
export const TiltCardNoGlare: Story = {
  render: () => (
    <div style={{ padding: 60, minWidth: 520, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 320 }}>
        <TiltCardComponent maxTilt={18} glare={false} hoverScale={1.03}>
          <div style={{ padding: 26, color: '#f8fafc', background: 'linear-gradient(145deg, #064e3b, #0f172a)' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>No glare</div>
            <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.75 }}>Pure 3D tilt, no highlight overlay.</p>
          </div>
        </TiltCardComponent>
      </div>
    </div>
  )
}
