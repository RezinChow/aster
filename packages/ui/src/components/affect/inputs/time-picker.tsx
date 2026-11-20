import { ChevronDown, Clock } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export interface TimePickerProps {
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  step?: number
  min?: string
  max?: string
  hourCycle?: 12 | 24
  locale?: string
  placeholder?: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  size?: AffectSize
  disabled?: boolean
  name?: string
  required?: boolean
  'aria-label'?: string
  className?: string
  ref?: Ref<HTMLInputElement>
}

const sizeClass: Record<AffectSize, string> = { sm: 'h-8', md: 'h-9', lg: 'h-10' }
const toMinutes = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }
const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function parseTime(raw: string, cycle: 12 | 24): number | null {
  const text = raw.trim().toLowerCase().replace(/\s/g, '')
  if (!text) return null
  const pm = /pm$/.test(text)
  const am = /am$/.test(text)
  const digits = text.replace(/[ap]m$/, '').replace(/[^\d:]/g, '')
  const parts = digits.split(':').map(Number)
  let h = parts[0]
  let m = parts[1] ?? 0
  if (parts.length === 1 && digits.length >= 3) { h = Number(digits.slice(0, -2)); m = Number(digits.slice(-2)) }
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  if (pm && h < 12) h += 12
  if (am && h === 12) h = 0
  if (cycle === 12 && !pm && !am && h > 12) return null
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** Time-of-day combobox: type a time or pick from a stepped list. */
export function TimePicker({
  value,
  defaultValue = null,
  onChange,
  step = 15,
  min,
  max,
  hourCycle,
  locale,
  placeholder,
  label,
  hint,
  error,
  optional,
  size = 'md',
  disabled,
  name,
  required,
  'aria-label': ariaLabel,
  className,
  ref
}: TimePickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<string | null>(defaultValue)
  const current = isControlled ? value : internal
  const [text, setText] = useState(current ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const cycle = hourCycle ?? (new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle === 'h12' ? 12 : 24)
  const start = min ? toMinutes(min) : 0
  const end = max ? toMinutes(max) : 1439
  const times = Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, i) => fromMinutes(start + i * step))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => { setText(current ?? '') }, [current])

  const commit = (next: string | null) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const normalizeText = () => {
    const parsed = parseTime(text, cycle)
    if (parsed === null || parsed < start || parsed > end) { setText(current ?? ''); return }
    const next = fromMinutes(parsed)
    setText(next)
    commit(next)
  }

  const display = (time: string) => {
    if (cycle === 24) return time
    const [h, m] = time.split(':').map(Number)
    const suffix = h >= 12 ? 'PM' : 'AM'
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); setText(current ?? ''); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const parsed = parseTime(text, cycle)
      const idx = parsed !== null ? Math.max(0, times.indexOf(fromMinutes(parsed))) : 0
      setActive((n) => (n + (event.key === 'ArrowDown' ? 1 : -1) + times.length) % times.length || idx)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && times[active]) { commit(times[active]); setText(times[active]); setOpen(false) }
      else normalizeText()
    }
  }

  return (
    <div ref={rootRef} data-slot="time-picker" className={cn('relative w-full space-y-1.5', className)}>
      {label ? <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-foreground">{label}{optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}</label> : null}
      <div className={cn('flex items-center rounded-md border border-border bg-background pr-2 transition-colors focus-within:border-ring', sizeClass[size], error && 'border-destructive bg-destructive/5')}>
        <input
          ref={ref}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          aria-required={required}
          disabled={disabled}
          value={text}
          placeholder={placeholder ?? display('09:00')}
          onChange={(e) => { setText(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={normalizeText}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        <button type="button" aria-label="Show times" disabled={disabled} onClick={() => setOpen((o) => !o)} className="shrink-0 text-muted-foreground hover:text-foreground"><Clock className="size-3.5" /><ChevronDown className={cn('ml-0.5 inline size-3 transition-transform', open && 'rotate-180')} /></button>
      </div>
      <span id={error ? `${id}-error` : `${id}-hint`} className={cn('block text-[11px]', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>{error || hint}</span>
      {name ? <input type="hidden" name={name} value={current ?? ''} /> : null}
      {open ? (
        <div id={`${id}-list`} role="listbox" className="absolute top-full left-0 z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {times.map((time, i) => (
            <div key={time} id={`${id}-opt-${i}`} role="option" aria-selected={time === current} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => { commit(time); setText(time); setOpen(false) }} className={cn('cursor-pointer rounded px-2 py-1.5 text-xs tabular-nums text-foreground', i === active && 'bg-accent text-accent-foreground')}>
              {display(time)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
