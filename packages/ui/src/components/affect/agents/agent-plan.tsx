import { GripVertical, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration } from '../shared/format'
import type { AffectStatus } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectIconButton, AffectStatusDot, AffectSurface, AffectToneBadge } from '../shared/ui'

export interface PlanStep {
  id: string
  title: string
  detail?: string
  tool?: string
  status?: AffectStatus
  duration?: number
  error?: string
}
export type PlanStatus = 'draft' | 'running' | 'done'

export interface AgentPlanProps {
  steps?: PlanStep[]
  defaultSteps?: PlanStep[]
  status?: PlanStatus
  onChange?: (steps: PlanStep[]) => void
  onRun?: (steps: PlanStep[]) => void
  onCancel?: () => void
  onRetry?: (stepId: string) => void
  title?: string
  estimate?: string
  className?: string
}

/** A reviewable plan that can be edited, then watched step by step as it runs. */
export function AgentPlan({
  steps, defaultSteps = [], status = 'draft', onChange, onRun, onCancel, onRetry,
  title, estimate, className
}: AgentPlanProps) {
  const [localSteps, setLocalSteps] = useState<PlanStep[]>(defaultSteps)
  const current = steps ?? localSteps
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState('')
  const [announce, setAnnounce] = useState('')
  const isDraft = status === 'draft'

  const commit = (next: PlanStep[], message: string) => {
    if (steps === undefined) setLocalSteps(next)
    onChange?.(next)
    setAnnounce(message)
  }
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= current.length) return
    const next = [...current]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    commit(next, `Moved '${item.title}' to position ${target + 1} of ${next.length}`)
  }
  const remove = (index: number) => {
    const item = current[index]
    commit(current.filter((step) => step.id !== item.id), `Removed '${item.title}'`)
  }
  const saveEdit = (id: string) => {
    if (draft.trim()) commit(current.map((step) => step.id === id ? { ...step, title: draft.trim() } : step), `Renamed to '${draft.trim()}'`)
    setEditing(null)
  }

  return (
    <AffectSurface className={cn('w-full max-w-[460px]', className)} data-slot="agent-plan">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={estimate ? `Estimated ${estimate}` : undefined} />
        {current.length ? (
          <ol role="list" aria-label={title ?? 'Plan'} className="space-y-1">
            {current.map((step, index) => {
              const stepStatus = step.status ?? 'queued'
              const renaming = editing === step.id
              return (
                <li key={step.id} tabIndex={isDraft ? 0 : -1}
                  aria-current={stepStatus === 'running' ? 'step' : undefined}
                  aria-label={`${step.title}, ${stepStatus}${isDraft ? ', press Enter to rename, Alt arrow to move, Delete to remove' : ''}`}
                  onKeyDown={(event) => {
                    if (!isDraft) return
                    if (event.key === 'Enter' && event.target === event.currentTarget && !renaming) {
                      event.preventDefault(); setEditing(step.id); setDraft(step.title)
                    } else if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); move(index, -1) }
                    else if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); move(index, 1) }
                    else if (event.key === 'Delete' && event.target === event.currentTarget) { event.preventDefault(); remove(index) }
                  }}
                  className={cn('group flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 focus-visible:border-border focus-visible:outline-none',
                    stepStatus === 'running' && 'bg-info-subtle', stepStatus === 'failed' && 'bg-destructive/10')}>
                  {isDraft ? <GripVertical aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" /> : null}
                  <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">{index + 1}</span>
                  <AffectStatusDot status={stepStatus} />
                  <span className="min-w-0 flex-1">
                    {renaming ? (
                      <input aria-label="Step title" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); saveEdit(step.id) }
                          if (event.key === 'Escape') { event.preventDefault(); setEditing(null) }
                        }}
                        onBlur={() => saveEdit(step.id)}
                        className="w-full rounded border border-border bg-background px-1 text-xs text-foreground outline-none focus:border-primary" />
                    ) : (
                      <span className="block truncate text-xs text-foreground">{step.title}</span>
                    )}
                    {step.detail ? <span className="block truncate text-[10px] text-muted-foreground">{step.detail}</span> : null}
                    {step.error ? <span className="block truncate text-[10px] text-destructive">{step.error}</span> : null}
                  </span>
                  {step.tool ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{step.tool}</span> : null}
                  {step.duration ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatDuration(step.duration)}</span> : null}
                  {!isDraft && stepStatus === 'failed' && onRetry ? (
                    <button type="button" onClick={() => onRetry(step.id)} className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted">
                      <RotateCcw aria-hidden="true" className="size-3" /> Retry from here
                    </button>
                  ) : null}
                  {isDraft ? (
                    <AffectIconButton label={`Remove ${step.title}`} onClick={() => remove(index)}>
                      <Trash2 aria-hidden="true" className="size-3" />
                    </AffectIconButton>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : <AffectEmpty>No steps yet. Add the first one below.</AffectEmpty>}

        {isDraft ? (
          <div className="flex gap-1">
            <input aria-label="Add step" value={adding} onChange={(event) => setAdding(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && adding.trim()) {
                  event.preventDefault()
                  const next = [...current, { id: `step-${Date.now()}`, title: adding.trim() }]
                  commit(next, `Added '${adding.trim()}' as step ${next.length}`)
                  setAdding('')
                }
                if (event.key === 'Escape') setAdding('')
              }}
              placeholder="Add a step…" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary" />
            <button type="button" aria-label="Add step" disabled={!adding.trim()}
              onClick={() => {
                const next = [...current, { id: `step-${Date.now()}`, title: adding.trim() }]
                commit(next, `Added '${adding.trim()}' as step ${next.length}`)
                setAdding('')
              }}
              className="rounded-md border border-border px-2 text-foreground disabled:opacity-40"><Plus aria-hidden="true" className="size-3" /></button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isDraft && onRun ? (
            <button type="button" onClick={() => onRun(current)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Run plan</button>
          ) : null}
          {!isDraft && status === 'done' && onRun ? (
            <button type="button" onClick={() => onRun(current)} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Run again</button>
          ) : null}
          {isDraft && onCancel ? (
            <button type="button" onClick={onCancel} className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground">Cancel</button>
          ) : null}
          {status !== 'draft' ? <AffectToneBadge tone={status === 'done' ? 'success' : 'info'}>{status}</AffectToneBadge> : null}
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
      </div>
    </AffectSurface>
  )
}
