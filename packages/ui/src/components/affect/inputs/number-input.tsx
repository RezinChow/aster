import { Minus, Plus } from 'lucide-react'
import { useId, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'prefix'> {
  value?: number | null
  defaultValue?: number | null
  onValueChange?: (value: number | null) => void
  min?: number
  max?: number
  step?: number
  largeStep?: number
  unit?: ReactNode
  prefix?: ReactNode
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  size?: AffectSize
  name?: string
  inputClassName?: string
}

const sizeClass: Record<AffectSize, string> = { sm: 'h-8', md: 'h-9', lg: 'h-10' }

/** Number field with −/+ buttons, arrow stepping, clamped bounds and an optional unit. */
export function NumberInput({
  value,
  defaultValue = null,
  onValueChange,
  min,
  max,
  step = 1,
  largeStep,
  unit,
  prefix,
  label,
  hint,
  error,
  optional,
  size = 'md',
  name,
  inputClassName,
  disabled,
  className,
  ...props
}: NumberInputProps) {
  const id = useId()
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<number | null>(defaultValue)
  const [text, setText] = useState(defaultValue == null ? '' : String(defaultValue))
  const current = isControlled ? value : internal
  const bigStep = largeStep ?? step * 10

  const clamp = (n: number) => {
    let result = n
    if (min !== undefined) result = Math.max(min, result)
    if (max !== undefined) result = Math.min(max, result)
    return result
  }

  const commit = (n: number | null) => {
    const next = n === null ? null : clamp(n)
    if (!isControlled) setInternal(next)
    setText(next === null ? '' : String(next))
    onValueChange?.(next)
  }

  const stepBy = (delta: number) => {
    const base = current ?? (min ?? 0)
    const next = step > 0 ? Math.round((base + delta) / step) * step : base + delta
    commit(clamp(next))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') { event.preventDefault(); stepBy(step) }
    else if (event.key === 'ArrowDown') { event.preventDefault(); stepBy(-step) }
    else if (event.key === 'PageUp') { event.preventDefault(); stepBy(bigStep) }
    else if (event.key === 'PageDown') { event.preventDefault(); stepBy(-bigStep) }
    else if (event.key === 'Home' && min !== undefined) { event.preventDefault(); commit(min) }
    else if (event.key === 'End' && max !== undefined) { event.preventDefault(); commit(max) }
    else if (event.key === 'Escape') { event.preventDefault(); setText(current == null ? '' : String(current)) }
    else if (event.key === 'Enter') {
      const parsed = text.trim() === '' ? null : Number(text)
      commit(parsed !== null && Number.isFinite(parsed) ? parsed : current)
    }
    props.onKeyDown?.(event)
  }

  const stepDisabled = disabled || (current !== null && ((max !== undefined && current >= max) || (min !== undefined && current <= min)))

  return (
    <div data-slot="number-input" className={cn('w-full space-y-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-foreground">
          {label}
          {optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}
        </label>
      ) : null}
      <div className={cn('flex items-center rounded-md border border-border bg-background transition-colors focus-within:border-ring', sizeClass[size], error && 'border-destructive bg-destructive/5')}>
        {prefix ? <span className="shrink-0 pl-2.5 text-xs text-muted-foreground">{prefix}</span> : null}
        <input
          {...props}
          id={id}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-valuenow={current ?? undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          value={text}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
          onBlur={() => { const parsed = text.trim() === '' ? null : Number(text); commit(parsed !== null && Number.isFinite(parsed) ? parsed : current) }}
          onKeyDown={onKeyDown}
          className={cn('min-w-0 flex-1 bg-transparent px-2.5 text-sm tabular-nums text-foreground outline-none disabled:opacity-50', inputClassName)}
        />
        {unit ? <span className="shrink-0 pr-1 text-xs text-muted-foreground">{unit}</span> : null}
        <span className="flex shrink-0 items-center gap-0.5 border-l border-border px-1">
          <button type="button" aria-label="Decrease" aria-controls={id} onClick={() => stepBy(-step)} disabled={stepDisabled} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><Minus className="size-3.5" /></button>
          <button type="button" aria-label="Increase" aria-controls={id} onClick={() => stepBy(step)} disabled={stepDisabled} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><Plus className="size-3.5" /></button>
        </span>
      </div>
      {name ? <input type="hidden" name={name} value={current ?? ''} /> : null}
      <span id={error ? `${id}-error` : `${id}-hint`} className={cn('block text-[11px]', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>{error || hint}</span>
    </div>
  )
}
