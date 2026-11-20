import { X } from 'lucide-react'
import { cloneElement, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode, RefObject } from 'react'

import { cn } from '../../../lib/utils'

type DialogTrigger = ReactElement<{
  onClick?: (event: MouseEvent<HTMLElement>) => void
  'aria-haspopup'?: string
  'aria-expanded'?: boolean
}>

export interface DialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: DialogTrigger
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  width?: number | string
  closeOnBackdrop?: boolean
  closeButton?: boolean
  closeLabel?: string
  initialFocus?: RefObject<HTMLElement | null>
  className?: string
}

const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }

/** A modal dialog on a dimmed backdrop with focus kept inside. */
export function Dialog({
  open,
  defaultOpen = false,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
  width,
  closeOnBackdrop = true,
  closeButton = true,
  closeLabel = 'Close',
  initialFocus,
  className
}: DialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  const update = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    )
    const target = initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? focusable()[0]
    target?.focus()
    return () => { previous?.focus?.() }
  }, [isOpen, initialFocus])

  if (!isOpen) return trigger ? cloneElement(trigger, { 'aria-haspopup': 'dialog', 'aria-expanded': false }) : null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      update(false)
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    )
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const triggerNode = trigger ? cloneElement(trigger, {
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': true,
    onClick: (event: MouseEvent<HTMLElement>) => {
      trigger.props.onClick?.(event)
      if (!event.defaultPrevented) update(true)
    }
  }) : null

  return (
    <>
      {triggerNode}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (closeOnBackdrop) update(false)
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          data-slot="dialog"
          onKeyDown={handleKeyDown}
          style={width !== undefined ? { width } : undefined}
          className={cn(
            'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl',
            sizeClass[size],
            className
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 id={titleId} className="text-sm font-semibold text-foreground">{title}</h2>
              {description ? <p id={descriptionId} className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
            </div>
            {closeButton ? (
              <button
                type="button"
                aria-label={closeLabel}
                title={closeLabel}
                onClick={() => update(false)}
                className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-muted/40 px-4 py-3">{footer}</div> : null}
        </div>
      </div>
    </>
  )
}
