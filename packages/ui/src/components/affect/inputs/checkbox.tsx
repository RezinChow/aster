import { Check, Minus } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  indeterminate?: boolean
  error?: ReactNode
  variant?: 'plain' | 'card'
}

/** A real checkbox with a label, description, mixed state, error and card variant. */
export function Checkbox({
  label,
  description,
  indeterminate = false,
  error,
  variant = 'plain',
  className,
  disabled,
  id,
  ...props
}: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <div data-slot="checkbox" className={cn('w-full', className)}>
      <label
        htmlFor={inputId}
        className={cn(
          'flex cursor-pointer items-start gap-2.5 rounded-md',
          variant === 'card' && 'border border-border bg-card p-3 transition-colors hover:bg-muted/60 has-[:checked]:border-foreground',
          disabled && 'cursor-not-allowed opacity-60',
          error && 'border-destructive'
        )}
      >
        <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
          <input
            {...props}
            ref={inputRef}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={description || error ? `${inputId}-desc` : undefined}
            className="peer size-4 shrink-0 cursor-pointer appearance-none rounded border border-border bg-background transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
          />
          {indeterminate ? (
            <Minus aria-hidden="true" className="pointer-events-none absolute size-3 text-primary-foreground" />
          ) : (
            <Check aria-hidden="true" className="pointer-events-none absolute size-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />
          )}
        </span>
        {label || description ? (
          <span className="min-w-0 flex-1">
            {label ? <span className="block text-xs font-medium text-foreground">{label}</span> : null}
            {description ? <span id={`${inputId}-desc`} className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{description}</span> : null}
            {error ? <span id={`${inputId}-desc`} role="alert" className="mt-0.5 block text-[11px] text-destructive">{error}</span> : null}
          </span>
        ) : null}
      </label>
    </div>
  )
}
