import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export interface SegmentOption {
  value: string
  label?: string
  icon?: ReactNode
  count?: number
  badge?: string
  disabled?: boolean
  ariaLabel?: string
  controls?: string
}

export interface SegmentedControlProps {
  options: SegmentOption[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  size?: AffectSize
  variant?: 'tray' | 'underline'
  fullWidth?: boolean
  kind?: 'radio' | 'tabs'
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

const sizeClass: Record<AffectSize, string> = { sm: 'h-7 text-[11px]', md: 'h-8 text-xs', lg: 'h-9 text-sm' }

/** Two-to-six-option switch with a single tab stop and arrow-key selection. */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  size = 'md',
  variant = 'tray',
  fullWidth,
  kind = 'radio',
  disabled,
  'aria-label': ariaLabel,
  className
}: SegmentedControlProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = value !== undefined
  const firstEnabled = options.find((o) => !o.disabled)?.value
  const [internal, setInternal] = useState(defaultValue ?? firstEnabled)
  const current = isControlled ? value : internal

  const choose = (option: SegmentOption) => {
    if (option.disabled || disabled) return
    if (!isControlled) setInternal(option.value)
    onChange?.(option.value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = options.filter((o) => !o.disabled)
    const pos = enabled.findIndex((o) => o.value === current)
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (pos + (forward ? 1 : -1) + enabled.length) % enabled.length
      choose(enabled[next])
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options.find((o) => o.value === current)
      if (option) choose(option)
    }
  }

  return (
    <div
      ref={rootRef}
      role={kind === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={ariaLabel}
      data-slot="segmented-control"
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md border border-border bg-muted p-0.5',
        variant === 'underline' && 'rounded-none border-0 border-b border-border bg-transparent p-0',
        fullWidth && 'flex w-full',
        disabled && 'opacity-60',
        className
      )}
    >
      {options.map((option, i) => {
        const active = option.value === current
        return (
          <button
            key={option.value}
            id={`${id}-opt-${i}`}
            type="button"
            role={kind === 'tabs' ? 'tab' : 'radio'}
            aria-checked={kind === 'radio' ? active : undefined}
            aria-selected={kind === 'tabs' ? active : undefined}
            aria-controls={kind === 'tabs' ? option.controls : undefined}
            aria-label={option.ariaLabel ?? (typeof option.label === 'string' ? option.label : undefined)}
            aria-disabled={option.disabled || undefined}
            tabIndex={active ? 0 : -1}
            disabled={option.disabled}
            onClick={() => choose(option)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded px-2.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              fullWidth && 'flex-1',
              sizeClass[size],
              active ? (variant === 'tray' ? 'bg-background text-foreground shadow-sm' : 'border-b-2 border-primary text-foreground') : 'text-muted-foreground hover:text-foreground',
              option.disabled && 'cursor-not-allowed opacity-40'
            )}
          >
            {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
            {option.label ? <span className="truncate">{option.label}</span> : null}
            {option.count !== undefined ? <span className="rounded bg-muted px-1 text-[10px] tabular-nums text-muted-foreground">{option.count}</span> : null}
            {option.badge ? <span className="rounded bg-accent px-1 text-[10px] text-accent-foreground">{option.badge}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
