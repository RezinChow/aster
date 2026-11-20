import { useCallback, useEffect, useRef, useState } from 'react'
import type { HTMLAttributes, UIEventHandler } from 'react'

import { cn } from '../../../lib/utils'

export type ScrollOrientation = 'vertical' | 'horizontal' | 'both'
export type ScrollBarType = 'hover' | 'scroll' | 'always'

export interface ScrollAreaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onScroll'> {
  orientation?: ScrollOrientation
  type?: ScrollBarType
  fade?: boolean
  maxHeight?: number | string
  viewportRef?: React.Ref<HTMLDivElement>
  onScroll?: UIEventHandler<HTMLDivElement>
}

interface Axis {
  client: number
  scroll: number
  offset: number
}

const initialAxis: Axis = { client: 1, scroll: 1, offset: 0 }

/** A native scroll box with a slim custom bar and optional soft edge fades. */
export function ScrollArea({
  orientation = 'vertical',
  type = 'hover',
  fade = false,
  maxHeight,
  viewportRef,
  onScroll,
  children,
  className,
  style,
  ...props
}: ScrollAreaProps) {
  const viewport = useRef<HTMLDivElement | null>(null)
  const vertical = orientation !== 'horizontal'
  const horizontal = orientation !== 'vertical'
  const [v, setV] = useState<Axis>(initialAxis)
  const [h, setH] = useState<Axis>(initialAxis)
  const [hovered, setHovered] = useState(false)
  const [scrolling, setScrolling] = useState(false)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const measure = useCallback(() => {
    const el = viewport.current
    if (!el) return
    setV({ client: el.clientHeight, scroll: el.scrollHeight, offset: el.scrollTop })
    setH({ client: el.clientWidth, scroll: el.scrollWidth, offset: el.scrollLeft })
  }, [])

  useEffect(() => {
    measure()
    const el = viewport.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
  }, [])

  const handleScroll: UIEventHandler<HTMLDivElement> = (event) => {
    measure()
    onScroll?.(event)
    setScrolling(true)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => setScrolling(false), 500)
  }

  const setViewport = (node: HTMLDivElement | null) => {
    viewport.current = node
    if (typeof viewportRef === 'function') viewportRef(node)
    else if (viewportRef) (viewportRef as React.RefObject<HTMLDivElement | null>).current = node
  }

  const startDrag = (axis: 'v' | 'h') => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const el = viewport.current
    if (!el) return
    const state = axis === 'v' ? v : h
    const start = axis === 'v' ? event.clientY : event.clientX
    const startOffset = state.offset
    const track = event.currentTarget.parentElement?.getBoundingClientRect()
    const trackSize = track ? (axis === 'v' ? track.height : track.width) : 1
    const move = (ev: PointerEvent) => {
      const delta = ((axis === 'v' ? ev.clientY : ev.clientX) - start) / Math.max(1, trackSize) * state.scroll
      const max = Math.max(0, state.scroll - state.client)
      const next = Math.max(0, Math.min(max, startOffset + delta))
      if (axis === 'v') el.scrollTop = next
      else el.scrollLeft = next
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const barVisible = type === 'always' || (type === 'hover' ? hovered || scrolling : scrolling)
  const vMore = v.scroll > v.client + 1
  const hMore = h.scroll > h.client + 1
  const overflow = orientation === 'both' ? 'auto' : vertical ? 'hidden auto' : 'auto hidden'

  return (
    <div
      {...props}
      data-slot="scroll-area"
      className={cn('relative overflow-hidden', className)}
      style={{ ...style, ...(maxHeight !== undefined ? { maxHeight } : {}) }}
      onMouseEnter={(event) => { setHovered(true); props.onMouseEnter?.(event) }}
      onMouseLeave={(event) => { setHovered(false); props.onMouseLeave?.(event) }}
    >
      <div
        ref={setViewport}
        role="region"
        aria-label={props['aria-label']}
        onScroll={handleScroll}
        className="size-full overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ overflow }}
      >
        {children}
      </div>

      {fade && vMore ? (
        <>
          {v.offset > 1 ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-card to-transparent" /> : null}
          {v.offset + v.client < v.scroll - 1 ? <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card to-transparent" /> : null}
        </>
      ) : null}

      {barVisible && vertical && vMore ? (
        <div className="absolute inset-y-0 right-0.5 w-1.5" aria-hidden="true">
          <div
            className="absolute w-full rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/70"
            style={{ height: `${Math.max(8, (v.client / v.scroll) * 100)}%`, top: `${(v.offset / v.scroll) * 100}%` }}
            onPointerDown={startDrag('v')}
          />
        </div>
      ) : null}
      {barVisible && horizontal && hMore ? (
        <div className="absolute inset-x-0 bottom-0.5 h-1.5" aria-hidden="true">
          <div
            className="absolute h-full rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/70"
            style={{ width: `${Math.max(8, (h.client / h.scroll) * 100)}%`, left: `${(h.offset / h.scroll) * 100}%` }}
            onPointerDown={startDrag('h')}
          />
        </div>
      ) : null}
    </div>
  )
}
