import { Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, LoaderCircle, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatDuration } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectSurface, AffectToneBadge } from '../shared/ui'

export type AwayKind = 'needs-you' | 'failed' | 'done'
export interface AwayItem { id: string; title: string; kind: AwayKind; detail?: string; action?: string | false }
export interface AwaySummaryProps {
  since: Date | number | string
  items: AwayItem[]
  onAction?: (id: string, item: AwayItem) => void | Promise<void>
  onDismiss?: () => void
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  limit?: number
  timeStyle?: 'duration' | 'clock'
  now?: Date | number
  labels?: Partial<{ title: string; needsYou: string; failed: string; done: string; showMore: string; showLess: string; gotIt: string; divider: string }>
  className?: string
}

const order: Record<AwayKind, number> = { 'needs-you': 0, failed: 1, done: 2 }
const tone: Record<AwayKind, AffectTone> = { 'needs-you': 'warning', failed: 'danger', done: 'success' }
const mark: Record<AwayKind, ReactNode> = {
  'needs-you': <MessageSquare className="size-3" />,
  failed: <CircleAlert className="size-3" />,
  done: <CircleCheck className="size-3" />
}
const defaultAction: Record<AwayKind, string> = { 'needs-you': 'Decide', failed: 'Retry', done: 'Open' }

function sinceText(value: Date | number | string, now: Date | number, style: 'duration' | 'clock'): string {
  const start = new Date(value).getTime()
  const current = new Date(now).getTime()
  if (style === 'clock') return `since ${new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return formatDuration(Math.max(0, current - start))
}

/** A “while you were away” card in a thread, folding to a one-line divider. */
export function AwaySummary({
  since, items, onAction, onDismiss, collapsed, defaultCollapsed = false, onCollapsedChange,
  limit = 5, timeStyle = 'duration', now = Date.now(), labels, className
}: AwaySummaryProps) {
  const words = {
    title: 'While you were away', needsYou: 'needs you', failed: 'failed', done: 'done',
    showMore: 'Show more', showLess: 'Show less', gotIt: 'Got it', divider: 'Caught up', ...labels
  }
  const [localCollapsed, setLocalCollapsed] = useState(defaultCollapsed)
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const isCollapsed = collapsed ?? localCollapsed
  const sorted = [...items].sort((a, b) => order[a.kind] - order[b.kind])
  const visible = showAll ? sorted : sorted.slice(0, limit)
  const counts = {
    'needs-you': items.filter((item) => item.kind === 'needs-you').length,
    failed: items.filter((item) => item.kind === 'failed').length,
    done: items.filter((item) => item.kind === 'done').length
  }
  const setCollapsed = (value: boolean) => {
    if (collapsed === undefined) setLocalCollapsed(value)
    onCollapsedChange?.(value)
  }
  const run = async (item: AwayItem) => {
    setBusy(item.id)
    try {
      await onAction?.(item.id, item)
      setAnnounce(`${item.title}: done`)
    } finally {
      setBusy(null)
    }
  }

  if (isCollapsed) {
    return (
      <AffectSurface className={cn('w-full', className)} data-slot="away-summary">
        <button type="button" aria-expanded={false} onClick={() => setCollapsed(false)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-muted/60">
          <span className="h-px flex-1 bg-border" />
          <ChevronDown aria-hidden="true" className="size-3" />
          {words.divider}
          <span className="h-px flex-1 bg-border" />
        </button>
      </AffectSurface>
    )
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="away-summary">
      <section aria-label={words.title} className="space-y-2 p-3"
        onKeyDown={(event) => { if (event.key === 'Escape') setCollapsed(true) }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-xs font-medium text-foreground">{words.title}</h3>
            <p className="text-[10px] text-muted-foreground">
              {sinceText(since, now, timeStyle)} · {counts['needs-you']} {words.needsYou} · {counts.failed} {words.failed} · {counts.done} {words.done}
            </p>
          </div>
          <button type="button" aria-label={words.gotIt} onClick={() => { setCollapsed(true); onDismiss?.() }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted">
            <Check aria-hidden="true" className="size-3" /> {words.gotIt}
          </button>
        </div>
        <ul role="list" className="space-y-1">
          {visible.map((item) => {
            const action = item.action === false ? null : item.action ?? defaultAction[item.kind]
            return (
              <li key={item.id} className="flex min-h-8 items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <span aria-hidden="true" className={cn('flex size-4 shrink-0 items-center justify-center rounded-full',
                  tone[item.kind] === 'warning' ? 'bg-warning-subtle text-warning-subtle-foreground' : tone[item.kind] === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-success-subtle text-success-subtle-foreground')}>
                  {mark[item.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-medium text-foreground">{item.title}</span>
                  {item.detail ? <span className="block truncate text-[10px] text-muted-foreground">{item.detail}</span> : null}
                </span>
                <AffectToneBadge tone={tone[item.kind]}>{item.kind === 'needs-you' ? words.needsYou : item.kind === 'failed' ? words.failed : words.done}</AffectToneBadge>
                {action ? (
                  <button type="button" aria-label={`${action}: ${item.title}`} aria-busy={busy === item.id}
                    disabled={busy === item.id} onClick={() => void run(item)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-foreground hover:bg-muted disabled:opacity-60">
                    {busy === item.id ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : null}{action}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
        {sorted.length > limit ? (
          <button type="button" onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-1 text-[11px] text-info hover:underline">
            {showAll ? <ChevronUp aria-hidden="true" className="size-3" /> : <ChevronDown aria-hidden="true" className="size-3" />}
            {showAll ? words.showLess : `${words.showMore} (${sorted.length - limit})`}
          </button>
        ) : null}
        <p className="sr-only" aria-live="polite">{announce}</p>
      </section>
    </AffectSurface>
  )
}
