import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createContext, useContext, useState } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface } from '../shared'

export interface StepContext<V> {
  values: V
  errors: Record<string, string | undefined>
  setValues: (patch: Partial<V>) => void
  goTo: (index: number) => void
  next: () => void
}

export interface Step<V> {
  id: string
  title: string
  heading?: string
  description?: string
  render: (ctx: StepContext<V>) => ReactNode
  validate?: (values: V) => Record<string, string | undefined>
}

type AnyValues = Record<string, unknown>
const StepperContext = createContext<{ values: AnyValues; errors: Record<string, string | undefined> } | null>(null)

export interface StepperFormProps<V extends object> {
  steps: Step<V>[]
  initialValues: V
  onComplete?: (values: V) => void | Promise<void>
  initialStep?: number
  step?: number
  onStepChange?: (step: number) => void
  submitLabel?: string
  submittingLabel?: string
  success?: (values: V, reset: () => void) => ReactNode
  className?: string
}

/** Multi-step wizard with per-step validation, progress steps and a success state. */
export function StepperForm<V extends object>({
  steps,
  initialValues,
  onComplete,
  initialStep = 0,
  step,
  onStepChange,
  submitLabel = 'Finish',
  submittingLabel = 'Working…',
  success,
  className
}: StepperFormProps<V>) {
  const isControlled = step !== undefined
  const [current, setCurrent] = useState(initialStep)
  const index = isControlled ? step : current
  const [values, setValuesState] = useState<V>(initialValues)
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const active = steps[index]
  const isLast = index === steps.length - 1

  const goTo = (next: number) => {
    if (isControlled) onStepChange?.(next)
    else setCurrent(next)
    setErrors({})
  }

  const runSubmit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await onComplete?.(values)
      setDone(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    const found = active?.validate?.(values) ?? {}
    const problems = Object.fromEntries(Object.entries(found).filter(([, message]) => Boolean(message)))
    if (Object.keys(problems).length) { setErrors(problems); return }
    if (isLast) void runSubmit()
    else goTo(index + 1)
  }

  const setValues = (patch: Partial<V>) => setValuesState((v) => ({ ...v, ...patch }))
  const ctx: StepContext<V> = { values, errors, setValues, goTo, next }

  if (done) {
    return (
      <div data-slot="stepper-form" className={cn('w-full max-w-[520px]', className)}>
        {success ? success(values, () => { setDone(false); setValuesState(initialValues); goTo(0) }) : (
          <AffectSurface className="flex flex-col items-center gap-2 p-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground"><Check className="size-5" /></span>
            <h2 className="text-sm font-medium text-foreground">All done</h2>
            <button type="button" onClick={() => { setDone(false); setValuesState(initialValues); goTo(0) }} className="text-xs text-muted-foreground underline">Start again</button>
          </AffectSurface>
        )}
      </div>
    )
  }

  return (
    <StepperContext.Provider value={{ values: values as unknown as AnyValues, errors }}>
      <div data-slot="stepper-form" className={cn('w-full max-w-[520px] space-y-4', className)}>
        <ol className="flex flex-wrap items-center gap-1.5" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button type="button" aria-current={i === index ? 'step' : undefined} disabled={i > index} onClick={() => i < index && goTo(i)} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]', i === index ? 'bg-primary text-primary-foreground' : i < index ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-muted text-muted-foreground')}>
                {i < index ? <Check className="size-3" /> : <span className="tabular-nums">{i + 1}</span>}
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <AffectSurface className="space-y-4 p-4">
          {active ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">{active.heading ?? active.title}</h2>
                {active.description ? <p className="mt-0.5 text-[11px] text-muted-foreground">{active.description}</p> : null}
              </div>
              {active.render(ctx)}
            </div>
          ) : null}
          {submitError ? <p role="alert" className="text-xs text-destructive">{submitError}</p> : null}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <button type="button" disabled={index === 0} onClick={() => goTo(index - 1)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-3.5" /> Back</button>
            <button type="button" onClick={next} disabled={submitting} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {submitting ? submittingLabel : isLast ? submitLabel : 'Continue'}
              {!isLast ? <ChevronRight className="size-3.5" /> : null}
            </button>
          </div>
        </AffectSurface>
        <p className="sr-only" aria-live="polite">Step {index + 1} of {steps.length}: {active?.title}</p>
      </div>
    </StepperContext.Provider>
  )
}

export function StepperField({ name, label, hint, optional, children }: { name: string; label: string; hint?: string; optional?: boolean; children: ReactNode }) {
  const context = useContext(StepperContext)
  const error = context?.errors[name]
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1 text-xs font-medium text-foreground">{label}{optional ? <span className="text-[10px] font-normal text-muted-foreground">Optional</span> : null}</label>
      {children}
      <p className={cn('text-[11px]', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>{error || hint}</p>
    </div>
  )
}

export function StepperInput({ prefix, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { prefix?: string }) {
  return (
    <div className={cn('flex h-9 items-center rounded-md border border-border bg-background px-2.5 focus-within:border-ring', className)}>
      {prefix ? <span className="shrink-0 text-xs text-muted-foreground">{prefix}</span> : null}
      <input {...props} className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
    </div>
  )
}

export function StepperTags({ value, onChange, max, placeholder = 'Add…' }: { value: string[]; onChange: (next: string[]) => void; max?: number; placeholder?: string }) {
  const [text, setText] = useState('')
  const add = () => {
    const tag = text.trim()
    if (tag && !value.includes(tag) && (max === undefined || value.length < max)) onChange([...value, tag])
    setText('')
  }
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5">
      {value.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}><X className="size-3" /></button></span>)}
      <input value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }} onBlur={add} className="min-w-24 flex-1 bg-transparent text-sm outline-none" />
    </div>
  )
}

export function StepperChoices({ value, onChange, options, label }: { value: string; onChange: (next: string) => void; options: { value: string; title: string; description?: string; badge?: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onChange(option.value)} className={cn('rounded-md border border-border p-3 text-left', value === option.value && 'border-primary bg-accent')}>
          <span className="flex items-center justify-between text-xs font-medium text-foreground">{option.title}{option.badge ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{option.badge}</span> : null}</span>
          {option.description ? <span className="mt-1 block text-[11px] text-muted-foreground">{option.description}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function StepperReview({ rows, onEdit }: { rows: { label: string; value: ReactNode; step?: number }[]; onEdit?: (index: number) => void }) {
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {rows.map((row, _i) => (
        <div key={row.label} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="flex min-w-0 items-center gap-2"><span className="truncate font-medium text-foreground">{row.value}</span>{row.step !== undefined && onEdit ? <button type="button" onClick={() => onEdit(row.step!)} className="text-[11px] text-muted-foreground underline">Edit</button> : null}</span>
        </div>
      ))}
    </div>
  )
}
