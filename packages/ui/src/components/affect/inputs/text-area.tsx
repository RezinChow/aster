import { Maximize2, Minimize2 } from 'lucide-react'
import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode, TextareaHTMLAttributes } from 'react'

import { cn } from '../../../lib/utils'

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  counter?: boolean
  minRows?: number
  maxRows?: number
  expandable?: boolean
  expandedRows?: number
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onSubmitShortcut?: (value: string) => void
  inputClassName?: string
  className?: string
}

/** Multi-line text field that grows with its content and supports a send shortcut. */
export function TextArea({
  label,
  hint,
  error,
  optional,
  counter,
  minRows = 3,
  maxRows = 10,
  expandable,
  expandedRows = 16,
  expanded: controlledExpanded,
  onExpandedChange,
  onSubmitShortcut,
  inputClassName,
  className,
  value,
  defaultValue,
  onChange,
  maxLength,
  required,
  id,
  ...props
}: TextAreaProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded = controlledExpanded ?? internalExpanded
  const setExpanded = (next: boolean) => {
    if (controlledExpanded === undefined) setInternalExpanded(next)
    onExpandedChange?.(next)
  }
  const current = String(value ?? defaultValue ?? '')
  const describedBy = [error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : null, counter && maxLength ? `${fieldId}-count` : null]
    .filter(Boolean)
    .join(' ') || undefined
  const rows = isExpanded ? expandedRows : Math.min(maxRows, Math.max(minRows, current.split('\n').length))

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && onSubmitShortcut) {
      event.preventDefault()
      onSubmitShortcut(current)
    }
    props.onKeyDown?.(event)
  }

  return (
    <div data-slot="text-area" className={cn('w-full space-y-1.5', className)}>
      {label ? (
        <label htmlFor={fieldId} className="flex items-center gap-1 text-xs font-medium text-foreground">
          {label}
          {optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <textarea
          {...props}
          id={fieldId}
          rows={rows}
          value={current}
          onChange={onChange}
          onKeyDown={onKeyDown}
          maxLength={maxLength}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-keyshortcuts={onSubmitShortcut ? 'Meta+Enter Control+Enter' : undefined}
          className={cn(
            'w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring disabled:opacity-50',
            error && 'border-destructive bg-destructive/5',
            inputClassName
          )}
        />
        {expandable ? (
          <button
            type="button"
            aria-label={isExpanded ? 'Show less room' : 'Give more room'}
            aria-pressed={isExpanded}
            aria-controls={fieldId}
            onClick={() => setExpanded(!isExpanded)}
            className="absolute top-1.5 right-1.5 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-2 text-[11px]">
        <span className={cn('min-w-0 break-words', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined} id={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}>
          {error || hint}
        </span>
        {counter && maxLength ? (
          <span id={`${fieldId}-count`} className={cn('shrink-0 tabular-nums', current.length > maxLength ? 'text-destructive' : 'text-muted-foreground')}>
            {current.length.toLocaleString()}/{maxLength.toLocaleString()}
          </span>
        ) : null}
      </div>
    </div>
  )
}
