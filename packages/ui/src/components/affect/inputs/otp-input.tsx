import { Check } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export type OtpStatus = 'idle' | 'verifying' | 'error' | 'success'

export interface OtpInputProps {
  length?: number
  separator?: boolean | number
  numeric?: boolean
  value?: string
  defaultValue?: string
  onChange?: (code: string) => void
  onComplete?: (code: string) => void
  status?: OtpStatus
  errorMessage?: ReactNode
  clearOnError?: boolean
  successLabel?: string
  onResend?: () => void
  resendIn?: number
  align?: 'start' | 'center'
  disabled?: boolean
  autoFocus?: boolean
  label?: string
  className?: string
}

/** Verification code field: one real input behind a row of boxes, with paste and autofill. */
export function OtpInput({
  length = 6,
  separator = false,
  numeric = true,
  value,
  defaultValue = '',
  onChange,
  onComplete,
  status = 'idle',
  errorMessage = "That code didn't work. Try again.",
  clearOnError = true,
  successLabel = 'Verified',
  onResend,
  resendIn = 30,
  align = 'start',
  disabled,
  autoFocus,
  label = 'Verification code',
  className
}: OtpInputProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const [countdown, setCountdown] = useState(resendIn)
  const code = isControlled ? value : internal
  const sepIndex = separator === true ? Math.floor(length / 2) : separator === false ? -1 : separator

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true })
  }, [autoFocus])

  useEffect(() => {
    if (status === 'error' && clearOnError) {
      const timer = window.setTimeout(() => {
        if (!isControlled) setInternal('')
        onChange?.('')
      }, 700)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [status, clearOnError, isControlled, onChange])

  useEffect(() => {
    if (!onResend || countdown <= 0) return
    const timer = window.setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [onResend, countdown])

  const sanitize = (raw: string) => {
    const cleaned = numeric ? raw.replace(/\D/g, '') : raw.replace(/[\s-]/g, '').toUpperCase()
    return cleaned.slice(0, length)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = sanitize(event.target.value)
    if (!isControlled) setInternal(next)
    onChange?.(next)
    if (next.length === length) onComplete?.(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const end = code.length
      const next = event.key === 'ArrowLeft' ? Math.max(0, end - 1) : Math.min(length, end + 1)
      inputRef.current?.setSelectionRange(next, next)
    }
  }

  const locked = disabled || status === 'verifying' || status === 'success'

  return (
    <div data-slot="otp-input" className={cn('w-full space-y-2', align === 'center' && 'flex flex-col items-center', className)}>
      <input
        ref={inputRef}
        id={id}
        value={code}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={locked}
        autoComplete="one-time-code"
        inputMode={numeric ? 'numeric' : 'text'}
        aria-label={`${label}, ${length} digits`}
        aria-invalid={status === 'error' || undefined}
        aria-describedby={status === 'error' ? `${id}-error` : undefined}
        className="absolute size-px opacity-0"
      />
      <div className="relative flex items-center gap-2">
        {Array.from({ length }, (_, i) => (
          <span key={i} className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => inputRef.current?.focus()}
              className={cn(
                'flex size-10 items-center justify-center rounded-md border bg-background text-base font-semibold text-foreground transition-colors sm:size-11',
                status === 'error' ? 'border-destructive' : 'border-border',
                i === code.length && status === 'idle' && 'border-ring'
              )}
            >
              {code[i] ?? ''}
            </button>
            {i === sepIndex - 1 ? <span aria-hidden="true" className="text-muted-foreground">–</span> : null}
          </span>
        ))}
      </div>
      <div className="min-h-4 text-[11px]">
        {status === 'verifying' ? <span className="text-info">Verifying…</span> : null}
        {status === 'success' ? (
          <span className="inline-flex items-center gap-1 text-success"><Check className="size-3" /> {successLabel}</span>
        ) : null}
        {status === 'error' ? <span id={`${id}-error`} role="alert" className="text-destructive">{errorMessage}</span> : null}
      </div>
      {onResend ? (
        <div className="text-[11px] text-muted-foreground">
          {countdown > 0 ? (
            <>Didn't get a code? Resend in {countdown}s</>
          ) : (
            <button type="button" onClick={() => { onResend(); setCountdown(resendIn) }} className="font-medium text-foreground underline underline-offset-2">Resend code</button>
          )}
        </div>
      ) : null}
    </div>
  )
}
