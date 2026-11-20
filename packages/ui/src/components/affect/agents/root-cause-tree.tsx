import { AlertCircle, CheckCircle2, ChevronRight, CircleDashed, LoaderCircle, Wrench } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, formatDuration } from '../shared'

export type CauseStatus = 'open' | 'checking' | 'ruled-out' | 'confirmed'
export interface Cause {
  id: string
  title: string
  icon?: ReactNode
  files?: string[]
  gate?: 'or' | 'and'
  status?: CauseStatus
  verdict?: string
  evidence?: { kind: string; source?: string; content: string }
  at?: number
  children?: Cause[]
}
export interface RootCauseTreeProps {
  failure: Cause & { detail?: string }
  onAction?: (cause: Cause, action: 'fix' | 'retry') => void
  formatTime?: (ms: number) => string
  title?: string
  className?: string
}

const statusIcon: Record<CauseStatus, ReactNode> = {
  open: <CircleDashed aria-hidden="true" className="size-3 text-muted-foreground" />,
  checking: <LoaderCircle aria-hidden="true" className="size-3 animate-spin text-info" />,
  'ruled-out': <AlertCircle aria-hidden="true" className="size-3 text-muted-foreground" />,
  confirmed: <CheckCircle2 aria-hidden="true" className="size-3 text-success" />
}
const statusWord: Record<CauseStatus, string> = { open: 'Open', checking: 'Checking', 'ruled-out': 'Ruled out', confirmed: 'Confirmed' }

/** A fault tree of how an agent found why a run failed. */
export function RootCauseTree({
  failure,
  onAction,
  formatTime = (ms) => formatDuration(ms),
  title = 'Root cause',
  className
}: RootCauseTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [focused, setFocused] = useState(failure.id)
  const refs = useRef<Record<string, HTMLDivElement | null>>({})

  const rows: { cause: Cause; depth: number }[] = []
  const walk = (cause: Cause, depth: number) => {
    rows.push({ cause, depth })
    if (!collapsed.has(cause.id)) (cause.children ?? []).forEach((child) => walk(child, depth + 1))
  }
  walk(failure, 0)

  const find = (cause: Cause, id: string): Cause | null => {
    if (cause.id === id) return cause
    for (const child of cause.children ?? []) { const found = find(child, id); if (found) return found }
    return null
  }
  const path = new Set<string>()
  const markPath = (cause: Cause): boolean => {
    if (cause.status === 'confirmed' && !(cause.children ?? []).length) { path.add(cause.id); return true }
    if ((cause.children ?? []).some(markPath)) { path.add(cause.id); return true }
    return false
  }
  markPath(failure)

  const toggle = (id: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const index = Math.max(0, rows.findIndex((row) => row.cause.id === focused))
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = rows[index]
    if (event.key === 'ArrowDown') { event.preventDefault(); const next = rows[Math.min(rows.length - 1, index + 1)]; setFocused(next.cause.id); refs.current[next.cause.id]?.focus() }
    else if (event.key === 'ArrowUp') { event.preventDefault(); const next = rows[Math.max(0, index - 1)]; setFocused(next.cause.id); refs.current[next.cause.id]?.focus() }
    else if (event.key === 'Home') { event.preventDefault(); setFocused(rows[0].cause.id); refs.current[rows[0].cause.id]?.focus() }
    else if (event.key === 'End') { event.preventDefault(); const next = rows[rows.length - 1]; setFocused(next.cause.id); refs.current[next.cause.id]?.focus() }
    else if (event.key === 'ArrowRight' && row?.cause.children?.length) { event.preventDefault(); if (collapsed.has(row.cause.id)) toggle(row.cause.id); else { const child = row.cause.children![0]; setFocused(child.id); refs.current[child.id]?.focus() } }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); if (row?.cause.children?.length && !collapsed.has(row.cause.id)) toggle(row.cause.id); else { const parent = rows[Math.max(0, index - 1)]; setFocused(parent.cause.id); refs.current[parent.cause.id]?.focus() } }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected((current) => (current === row?.cause.id ? null : row?.cause.id ?? null)) }
    else if (event.key === 'Escape') { setSelected(null) }
  }
  const selectedCause = selected ? find(failure, selected) : null
  const isRootCause = (cause: Cause) => cause.status === 'confirmed' && !(cause.children ?? []).length

  return (
    <div data-slot="root-cause-tree" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={failure.detail} actions={failure.status ? <AffectToneBadge tone={failure.status === 'confirmed' ? 'success' : 'neutral'}>{statusWord[failure.status]}</AffectToneBadge> : undefined} />
        <div role="tree" aria-label="Failure and hypotheses" className="mt-3 space-y-1.5">
          {rows.map(({ cause, depth }) => {
            const children = cause.children ?? []
            const status = cause.status ?? 'open'
            const expanded = children.length > 0 && !collapsed.has(cause.id)
            return (
              <div
                key={cause.id}
                ref={(el) => { refs.current[cause.id] = el }}
                role="treeitem"
                aria-level={depth + 1}
                aria-expanded={children.length ? expanded : undefined}
                aria-selected={selected === cause.id}
                tabIndex={focused === cause.id ? 0 : -1}
                onFocus={() => setFocused(cause.id)}
                onKeyDown={onKeyDown}
                onClick={() => setSelected((current) => (current === cause.id ? null : cause.id))}
                style={{ marginLeft: `${depth * 18}px` }}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 outline-none hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring', path.has(cause.id) && 'border-success', status === 'ruled-out' && 'opacity-60', selected === cause.id && 'bg-accent')}
              >
                {children.length ? (
                  <button type="button" tabIndex={-1} aria-label={expanded ? `Fold ${cause.title}` : `Expand ${cause.title}`} onClick={(event) => { event.stopPropagation(); toggle(cause.id) }} className="flex size-4 shrink-0 items-center justify-center text-muted-foreground"><ChevronRight aria-hidden="true" className={cn('size-3 transition-transform', expanded && 'rotate-90')} /></button>
                ) : <span className="size-4 shrink-0" />}
                {cause.icon ?? statusIcon[status]}
                <span className={cn('min-w-0 flex-1 truncate text-xs text-foreground', status === 'ruled-out' && 'line-through')}>{cause.title}</span>
                {cause.gate ? <AffectToneBadge tone="neutral">{cause.gate.toUpperCase()}</AffectToneBadge> : null}
                {cause.files?.length ? <span className="shrink-0 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">{cause.files[0]}{cause.files.length > 1 ? ` +${cause.files.length - 1}` : ''}</span> : null}
                {cause.at !== undefined ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatTime(cause.at)}</span> : null}
                <AffectToneBadge tone={status === 'confirmed' ? 'success' : status === 'ruled-out' ? 'neutral' : status === 'checking' ? 'info' : 'warning'}>{statusWord[status]}</AffectToneBadge>
              </div>
            )
          })}
        </div>

        {selectedCause ? (
          <div role="region" aria-label={`${selectedCause.title} evidence`} className="mt-3 rounded-md border border-border bg-background p-2.5">
            <div className="flex items-center justify-between"><span className="text-xs font-medium text-foreground">{selectedCause.title}</span><button type="button" aria-label="Close evidence" onClick={() => setSelected(null)} className="text-[11px] text-muted-foreground">Close</button></div>
            {selectedCause.verdict ? <p className="mt-1 text-[11px] text-muted-foreground">{selectedCause.verdict}</p> : null}
            {selectedCause.evidence ? (
              <div className="mt-2 rounded-md bg-muted p-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground"><span className="rounded bg-background px-1 py-px">{selectedCause.evidence.kind}</span>{selectedCause.evidence.source}</div>
                <pre className="overflow-auto whitespace-pre-wrap text-[11px] text-foreground">{selectedCause.evidence.content}</pre>
              </div>
            ) : null}
            {selectedCause.files?.length ? <p className="mt-1 text-[10px] text-muted-foreground">{selectedCause.files.join(' · ')}</p> : null}
            {onAction && isRootCause(selectedCause) ? (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => onAction(selectedCause, 'fix')} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"><Wrench aria-hidden="true" className="size-3" />Fix it</button>
                <button type="button" onClick={() => onAction(selectedCause, 'retry')} className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted">Retry from here</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </AffectSurface>
    </div>
  )
}
