import { useEffect, useId, useRef } from 'react'
import type { HTMLAttributes, ReactNode, RefObject } from 'react'

import { cn } from '../../../lib/utils'

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean
  onClose: () => void
  side?: 'bottom' | 'top' | 'right' | 'left'
  align?: 'start' | 'center' | 'end'
  offset?: number
  anchor?: RefObject<HTMLElement | null>
  title?: ReactNode
  description?: ReactNode
  width?: number | string
  focusOnOpen?: boolean
  unstyled?: boolean
}

/** Floating card anchored to its parent, with flipping, outside-press and Escape handling. */
export function Popover({
  open,
  onClose,
  side = 'bottom',
  align = 'start',
  offset = 6,
  anchor,
  title,
  description,
  width,
  focusOnOpen = true,
  unstyled = false,
  role = 'dialog',
  children,
  className,
  style,
  ...props
}: PopoverProps) {
  const id = useId()
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const card = cardRef.current
    if (!card) return
    const getAnchor = () => anchor?.current ?? card.parentElement
    const place = () => {
      const element = getAnchor()
      if (!element) return
      const rect = element.getBoundingClientRect()
      const box = card.getBoundingClientRect()
      const gap = offset
      let top = rect.bottom + gap
      let left = rect.left
      if (side === 'top') top = rect.top - box.height - gap
      if (side === 'right') { top = rect.top; left = rect.right + gap }
      if (side === 'left') { top = rect.top; left = rect.left - box.width - gap }
      if (align === 'center') left += side === 'top' || side === 'bottom' ? (rect.width - box.width) / 2 : 0
      if (align === 'end') left += side === 'top' || side === 'bottom' ? rect.width - box.width : 0
      if (side === 'right' || side === 'left') {
        if (align === 'center') top += (rect.height - box.height) / 2
        if (align === 'end') top += rect.height - box.height
      }
      left = Math.max(8, Math.min(left, window.innerWidth - box.width - 8))
      top = Math.max(8, Math.min(top, window.innerHeight - box.height - 8))
      card.style.top = `${top}px`
      card.style.left = `${left}px`
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    if (focusOnOpen) {
      const target = card.querySelector<HTMLElement>('input, button, select, textarea, [tabindex]:not([tabindex="-1"])') ?? card
      target.focus({ preventScroll: true })
    }
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place) }
  }, [open, side, align, offset, anchor, focusOnOpen])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const card = cardRef.current
      if (!card) return
      const element = anchor?.current ?? card.parentElement
      const target = e.target as Node
      if (!card.contains(target) && !element?.contains(target)) onClose()
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open, onClose, anchor])

  if (!open) return null

  return (
    <div
      {...props}
      ref={cardRef}
      role={role}
      data-slot="popover"
      aria-labelledby={title ? `${id}-title` : undefined}
      aria-describedby={description ? `${id}-desc` : undefined}
      tabIndex={-1}
      style={{ ...style, position: 'fixed', width, maxWidth: 'calc(100vw - 16px)', zIndex: 50, outline: 'none' }}
      className={cn(!unstyled && 'rounded-lg border border-border bg-card p-3 text-foreground shadow-lg', className)}
    >
      {title ? <div id={`${id}-title`} className="mb-1 text-sm font-medium">{title}</div> : null}
      {description ? <div id={`${id}-desc`} className="mb-2 text-xs text-muted-foreground">{description}</div> : null}
      {children}
    </div>
  )
}
