import { Lock, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type AutonomyLevel = 0 | 1 | 2
export type ActionRisk = 'safe' | 'risky' | 'destructive'
export interface AgentAction { id: string; label: string; risk: ActionRisk; detail?: string; icon?: ReactNode }
export interface AutonomyDialProps {
  actions: AgentAction[]
  level?: AutonomyLevel
  defaultLevel?: AutonomyLevel
  onLevelChange?: (level: AutonomyLevel) => void
  pinned?: string[]
  defaultPinned?: string[]
  onPinnedChange?: (pinned: string[]) => void
  title?: string
  subtitle?: string
  className?: string
}

const levels: { value: AutonomyLevel; label: string; detail: string }[] = [
  { value: 0, label: 'Always ask', detail: 'Asks before every action' },
  { value: 1, label: 'If risky', detail: 'Safe actions run on their own' },
  { value: 2, label: 'Full auto', detail: 'Runs everything without asking' }
]
const riskTone: Record<ActionRisk, AffectTone> = { safe: 'success', risky: 'warning', destructive: 'danger' }
const riskLabel: Record<ActionRisk, string> = { safe: 'Safe', risky: 'Risky', destructive: 'Destructive' }

/** How much an agent may do on its own, with a lock for what always asks. */
export function AutonomyDial({
  actions, level, defaultLevel = 1, onLevelChange, pinned, defaultPinned = [],
  onPinnedChange, title = 'Agent permissions', subtitle = 'What it may do without asking you', className
}: AutonomyDialProps) {
  const [localLevel, setLocalLevel] = useState<AutonomyLevel>(defaultLevel)
  const [localPinned, setLocalPinned] = useState<string[]>(defaultPinned)
  const current = level ?? localLevel
  const locks = pinned ?? localPinned
  const choose = (next: AutonomyLevel) => {
    if (level === undefined) setLocalLevel(next)
    onLevelChange?.(next)
  }
  const toggleLock = (id: string) => {
    const next = locks.includes(id) ? locks.filter((value) => value !== id) : [...locks, id]
    if (pinned === undefined) setLocalPinned(next)
    onPinnedChange?.(next)
  }
  const runsOnOwn = (action: AgentAction) =>
    locks.includes(action.id) ? false : current === 2 || (current === 1 && action.risk === 'safe')
  const autoCount = actions.filter(runsOnOwn).length

  return (
    <AffectSurface className={cn('w-full max-w-[400px]', className)} data-slot="autonomy-dial">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={subtitle} />
        <div role="radiogroup" aria-label="Autonomy" aria-describedby="autonomy-detail"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); choose(Math.min(2, current + 1) as AutonomyLevel) }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); choose(Math.max(0, current - 1) as AutonomyLevel) }
          }}
          className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/30 p-1">
          {levels.map((option) => (
            <button key={option.value} type="button" role="radio" aria-checked={current === option.value}
              tabIndex={current === option.value ? 0 : -1} onClick={() => choose(option.value)}
              className={cn('rounded px-1 py-1.5 text-center text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                current === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-[9px] opacity-70">{option.value}</span>
            </button>
          ))}
        </div>
        <p id="autonomy-detail" className="rounded-md bg-info-subtle px-2 py-1.5 text-[11px] text-info">
          {levels[current].detail} · {autoCount} of {actions.length} actions run on their own.
        </p>

        <ul role="list" aria-label="Agent actions" className="space-y-1">
          {actions.map((action) => {
            const auto = runsOnOwn(action)
            const locked = locks.includes(action.id)
            return (
              <li key={action.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <span aria-hidden="true" className="shrink-0 text-muted-foreground">{action.icon ?? <ShieldCheck className="size-3" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-foreground">{action.label}</span>
                  {action.detail ? <span className="block truncate text-[10px] text-muted-foreground">{action.detail}</span> : null}
                </span>
                <AffectToneBadge tone={riskTone[action.risk]}>{riskLabel[action.risk]}</AffectToneBadge>
                <span className={cn('shrink-0 text-[10px]', auto ? 'text-success-subtle-foreground' : 'text-warning-subtle-foreground')}>
                  {auto ? 'Runs on its own' : 'Asks you first'}
                </span>
                <button type="button" aria-pressed={locked}
                  aria-label={`${locked ? 'Remove lock from' : 'Always ask for'} ${action.label}`}
                  onClick={() => toggleLock(action.id)}
                  className={cn('shrink-0 rounded p-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    locked ? 'bg-warning-subtle text-warning-subtle-foreground' : 'text-muted-foreground hover:bg-muted')}>
                  <Lock aria-hidden="true" className="size-3" />
                </button>
              </li>
            )
          })}
        </ul>
        <p className="sr-only" aria-live="polite">
          {levels[current].label}. {autoCount} actions run on their own, {actions.length - autoCount} ask first.
        </p>
      </div>
    </AffectSurface>
  )
}
