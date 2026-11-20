import { useEffect, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export type HoverCardSide = 'bottom' | 'top' | 'right' | 'left'
export type HoverCardAlign = 'start' | 'center' | 'end'

export interface HoverCardProps {
  content: ReactNode
  children: ReactElement
  side?: HoverCardSide
  align?: HoverCardAlign
  offset?: number
  openDelay?: number
  closeDelay?: number
  width?: number | string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  className?: string
}

const sideClass: Record<HoverCardSide, string> = {
  bottom: 'top-full',
  top: 'bottom-full',
  left: 'right-full',
  right: 'left-full'
}

const crossAlign: Record<HoverCardAlign, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0'
}

const mainAlign: Record<HoverCardAlign, string> = {
  start: 'top-0',
  center: 'top-1/2 -translate-y-1/2',
  end: 'bottom-0'
}

/** A preview that opens after a short rest of the pointer or on keyboard focus. */
export function HoverCard({
  content,
  children,
  side = 'bottom',
  align = 'start',
  offset = 8,
  openDelay = 600,
  closeDelay = 300,
  width,
  open,
  onOpenChange,
  disabled = false,
  className
}: HoverCardProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOpen = open ?? internalOpen

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => clear, [])

  const update = (next: boolean) => {
    clear()
    timer.current = setTimeout(() => {
      setInternalOpen(next)
      onOpenChange?.(next)
    }, next ? openDelay : closeDelay)
  }
  const showNow = () => {
    clear()
    setInternalOpen(true)
    onOpenChange?.(true)
  }

  const vertical = side === 'top' || side === 'bottom'
  const positionClass = vertical ? crossAlign[align] : mainAlign[align]
  const gapStyle = vertical
    ? { marginTop: side === 'bottom' ? offset : undefined, marginBottom: side === 'top' ? offset : undefined }
    : { marginLeft: side === 'right' ? offset : undefined, marginRight: side === 'left' ? offset : undefined }

  return (
    <span
      data-slot="hover-card"
      className="relative inline-flex"
      onMouseEnter={() => { if (!disabled) update(true) }}
      onMouseLeave={() => update(false)}
      onFocusCapture={() => { if (!disabled) showNow() }}
      onBlurCapture={() => update(false)}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          clear()
          setInternalOpen(false)
          onOpenChange?.(false)
        }
      }}
    >
      {children}
      {isOpen && content != null && content !== '' ? (
        <span
          role="tooltip"
          style={{ ...gapStyle, width }}
          className={cn(
            'absolute z-50 block w-max max-w-xs rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg',
            sideClass[side],
            positionClass,
            className
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}
