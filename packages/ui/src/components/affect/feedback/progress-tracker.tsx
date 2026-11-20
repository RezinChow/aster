import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter } from '../shared'

export interface ProgressStep {
  id: string
  label: string
  done?: boolean
  icon?: ReactNode
}

export interface ProgressTrackerProps {
  steps: ProgressStep[]
  title?: string
  autoPlay?: boolean
  interval?: number
  onChange?: (steps: ProgressStep[]) => void
  className?: string
}

/** An onboarding checklist with an animated bar and optional auto play. */
export function ProgressTracker({
  steps,
  title = 'Getting started',
  autoPlay = false,
  interval = 2200,
  onChange,
  className
}: ProgressTrackerProps) {
  const [items, setItems] = useState<ProgressStep[]>(steps)
  const [paused, setPaused] = useState(false)
  const done = items.filter((step) => step.done).length
  const percent = items.length ? Math.round((done / items.length) * 100) : 0

  useEffect(() => {
    if (!autoPlay || paused || items.length === 0) return
    const timer = setInterval(() => {
      setItems((current) => {
        const next = current.map((step) => ({ ...step }))
        const open = next.findIndex((step) => !step.done)
        if (open === -1) next.forEach((step) => { step.done = false })
        else next[open].done = true
        onChange?.(next)
        return next
      })
    }, interval)
    return () => clearInterval(timer)
  }, [autoPlay, paused, interval, onChange])

  const toggle = (id: string) => {
    setPaused(true)
    setItems((current) => {
      const next = current.map((step) => step.id === id ? { ...step, done: !step.done } : step)
      onChange?.(next)
      return next
    })
  }

  return (
    <div
      data-slot="progress-tracker"
      className={cn('rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm', className)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-foreground">{title}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{done}/{items.length}</span>
      </div>
      <AffectMeter value={done} max={Math.max(1, items.length)} label={`${title} progress`} tone="success" className="mt-2 h-1.5" />
      <ul className="mt-3 space-y-1" aria-label={title}>
        {items.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              aria-pressed={!!step.done}
              onClick={() => toggle(step.id)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  step.done ? 'border-success bg-success text-white' : 'border-border text-transparent'
                )}
              >
                <Check className="size-2.5 transition-transform" />
              </span>
              {step.icon ? <span className="shrink-0 text-muted-foreground">{step.icon}</span> : null}
              <span className={cn('min-w-0 flex-1 truncate text-xs', step.done ? 'text-muted-foreground line-through' : 'text-foreground')}>
                {step.label}
              </span>
              {step.done ? <span className="shrink-0 text-[10px] text-success">{percent}%</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
