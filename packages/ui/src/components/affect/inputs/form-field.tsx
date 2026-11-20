import { useId } from 'react'
import type { HTMLAttributes, ReactElement, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface FormFieldRender {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean | undefined
  'aria-required': boolean | undefined
  labelId: string
}

export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode | boolean
  required?: boolean
  optional?: boolean
  counter?: ReactNode
  disabled?: boolean
  htmlFor?: string
  children: ReactElement | ((field: FormFieldRender) => ReactNode)
}

/** Frame that wires a label, hint, error and count to a single control. */
export function FormField({
  label,
  hint,
  error,
  required,
  optional,
  counter,
  disabled,
  htmlFor,
  children,
  className,
  ...props
}: FormFieldProps) {
  const generatedId = useId()
  const controlId = htmlFor ?? generatedId
  const labelId = `${controlId}-label`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const countId = `${controlId}-count`
  const hasError = Boolean(error)
  const describedBy = [error ? errorId : hint ? hintId : null, counter ? countId : null].filter(Boolean).join(' ') || undefined
  const field: FormFieldRender = {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': hasError || undefined,
    'aria-required': required || undefined,
    labelId
  }

  return (
    <div data-slot="form-field" {...props} className={cn('w-full space-y-1.5', disabled && 'opacity-60', className)}>
      {label ? (
        <label id={labelId} htmlFor={controlId} className="flex items-center gap-1 text-xs font-medium text-foreground">
          {label}
          {required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
          {optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}
        </label>
      ) : null}
      {typeof children === 'function' ? children(field) : children}
      <div className="flex items-start justify-between gap-2 text-[11px]">
        <span className="min-w-0 break-words text-muted-foreground" dir="auto">
          {hasError && error !== true ? (
            <span id={errorId} role="alert" className="text-destructive">{error}</span>
          ) : hint ? (
            <span id={hintId}>{hint}</span>
          ) : null}
        </span>
        {counter ? <span id={countId} className="shrink-0 tabular-nums text-muted-foreground">{counter}</span> : null}
      </div>
    </div>
  )
}
