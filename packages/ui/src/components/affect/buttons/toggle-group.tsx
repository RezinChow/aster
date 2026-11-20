import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface ToggleGroupItem {
  value: string
  label?: string
  icon?: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

export interface ToggleGroupProps {
  items: ToggleGroupItem[]
  type?: 'multiple' | 'single'
  value?: string[] | string | null
  defaultValue?: string[] | string | null
  onChange?: (value: string[] | string | null) => void
  variant?: 'tray' | 'buttons'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

const sizeClass = { sm: 'h-7 text-xs', md: 'h-8 text-xs', lg: 'h-9 text-sm' } as const

/** A single-tab-stop row of toggle buttons with roving arrow-key focus. */
export function ToggleGroup({
  items,
  type = 'multiple',
  value,
  defaultValue,
  onChange,
  variant = 'tray',
  size = 'md',
  disabled = false,
  'aria-label': ariaLabel,
  className
}: ToggleGroupProps) {
  const [internal, setInternal] = useState<string[] | string | null>(
    defaultValue ?? (type === 'multiple' ? [] : null)
  )
  const current = value !== undefined ? value : internal
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const enabled = items.filter((it) => !it.disabled && !disabled)
  const [focused, setFocused] = useState<string | undefined>(() => enabled[0]?.value)
  const focusValue = enabled.some((it) => it.value === focused) ? focused : enabled[0]?.value

  const isOn = (v: string) =>
    type === 'multiple' ? Array.isArray(current) && current.includes(v) : current === v

  const toggle = (v: string) => {
    let next: string[] | string | null
    if (type === 'multiple') {
      const arr = Array.isArray(current) ? current : []
      next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
    } else {
      next = current === v ? null : v
    }
    if (value === undefined) setInternal(next)
    onChange?.(next)
  }

  const move = (index: number, delta: number) => {
    const positions = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.disabled && !disabled)
    if (!positions.length) return
    const pos = positions.findIndex(({ i }) => i === index)
    const target = positions[(pos + delta + positions.length) % positions.length]
    if (!target) return
    setFocused(target.it.value)
    refs.current[target.i]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, -1)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const list = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.disabled && !disabled)
      const target = event.key === 'Home' ? list[0] : list[list.length - 1]
      if (target) {
        setFocused(target.it.value)
        refs.current[target.i]?.focus()
      }
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      toggle(items[index]?.value ?? '')
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-slot="toggle-group"
      className={cn(
        'inline-flex items-center gap-0.5',
        variant === 'tray' && 'rounded-md border border-border bg-muted p-0.5',
        className
      )}
    >
      {items.map((item, index) => {
        const on = isOn(item.value)
        const name = item.ariaLabel ?? item.label ?? item.value
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            aria-pressed={on}
            aria-label={name}
            title={name}
            disabled={disabled || item.disabled}
            tabIndex={focusValue === item.value ? 0 : -1}
            onFocus={() => setFocused(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => toggle(item.value)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1 rounded-md px-2 text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
              sizeClass[size],
              variant === 'tray'
                ? on
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'
                : cn('border border-border bg-background', on && 'border-primary bg-accent text-accent-foreground'),
              item.icon && !item.label && 'w-9'
            )}
          >
            {item.icon ? <span aria-hidden="true" className="inline-flex">{item.icon}</span> : null}
            {item.label ? <span className="truncate">{item.label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
