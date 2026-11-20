import { AlertTriangle, Clock, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface, AffectToneBadge, formatRelativeTime } from '../shared'

export type PermissionScope = 'once' | 'timed' | 'always'
export interface PermissionDecision { allow: boolean; scope: PermissionScope; at: number; until?: number }
export interface PermissionRequestProps {
  agent: { name: string; model?: string; avatar?: ReactNode }
  action: string
  target?: string
  toolIcon?: ReactNode
  risk?: 'safe' | 'risky' | 'destructive'
  reason?: string
  preview?: { id: string; label: string; meta?: string; icon?: ReactNode }[]
  previewTitle?: string
  previewLimit?: number
  scopes?: PermissionScope[]
  scope?: PermissionScope
  defaultScope?: PermissionScope
  onScopeChange?: (scope: PermissionScope) => void
  duration?: number
  decision?: PermissionDecision | null
  defaultDecision?: PermissionDecision | null
  onDecisionChange?: (decision: PermissionDecision | null) => void
  now?: number
  className?: string
}

const scopeLabel = (scope: PermissionScope, duration: number): string =>
  scope === 'once' ? 'Once' : scope === 'always' ? 'Always' : duration >= 60 ? `For ${duration / 60} hour${duration > 60 ? 's' : ''}` : `For ${duration} min`

/** One specific right an agent asks for, with a limited grant. */
export function PermissionRequest({
  agent,
  action,
  target,
  toolIcon,
  risk = 'risky',
  reason,
  preview = [],
  previewTitle = 'What will happen',
  previewLimit = 3,
  scopes = ['once', 'timed', 'always'],
  scope,
  defaultScope = 'once',
  onScopeChange,
  duration = 60,
  decision,
  defaultDecision = null,
  onDecisionChange,
  now,
  className
}: PermissionRequestProps) {
  const [scopeState, setScopeState] = useState<PermissionScope>(defaultScope)
  const [decisionState, setDecisionState] = useState<PermissionDecision | null>(defaultDecision)
  const [tick, setTick] = useState(Date.now())
  const currentScope = scope ?? scopeState
  const currentDecision = decision !== undefined ? decision : decisionState
  const clock = now ?? tick
  const titleId = `perm-title-${agent.name.replace(/\s+/g, '-')}`
  const reasonId = `${titleId}-reason`

  useEffect(() => {
    if (!currentDecision?.allow || currentDecision.scope !== 'timed' || now !== undefined) return
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [currentDecision, now])

  const chooseScope = (next: PermissionScope) => { setScopeState(next); onScopeChange?.(next) }
  const decide = (allow: boolean) => {
    const result: PermissionDecision = { allow, scope: currentScope, at: clock, ...(allow && currentScope === 'timed' ? { until: clock + duration * 60_000 } : {}) }
    setDecisionState(result); onDecisionChange?.(result)
  }
  const clear = () => { setDecisionState(null); onDecisionChange?.(null) }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (currentDecision) return
    const targetTag = (event.target as HTMLElement).tagName
    if (targetTag === 'BUTTON' || targetTag === 'TEXTAREA' || targetTag === 'INPUT') return
    if (event.key === 'Enter') { event.preventDefault(); decide(true) }
    else if (event.key === 'Escape') { event.preventDefault(); decide(false) }
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const index = scopes.indexOf(currentScope)
      const next = scopes[(index + (event.key === 'ArrowRight' ? 1 : -1) + scopes.length) % scopes.length]
      chooseScope(next)
    }
  }
  const remaining = currentDecision?.until ? Math.max(0, currentDecision.until - clock) : 0

  return (
    <div data-slot="permission-request" className={cn('w-full max-w-[400px]', className)} onKeyDown={onKeyDown}>
      <AffectSurface className="p-3">
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">{agent.avatar ?? agent.name.slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <div id={titleId} className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="truncate">{agent.name}</span>
              {agent.model ? <span className="text-[11px] font-normal text-muted-foreground">{agent.model}</span> : null}
              <span>wants to</span><span className="truncate">{action}</span>
              {risk !== 'safe' ? <AffectToneBadge tone={risk === 'destructive' ? 'danger' : 'warning'}><AlertTriangle aria-hidden="true" className="size-2.5" />{risk}</AffectToneBadge> : null}
            </div>
            {target ? <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">{toolIcon}<span className="truncate">{target}</span></div> : null}
          </div>
        </div>

        {currentDecision ? (
          <div role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-2 text-xs">
            {currentDecision.allow ? <ShieldCheck aria-hidden="true" className="size-4 text-success" /> : <LockKeyhole aria-hidden="true" className="size-4 text-destructive" />}
            <span className="font-medium text-foreground">{currentDecision.allow ? `Allowed ${scopeLabel(currentDecision.scope, duration).toLowerCase()}` : 'Denied'}</span>
            <span className="text-muted-foreground">{formatRelativeTime(currentDecision.at, clock)}</span>
            {remaining > 0 ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock aria-hidden="true" className="size-3" />{Math.ceil(remaining / 60_000)} min left</span> : null}
            <button type="button" onClick={clear} className="ml-auto rounded-md border border-border px-2 py-0.5 text-[11px] text-foreground hover:bg-accent">{currentDecision.allow ? 'Revoke' : 'Ask again'}</button>
          </div>
        ) : (
          <div role="dialog" aria-labelledby={titleId} aria-describedby={reason ? reasonId : undefined}>
            {reason ? <p id={reasonId} className="mt-2 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">{reason}</p> : null}
            {preview.length ? (
              <div className="mt-2">
                <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{previewTitle}</h3>
                <ul role="list" className="space-y-0.5">
                  {preview.slice(0, previewLimit).map((row) => (
                    <li key={row.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[11px]">
                      <span className="shrink-0 text-muted-foreground">{row.icon ?? <span className="size-1.5 rounded-full bg-muted-foreground/60" />}</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
                      {row.meta ? <span className="shrink-0 tabular-nums text-muted-foreground">{row.meta}</span> : null}
                    </li>
                  ))}
                  {preview.length > previewLimit ? <li className="text-[10px] text-muted-foreground">+{preview.length - previewLimit} more</li> : null}
                </ul>
              </div>
            ) : null}
            <div role="radiogroup" aria-label="How long" className="mt-3 flex gap-1">
              {scopes.map((option) => (
                <button key={option} type="button" role="radio" aria-checked={currentScope === option} aria-keyshortcuts={option === 'once' ? 'ArrowLeft' : option === 'always' ? 'ArrowRight' : undefined} onClick={() => chooseScope(option)} className={cn('flex-1 rounded-md border px-2 py-1.5 text-[11px]', currentScope === option ? 'border-primary bg-accent text-foreground' : 'border-border text-muted-foreground hover:bg-muted/60')}>
                  {scopeLabel(option, duration)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => decide(true)} aria-label={`Allow ${scopeLabel(currentScope, duration).toLowerCase()}`} className={cn('flex-1 rounded-md px-3 py-1.5 text-xs font-medium', risk === 'destructive' ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground')}>Allow {scopeLabel(currentScope, duration).toLowerCase()}</button>
              <button type="button" onClick={() => decide(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted">Deny</button>
            </div>
            <p className="mt-1.5 text-right text-[10px] text-muted-foreground">Enter to allow · Esc to deny</p>
          </div>
        )}
      </AffectSurface>
    </div>
  )
}
