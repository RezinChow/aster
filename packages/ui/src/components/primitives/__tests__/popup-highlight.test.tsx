// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PopupHighlight } from '../popup-highlight'

const observers: ResizeObserverCallback[] = []

afterEach(() => {
  observers.length = 0
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PopupHighlight', () => {
  it('remeasures the current item after its size changes', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        observers.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const rect = { width: 80, height: 20 }
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function () {
      return this.closest('[data-popup-surface]')
    })
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const isItem = this.getAttribute('role') === 'menuitem'
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: isItem ? rect.width : 200,
        bottom: isItem ? rect.height : 200,
        width: isItem ? rect.width : 200,
        height: isItem ? rect.height : 200,
        toJSON: () => ({})
      } as DOMRect
    })

    render(
      <div data-popup-surface>
        <PopupHighlight />
        <button role="menuitem">Resize me</button>
      </div>
    )
    const item = screen.getByRole('menuitem')
    fireEvent.focusIn(item)
    const highlight = document.querySelector('[data-slot="popup-highlight"]')
    await waitFor(() => expect(highlight).toHaveStyle({ width: '80px', height: '20px' }))

    rect.width = 120
    rect.height = 30
    act(() => observers.forEach((callback) => callback([], {} as ResizeObserver)))

    await waitFor(() => expect(highlight).toHaveStyle({ width: '120px', height: '30px' }))
  })
})
