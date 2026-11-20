import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export interface DatePickerProps {
  value?: Date | null
  defaultValue?: Date | null
  onChange?: (date: Date) => void
  min?: Date
  max?: Date
  isDateDisabled?: (date: Date) => boolean
  locale?: string
  weekStartsOn?: number
  placeholder?: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  size?: AffectSize
  disabled?: boolean
  name?: string
  required?: boolean
  today?: Date
  defaultOpen?: boolean
  'aria-label'?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

const sizeClass: Record<AffectSize, string> = { sm: 'h-8', md: 'h-9', lg: 'h-10' }
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a: Date | null, b: Date) => Boolean(a && midnight(a).getTime() === midnight(b).getTime())

/** Single-day picker with a custom calendar grid, bounds and full keyboard navigation. */
export function DatePicker({
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  isDateDisabled,
  locale,
  weekStartsOn = 0,
  placeholder = 'Pick a date',
  label,
  hint,
  error,
  optional,
  size = 'md',
  disabled,
  name,
  required,
  today,
  defaultOpen = false,
  'aria-label': ariaLabel,
  className,
  ref
}: DatePickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<Date | null>(defaultValue)
  const [open, setOpen] = useState(defaultOpen)
  const reference = today ?? new Date()
  const selected = isControlled ? value : internal
  const [view, setView] = useState(() => { const base = selected ?? reference; return new Date(base.getFullYear(), base.getMonth(), 1) })
  const [focused, setFocused] = useState(() => midnight(selected ?? reference))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const isDisabled = (date: Date) => {
    const t = midnight(date).getTime()
    return Boolean((min && t < midnight(min).getTime()) || (max && t > midnight(max).getTime()) || isDateDisabled?.(date))
  }
  const select = (date: Date) => {
    if (isDisabled(date)) return
    if (!isControlled) setInternal(date)
    setOpen(false)
    onChange?.(date)
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view)
  const valueLabel = selected ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(selected) : ''
  const weekNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + ((i + weekStartsOn) % 7))))
  const firstWeekday = (view.getDay() - weekStartsOn + 7) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i - firstWeekday + 1))

  const moveFocus = (date: Date) => {
    setFocused(date)
    if (date.getMonth() !== view.getMonth() || date.getFullYear() !== view.getFullYear()) setView(new Date(date.getFullYear(), date.getMonth(), 1))
  }
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (event.key in steps) {
      event.preventDefault()
      moveFocus(new Date(focused.getFullYear(), focused.getMonth(), focused.getDate() + steps[event.key]))
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const delta = event.key === 'PageUp' ? -1 : 1
      moveFocus(new Date(focused.getFullYear(), focused.getMonth() + delta, focused.getDate()))
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const start = (focused.getDay() - weekStartsOn + 7) % 7
      moveFocus(new Date(focused.getFullYear(), focused.getMonth(), focused.getDate() + (event.key === 'Home' ? -start : 6 - start)))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      select(focused)
    }
  }

  return (
    <div ref={rootRef} data-slot="date-picker" className={cn('relative w-full space-y-1.5', className)}>
      {label ? <label className="flex items-center gap-1 text-xs font-medium text-foreground">{label}{optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}</label> : null}
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-required={required}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        className={cn('flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-left text-sm text-foreground transition-colors focus-visible:border-ring disabled:opacity-50', sizeClass[size], error && 'border-destructive bg-destructive/5')}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>{valueLabel || placeholder}</span>
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <span id={error ? `${id}-error` : `${id}-hint`} className={cn('block text-[11px]', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>{error || hint}</span>
      {name ? <input type="hidden" name={name} value={selected ? `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}` : ''} /> : null}
      {open ? (
        <div role="dialog" aria-label={monthLabel} className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border border-border bg-card p-2 shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></button>
            <span aria-live="polite" className="text-xs font-medium text-foreground">{monthLabel}</span>
            <button type="button" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /></button>
          </div>
          <div role="grid" onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-0.5">
            {weekNames.map((w, i) => <div key={i} role="columnheader" className="py-1 text-center text-[10px] text-muted-foreground">{w}</div>)}
            {cells.map((date, i) => {
              const disabled = isDisabled(date)
              const outside = date.getMonth() !== view.getMonth()
              return (
                <button
                  key={i}
                  type="button"
                  role="gridcell"
                  aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)}
                  aria-current={sameDay(date, reference) ? 'date' : undefined}
                  aria-selected={sameDay(selected, date)}
                  aria-disabled={disabled || undefined}
                  tabIndex={sameDay(focused, date) ? 0 : -1}
                  onFocus={() => setFocused(date)}
                  onClick={() => select(date)}
                  className={cn('flex size-8 items-center justify-center rounded text-xs tabular-nums text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', outside && 'text-muted-foreground/50', disabled && 'opacity-40', sameDay(selected, date) && 'bg-primary text-primary-foreground', sameDay(focused, date) && 'ring-1 ring-ring')}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
