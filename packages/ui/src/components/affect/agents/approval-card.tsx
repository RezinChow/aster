import { Check, LoaderCircle, LockKeyhole, Shield, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectSurface, AffectToneBadge } from '../shared/ui'

export type ApprovalStatus = 'pending' | 'approved' | 'denied'
export type ApprovalRisk = 'low' | 'medium' | 'high'

export interface ApprovalCardProps {
  title: string
  description?: ReactNode
  risk?: ApprovalRisk
  icon?: ReactNode
  details?: { label: string; value: ReactNode }[]
  preview?: ReactNode
  children?: ReactNode
  status?: ApprovalStatus
  defaultStatus?: ApprovalStatus
  onApprove?: (args: { always: boolean }) => void | Promise<void>
  onDeny?: (args: { reason: 'user' | 'timeout' }) => void
  onEdit?: () => void
  expiresIn?: number
  onExpire?: () => void
  allowAlways?: boolean
  alwaysLabel?: string
  approveLabel?: string
  denyLabel?: string
  editLabel?: string
  shortcuts?: boolean
  label?: ReactNode
  actions?: 'tray' | 'card'
  className?: string
}

const riskTone: Record<ApprovalRisk, AffectTone> = { low: 'neutral', medium: 'warning', high: 'danger' }
const riskLabel: Record<ApprovalRisk, string> = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' }
const resolvedLabel: Record<Exclude<ApprovalStatus, 'pending'>, string> = { approved: 'Approved', denied: 'Denied' }

/** An agent asks before it acts: risk, preview, countdown and two clear answers. */
export function ApprovalCard({
  title, description, risk, icon, details = [], preview, children, status, defaultStatus = 'pending',
  onApprove, onDeny, onEdit, expiresIn, onExpire, allowAlways = true, alwaysLabel = 'Always allow this action',
  approveLabel = 'Approve', denyLabel = 'Deny', editLabel = 'Edit', shortcuts = true, label,
  actions = 'tray', className
}: ApprovalCardProps) {
  const [localStatus, setLocalStatus] = useState<ApprovalStatus>(defaultStatus)
  const [always, setAlways] = useState(false)
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState(expiresIn ?? 0)
  const [paused, setPaused] = useState(false)
  const [announce, setAnnounce] = useState('')
  const current = status ?? localStatus
  const resolvedRef = useRef<HTMLDivElement>(null)
  const finished = current !== 'pending'

  useEffect(() => {
    if (expiresIn === undefined || current !== 'pending' || paused || remaining <= 0) return
    const id = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(id)
  }, [expiresIn, current, paused, remaining])

  useEffect(() => {
    if (expiresIn === undefined || current !== 'pending' || remaining > 0) return
    onExpire?.()
    onDeny?.({ reason: 'timeout' })
    if (status === undefined) setLocalStatus('denied')
    setAnnounce(`Expired: ${title}`)
  }, [remaining, expiresIn, current, onExpire, onDeny, status, title])

  const approve = async () => {
    if (busy || finished) return
    setBusy(true)
    try {
      await onApprove?.({ always })
      if (status === undefined) setLocalStatus('approved')
      setAnnounce(`Approved: ${title}`)
    } catch {
      setAnnounce(`Could not approve: ${title}`)
    } finally {
      setBusy(false)
      window.setTimeout(() => resolvedRef.current?.focus(), 0)
    }
  }
  const deny = () => {
    if (finished) return
    onDeny?.({ reason: 'user' })
    if (status === undefined) setLocalStatus('denied')
    setAnnounce(`Denied: ${title}`)
    window.setTimeout(() => resolvedRef.current?.focus(), 0)
  }

  const buttons = (
    <div className="flex flex-wrap items-center gap-1.5">
      {onEdit ? <button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">{editLabel}</button> : null}
      <button type="button" onClick={deny} aria-keyshortcuts="Escape"
        className="rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">{denyLabel}{shortcuts ? <kbd aria-hidden="true" className="ml-1 text-[9px]">Esc</kbd> : null}</button>
      <button type="button" onClick={() => void approve()} aria-keyshortcuts="Meta+Enter Control+Enter" aria-busy={busy}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-60">
        {busy ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : <Check aria-hidden="true" className="size-3" />}
        {approveLabel}{shortcuts ? <kbd aria-hidden="true" className="ml-1 text-[9px] opacity-70">⌘↵</kbd> : null}
      </button>
    </div>
  )

  return (
    <AffectSurface className={cn('w-full max-w-md', className)} data-slot="approval-card">
      <div className="space-y-1.5">
        {label ? <p className="px-1 text-[10px] text-muted-foreground">{label}</p> : null}
        <div role="group" aria-label={title} aria-busy={busy}
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
          onKeyDown={(event) => {
            if (finished) return
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void approve() }
            if (event.key === 'Escape') { event.preventDefault(); deny() }
          }}
          className="rounded-md border border-border bg-card p-3 focus-within:outline-none focus-within:ring-1 focus-within:ring-ring">
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">{icon ?? <Shield className="size-4" />}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{title}</span>
                {risk ? <AffectToneBadge tone={riskTone[risk]}>{riskLabel[risk]}</AffectToneBadge> : null}
              </div>
              {description ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{description}</p> : null}
            </div>
          </div>

          {!finished ? (
            <>
              {(preview || children) ? <div className="mt-2 rounded-md bg-muted/40 p-2 text-[11px] text-foreground">{preview ?? children}</div> : null}
              {details.length ? (
                <dl className="mt-2 space-y-1">
                  {details.map((detail) => (
                    <div key={detail.label} className="flex items-baseline justify-between gap-2 text-[11px]">
                      <dt className="shrink-0 text-muted-foreground">{detail.label}</dt>
                      <dd className="min-w-0 truncate text-right text-foreground">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {allowAlways ? (
                <label className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input type="checkbox" checked={always} onChange={(event) => setAlways(event.target.checked)}
                    className="size-3 rounded border border-border accent-foreground" />
                  <LockKeyhole aria-hidden="true" className="size-3" /> {alwaysLabel}
                </label>
              ) : null}
              {expiresIn !== undefined ? (
                <p className="mt-1 text-[10px] text-muted-foreground" aria-live="off">Expires in 0:{String(remaining).padStart(2, '0')}</p>
              ) : null}
            </>
          ) : null}
        </div>

        <div className={cn('rounded-md bg-muted/40 px-2 py-1.5', actions === 'card' && 'mt-2 bg-transparent px-0')}>
          {finished ? (
            <div ref={resolvedRef} tabIndex={-1} role="status"
              className={cn('flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                current === 'approved' ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-destructive/10 text-destructive')}>
              <span className="flex items-center gap-1">{current === 'approved' ? <Check aria-hidden="true" className="size-3" /> : <X aria-hidden="true" className="size-3" />}{resolvedLabel[current]}: {title}</span>
              <span className="text-[10px] opacity-70">just now</span>
            </div>
          ) : buttons}
        </div>
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </AffectSurface>
  )
}
