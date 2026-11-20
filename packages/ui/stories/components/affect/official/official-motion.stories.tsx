import type { Meta, StoryObj } from '@storybook/react'

import {
  GridBackground as GridBackgroundComponent,
  NumberTicker as NumberTickerComponent,
  ShimmerSkeleton as ShimmerSkeletonComponent,
  ShimmerText as ShimmerTextComponent,
  TextReveal as TextRevealComponent
} from '../../../../src/components/affect/official'

const meta = {
  title: 'Affect/Official (MIT 1:1)/Motion',
  parameters: { layout: 'centered' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const canvas = { padding: 24, minWidth: 360 }

/** Verbatim official source · https://www.affectui.com/motion/grid-background */
export const GridBackground: Story = {
  render: () => (
    <GridBackgroundComponent size={48} speed={0} direction="diagonal" reveal={false} fade={70}>
      <div
        style={{
          ...canvas,
          height: 240,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}
      >
        <strong style={{ fontSize: 22 }}>Still grid</strong>
        <span style={{ fontSize: 13, opacity: 0.6 }}>Speed 0 keeps the grid in place, no reveal</span>
      </div>
    </GridBackgroundComponent>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/grid-background */
export const GridBackgroundReveal: Story = {
  render: () => (
    <GridBackgroundComponent size={36} speed={2} direction="right" reveal fade={80}>
      <div
        style={{
          ...canvas,
          height: 240,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}
      >
        <strong style={{ fontSize: 22 }}>Drifting grid</strong>
        <span style={{ fontSize: 13, opacity: 0.6 }}>Reveals from the center, then drifts to the right</span>
      </div>
    </GridBackgroundComponent>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/number-ticker */
export const NumberTicker: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'grid', gap: 10, fontSize: 40, fontWeight: 600 }}>
      <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.6 }}>Counts in from zero on first view</span>
      <NumberTickerComponent value={8240} duration={900} />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/number-ticker */
export const NumberTickerCurrency: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'grid', gap: 10, fontSize: 40, fontWeight: 600 }}>
      <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.6 }}>Intl formatting keeps the symbol and separators still</span>
      <NumberTickerComponent
        value={48240}
        format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }}
        locale="en-US"
        duration={1200}
        delay={150}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/shimmer-loader */
export const ShimmerText: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'grid', gap: 12 }}>
      <span style={{ fontSize: 13, opacity: 0.6 }}>A highlight band runs through the letters</span>
      <div style={{ fontSize: 32, fontWeight: 600 }}>
        <ShimmerTextComponent duration={2}>Thinking…</ShimmerTextComponent>
      </div>
      <div style={{ fontSize: 20 }}>
        <ShimmerTextComponent duration={3}>Generating your answer</ShimmerTextComponent>
      </div>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/shimmer-loader */
export const ShimmerSkeletons: Story = {
  render: () => (
    <div style={{ ...canvas, display: 'grid', gap: 14, width: 340 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShimmerSkeletonComponent circle width={44} height={44} />
        <div style={{ display: 'grid', gap: 8, flex: 1 }}>
          <ShimmerSkeletonComponent width="70%" height={14} radius={6} />
          <ShimmerSkeletonComponent width="45%" height={12} radius={6} />
        </div>
      </div>
      <ShimmerSkeletonComponent width="100%" height={140} radius={10} />
      <div style={{ display: 'flex', gap: 10 }}>
        <ShimmerSkeletonComponent width={120} height={32} radius={8} />
        <ShimmerSkeletonComponent width={88} height={32} radius={8} />
      </div>
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/text-reveal */
export const TextReveal: Story = {
  render: () => (
    <div style={{ ...canvas, maxWidth: 520, fontSize: 26 }}>
      <TextRevealComponent
        as="h2"
        by="word"
        text="Words fade in one by one as the text scrolls into view."
        stagger={55}
        duration={700}
      />
    </div>
  )
}

/** Verbatim official source · https://www.affectui.com/motion/text-reveal */
export const TextRevealLetters: Story = {
  render: () => (
    <div style={{ ...canvas, maxWidth: 520, fontSize: 22, lineHeight: 1.4 }}>
      <TextRevealComponent
        as="p"
        by="char"
        text="Every letter rises out of a soft blur, one after another."
        stagger={22}
        duration={600}
      />
    </div>
  )
}
