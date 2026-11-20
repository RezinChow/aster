// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

type RenderableStory = { render?: () => ReactNode }

const modules = import.meta.glob<Record<string, unknown>>(
  '../../../../stories/components/affect/**/*.stories.tsx',
  { eager: true }
)

afterEach(cleanup)

describe('affect Storybook stories', () => {
  for (const [path, module] of Object.entries(modules)) {
    const parts = path.split('/')
    const file = parts.pop()?.replace('.stories.tsx', '') ?? path
    const sub = parts.pop()
    const group = sub && sub !== 'affect' ? `${sub}/${file}` : file
    for (const [name, value] of Object.entries(module)) {
      if (name === 'default' || !value || typeof value !== 'object' || typeof (value as RenderableStory).render !== 'function') continue
      it(`renders ${group}/${name}`, () => {
        const renderStory = (value as RenderableStory).render as () => ReactNode
        const StoryHost = () => <>{renderStory()}</>
        const { container } = render(<StoryHost />)
        expect(container.firstChild).not.toBeNull()
      })
    }
  }
})
