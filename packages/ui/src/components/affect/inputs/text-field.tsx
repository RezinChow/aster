import { Check, Copy, Eye, EyeOff, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  prefix?: ReactNode
  suffix?: ReactNode
  size?: AffectSize
  optional?: boolean
  clearable?: boolean
  copyable?: boolean
  counter?: boolean
  onClear?: () => void
  inputClassName?: string
  className?: string
}

/** One single-line field with label, hint, error, prefix/suffix and action buttons. */
export function TextField({
  label,
  hint,
  error,
  prefix,
  suffix,
  size = 'md',
  optional,
  clearable,
  copyable,
  counter,
  onClear,
  inputClassName,
  className,
  value,
  defaultValue,
  onChange,
  type = 'text',
  maxLength,
  disabled,
  required,
  ...props
}: TextFieldProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [internal, setInternal] = useState(String(defaultValue ?? ''))
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  const isControlled = value !== undefined
  const current = isControlled ? String(value) : internal
  const describedBy = [error ? `${id}-error` : hint ? `${id}-hint` : null, counter && maxLength ? `${id}-count` : null]
    .filter(Boolean)
    .join(' ') || undefined

  const fireChange = (next: string) => {
    if (!isControlled) setInternal(next)
    const input = inputRef.current
    if (input && onChange) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, next)
      onChange({ target: input } as ChangeEvent<HTMLInputElement>)
    }
  }

  const clear = () => {
    fireChange('')
    onClear?.()
  }

  const copy = () => {
    void navigator.clipboard?.writeText(current)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const isPassword = type === 'password'
  const inputType = isPassword && visible ? 'text' : type

  return (
    <div data-slot="text-field" className={cn('w-full space-y-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-foreground">
          {label}
          {optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}
          {required ? <span aria-hidden="true" className="text-destructive">*</span> : null}
        </label>
      ) : null}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors focus-within:border-ring',
          size === 'sm' && 'h-8',
          size === 'md' && 'h-9',
          size === 'lg' && 'h-10',
          error && 'border-destructive bg-destructive/5'
        )}
      >
        {prefix ? <span className="shrink-0 truncate text-xs text-muted-foreground">{prefix}</span> : null}
        <input
          {...props}
          ref={inputRef}
          id={id}
          type={inputType}
          value={current}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            if (!isControlled) setInternal(e.target.value)
            onChange?.(e)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && clearable && current) clear()
            props.onKeyDown?.(e)
          }}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50',
            inputClassName
          )}
        />
        {suffix ? <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span> : null}
        {clearable && current && !disabled ? (
          <button type="button" aria-label="Clear field" onClick={clear} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        ) : null}
        {isPassword ? (
          <button
            type="button"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        ) : null}
        {copyable ? (
          <button type="button" aria-label="Copy value" onClick={copy} className={cn('shrink-0', copied ? 'text-success' : 'text-muted-foreground hover:text-foreground')}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        ) : null}
      </div>
      <div className="flex items-start justify-between gap-2 text-[11px]">
        <span className={cn(error ? 'text-destructive' : 'text-muted-foreground', 'min-w-0 break-words')} role={error ? 'alert' : undefined} id={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
          {error || hint}
        </span>
        {counter && maxLength ? (
          <span id={`${id}-count`} className={cn('shrink-0 tabular-nums', current.length > maxLength ? 'text-destructive' : 'text-muted-foreground')}>
            {current.length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  )
}
