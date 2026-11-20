import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'

import { cn } from '../../../lib/utils'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  placement?: 'start' | 'end'
  size?: 'sm' | 'md'
  ref?: Ref<HTMLInputElement>
}

/** On/off switch built on a real checkbox with role="switch". */
export function Switch({
  label,
  description,
  placement = 'start',
  size = 'md',
  className,
  disabled,
  id,
  ...props
}: SwitchProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const switchEl = (
    <span className={cn('relative inline-flex shrink-0 items-center', size === 'sm' ? 'h-4 w-7' : 'h-5 w-8')}>
      <input
        {...props}
        id={inputId}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-describedby={description ? `${inputId}-desc` : undefined}
        className="peer size-full cursor-pointer appearance-none rounded-full border border-border bg-muted transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-0.5 rounded-full bg-background shadow-sm transition-transform',
          size === 'sm' ? 'size-3 peer-checked:translate-x-3' : 'size-4 peer-checked:translate-x-3.5'
        )}
      />
    </span>
  )
  const text = label || description ? (
    <span className="min-w-0 flex-1">
      {label ? <label htmlFor={inputId} className="block cursor-pointer text-xs font-medium text-foreground">{label}</label> : null}
      {description ? <span id={`${inputId}-desc`} className="mt-0.5 block text-[11px] text-muted-foreground">{description}</span> : null}
    </span>
  ) : null

  return (
    <div
      data-slot="switch"
      className={cn('flex items-center gap-2.5', placement === 'end' && 'justify-between', disabled && 'opacity-60', className)}
    >
      {placement === 'start' ? switchEl : null}
      {text}
      {placement === 'end' ? switchEl : null}
    </div>
  )
}
