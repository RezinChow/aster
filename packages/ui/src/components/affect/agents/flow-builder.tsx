import { AlertTriangle, Check, CircleSlash, LoaderCircle, Pause, Play, Plus, Undo2, Zap } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared'

export type FlowStepStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'
export type FlowKind = 'trigger' | 'action' | 'agent' | 'branch' | 'wait'
export interface FlowPath { id: string; label: string; steps: FlowStep[] }
export interface FlowStep {
  id: string
  kind: FlowKind
  title: string
  detail?: string
  note?: string
  icon?: ReactNode
  paths?: FlowPath[]
}
export interface FlowTemplate { kind: FlowKind; title: string; detail?: string; icon?: ReactNode; paths?: { id: string; label: string }[] }
export type FlowStatusMap = Record<string, FlowStepStatus>

export interface FlowBuilderProps {
  name?: string
  steps?: FlowStep[]
  defaultSteps?: FlowStep[]
  onStepsChange?: (steps: FlowStep[]) => void
  status?: FlowStatusMap
  selected?: string | null
  defaultSelected?: string | null
  onSelect?: (id: string | null) => void
  onRun?: () => void
  onStop?: () => void
  templates?: FlowTemplate[]
  triggers?: FlowTemplate[]
  height?: number
  className?: string
}

const defaultTemplates: FlowTemplate[] = [
  { kind: 'action', title: 'Send email', detail: 'Gmail', icon: <Zap className="size-3" /> },
  { kind: 'agent', title: 'Research step', detail: 'Agent' },
  { kind: 'branch', title: 'If / else', detail: 'Condition', paths: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }] },
  { kind: 'wait', title: 'Wait', detail: '1 day' }
]

const statusIcon: Record<FlowStepStatus, ReactNode> = {
  idle: null,
  running: <LoaderCircle aria-hidden="true" className="size-3 animate-spin text-info" />,
  done: <Check aria-hidden="true" className="size-3 text-success" />,
  failed: <AlertTriangle aria-hidden="true" className="size-3 text-destructive" />,
  skipped: <CircleSlash aria-hidden="true" className="size-3 text-muted-foreground" />
}

/** A top-down automation flow you build and test in place. */
export function FlowBuilder({
  name = 'Untitled workflow',
  steps,
  defaultSteps = [],
  onStepsChange,
  status,
  selected,
  defaultSelected = null,
  onSelect,
  onRun,
  onStop,
  templates = defaultTemplates,
  height = 420,
  className
}: FlowBuilderProps) {
  const [stepState, setStepState] = useState<FlowStep[]>(defaultSteps)
  const [selectedState, setSelectedState] = useState<string | null>(defaultSelected)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [history, setHistory] = useState<FlowStep[][]>([])
  const [announce, setAnnounce] = useState('')
  const current = steps ?? stepState
  const currentSelected = selected !== undefined ? selected : selectedState
  const running = Object.values(status ?? {}).some((value) => value === 'running')

  const commit = (next: FlowStep[], message: string) => {
    setHistory((stack) => [...stack.slice(-19), current])
    setStepState(next)
    onStepsChange?.(next)
    setAnnounce(message)
    setMenuFor(null)
  }
  const pick = (id: string | null) => { setSelectedState(id); onSelect?.(id) }
  const add = (index: number, template: FlowTemplate) => {
    const step: FlowStep = {
      id: `step-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      kind: template.kind,
      title: template.title,
      detail: template.detail,
      icon: template.icon,
      ...(template.paths ? { paths: template.paths.map((path) => ({ ...path, steps: [] })) } : {})
    }
    const next = [...current]
    next.splice(index + 1, 0, step)
    commit(next, `Added ${step.title}`)
    pick(step.id)
  }
  const remove = (id: string) => { commit(current.filter((step) => step.id !== id), 'Removed step'); if (currentSelected === id) pick(null) }
  const move = (id: string, delta: number) => {
    const index = current.findIndex((step) => step.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= current.length) return
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    commit(next, 'Moved step')
  }
  const undo = () => {
    if (!history.length) return
    const previous = history[history.length - 1]
    setHistory((stack) => stack.slice(0, -1))
    setStepState(previous); onStepsChange?.(previous); setAnnounce('Undid last change')
  }

  const onStepKeyDown = (event: KeyboardEvent<HTMLDivElement>, step: FlowStep) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(currentSelected === step.id ? null : step.id) }
    else if (event.altKey && event.key === 'ArrowUp') { event.preventDefault(); move(step.id, -1) }
    else if (event.altKey && event.key === 'ArrowDown') { event.preventDefault(); move(step.id, 1) }
    else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); remove(step.id) }
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo() }
    else if (event.key === 'Escape') { setMenuFor(null); pick(null) }
  }

  const plusButton = (index: number) => (
    <div className="relative flex justify-center">
      <button type="button" aria-label={index < 0 ? 'Add a trigger at the start' : `Add a step after ${current[index]?.title ?? ''}`} onClick={() => setMenuFor((currentMenu) => (currentMenu === index ? null : index))} className="z-10 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"><Plus aria-hidden="true" className="size-3" /></button>
      {menuFor === index ? (
        <div role="menu" className="absolute top-6 z-20 w-40 rounded-md border border-border bg-card p-1 shadow-md">
          {(index < 0 ? (templates.length ? templates : defaultTemplates) : templates).map((template) => (
            <button key={template.title} type="button" role="menuitem" onClick={() => add(index, template)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-accent">
              <span className="text-muted-foreground">{template.icon ?? <span className="size-2 rounded-sm bg-muted-foreground/50" />}</span>{template.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )

  return (
    <div data-slot="flow-builder" className={cn('w-full', className)} onKeyDown={(event) => { if (event.key === 'Escape') { setMenuFor(null); pick(null) } }}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={name}
          actions={
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Undo last change" disabled={!history.length} onClick={undo} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-40"><Undo2 aria-hidden="true" className="size-3.5" /></button>
              {running ? (
                <button type="button" onClick={onStop} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"><Pause aria-hidden="true" className="size-3" />Stop</button>
              ) : (
                <button type="button" disabled={!onRun || current.length < 2} onClick={onRun} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-40"><Play aria-hidden="true" className="size-3" />Run test</button>
              )}
            </div>
          }
        />
        <div className="mt-3 overflow-auto p-1" style={{ height }}>
          <div className="mx-auto w-full max-w-md space-y-0">
            {plusButton(-1)}
            {current.map((step, index) => {
              const stepStatus = status?.[step.id] ?? 'idle'
              const isSelected = currentSelected === step.id
              return (
                <div key={step.id}>
                  <div
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`${step.kind} step: ${step.title}. Status ${stepStatus}`}
                    onKeyDown={(event) => onStepKeyDown(event, step)}
                    onClick={() => pick(isSelected ? null : step.id)}
                    className={cn('relative w-full rounded-lg border border-border bg-background p-2 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring', isSelected && 'border-primary bg-accent', stepStatus === 'skipped' && 'opacity-50')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">{step.icon ?? (step.kind === 'branch' ? <Zap aria-hidden="true" className="size-3" /> : <span className="text-[10px]">{step.kind.slice(0, 1).toUpperCase()}</span>)}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-foreground">{step.title}</span>{step.detail ? <span className="block truncate text-[10px] text-muted-foreground">{step.detail}</span> : null}</span>
                      {statusIcon[stepStatus]}
                    </div>
                    {step.note ? <p className={cn('mt-1 truncate text-[10px] text-muted-foreground', stepStatus === 'running' && 'animate-pulse text-info')}>{step.note}</p> : null}
                    {step.paths?.length ? (
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {step.paths.map((path) => (
                          <div key={path.id} className={cn('rounded-md border border-border p-1.5', status?.[path.id] === 'skipped' && 'opacity-40')}>
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-foreground"><AffectToneBadge tone="neutral">{path.label}</AffectToneBadge></div>
                            {path.steps.length ? path.steps.map((child) => <div key={child.id} className="truncate rounded bg-muted px-1.5 py-1 text-[10px] text-muted-foreground">{child.title}</div>) : <div className="text-[10px] text-muted-foreground">Empty path</div>}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {plusButton(index)}
                </div>
              )
            })}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">↑↓ move · ⌫ remove · ⌘Z undo · Enter select</p>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
