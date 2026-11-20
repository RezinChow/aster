import { cloneElement, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'
export type TooltipAlign = 'start' | 'center' | 'end'

export interface TooltipProps {
  content: ReactNode
  shortcut?: string
  children: ReactElement<{ 'aria-describedby'?: string }>
  side?: TooltipSide
  align?: TooltipAlign
  offset?: number
  delay?: number
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

const sideClass: Record<TooltipSide, string> = {
  top: 'bottom-full',
  bottom: 'top-full',
  left: 'right-full',
  right: 'left-full'
}

const crossAlign: Record<TooltipAlign, string> = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0'
}

const mainAlign: Record<TooltipAlign, string> = {
  start: 'top-0',
  center: 'top-1/2 -translate-y-1/2',
  end: 'bottom-0'
}

let lastClose = 0

/** A small dark label for one control, shown on hover after a short wait. */
export function Tooltip({
  content,
  shortcut,
  children,
  side = 'top',
  align = 'center',
  offset = 6,
  delay = 500,
  disabled = false,
  open,
  onOpenChange,
  className
}: TooltipProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const id = useId()
  const isOpen = open ?? internalOpen

  const clear = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  const show = (immediate: boolean) => {
    if (disabled || content == null || content === '') return
    clear()
    if (immediate) {
      setInternalOpen(true)
      onOpenChange?.(true)
      return
    }
    timer.current = setTimeout(() => {
      setInternalOpen(true)
      onOpenChange?.(true)
    }, delay)
  }

  const hide = () => {
    clear()
    lastClose = Date.now()
    setInternalOpen(false)
    onOpenChange?.(false)
  }

  if (content == null || content === '') return children

  const vertical = side === 'top' || side === 'bottom'
  const gapStyle = vertical
    ? { marginBottom: side === 'top' ? offset : undefined, marginTop: side === 'bottom' ? offset : undefined }
    : { marginRight: side === 'left' ? offset : undefined, marginLeft: side === 'right' ? offset : undefined }
  const child = cloneElement(children, { 'aria-describedby': isOpen ? id : undefined })

  return (
    <span
      data-slot="tooltip"
      className="relative inline-flex"
      onMouseEnter={() => show(Date.now() - lastClose < 300)}
      onMouseLeave={hide}
      onFocusCapture={() => show(true)}
      onBlurCapture={hide}
      onKeyDownCapture={(event) => { if (event.key === 'Escape') hide() }}
    >
      {child}
      {isOpen ? (
        <span
          id={id}
          role="tooltip"
          style={gapStyle}
          className={cn(
            'pointer-events-none absolute z-50 block w-max max-w-60 rounded bg-foreground px-2 py-1 text-[11px] leading-snug text-background shadow-md',
            sideClass[side],
            vertical ? crossAlign[align] : mainAlign[align],
            className
          )}
        >
          {content}
          {shortcut ? <span className="ml-2 rounded border border-background/30 px-1 py-px text-[10px] opacity-80">{shortcut}</span> : null}
        </span>
      ) : null}
    </span>
  )
}
