import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import {
  AffectHeader,
  AffectSectionLabel,
  AffectStatusDot,
  AffectSurface,
  AffectToneBadge,
  formatCost as defaultFormatCost,
  formatDuration
} from '../shared'

export type TraceKind = 'agent' | 'subagent' | 'llm' | 'tool'

/**
 * All user-visible copy, so embedding apps (which own i18n) can supply translated
 * strings. Defaults keep the standalone/storybook usage unchanged.
 */
export interface TraceWaterfallLabels {
  title?: string
  live?: string
  failed?: string
  done?: string
  slowest?: string
  close?: string
  closeDetails?: string
  noDetails?: string
  spans?: string
  details?: string
  fold?: string
  expand?: string
}

export interface TraceSpan {
  id: string
  name: string
  kind: TraceKind
  status: 'running' | 'done' | 'failed'
  start: number
  end?: number
  detail?: string
  icon?: ReactNode
  model?: string
  tokensIn?: number
  tokensOut?: number
  cost?: number
  input?: string
  output?: string
  error?: string
  children?: TraceSpan[]
}
export interface TraceWaterfallProps {
  root: TraceSpan
  now?: number
  startedAt?: number
  collapsed?: string[]
  defaultCollapsed?: string[]
  onCollapsedChange?: (collapsed: string[]) => void
  openId?: string | null
  defaultOpenId?: string | null
  onOpenChange?: (id: string | null, span?: TraceSpan) => void
  markSlowest?: boolean
  minRange?: number
  formatCost?: (amount: number) => string
  title?: string
  labels?: TraceWaterfallLabels
  className?: string
}

const kindTone: Record<TraceKind, string> = { agent: 'bg-muted-foreground/70', subagent: 'bg-success', llm: 'bg-primary', tool: 'bg-info' }

/** Every span of an agent run on one live timeline. */
export function TraceWaterfall({
  root,
  now,
  startedAt,
  collapsed,
  defaultCollapsed = [],
  onCollapsedChange,
  openId,
  defaultOpenId = null,
  onOpenChange,
  markSlowest = true,
  minRange = 10_000,
  formatCost = defaultFormatCost,
  title = 'Trace',
  labels,
  className
}: TraceWaterfallProps) {
  const l = {
    title,
    live: 'Live',
    failed: 'Failed',
    done: 'Done',
    slowest: 'Slowest',
    close: 'Close',
    closeDetails: 'Close details',
    noDetails: 'No details for this span.',
    spans: 'spans',
    details: 'details',
    fold: 'Fold',
    expand: 'Expand',
    ...labels
  }
  const [collapsedState, setCollapsedState] = useState<string[]>(defaultCollapsed)
  const [openState, setOpenState] = useState<string | null>(defaultOpenId)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [tick, setTick] = useState(Date.now())
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const currentCollapsed = collapsed ?? collapsedState
  const currentOpen = openId !== undefined ? openId : openState
  const clock = now ?? (startedAt !== undefined ? Math.max(0, tick - startedAt) : tick)

  useEffect(() => {
    if (now !== undefined || startedAt === undefined) return
    const timer = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(timer)
  }, [now, startedAt])

  const all: TraceSpan[] = []
  const collect = (span: TraceSpan) => { all.push(span); (span.children ?? []).forEach(collect) }
  collect(root)
  const range = Math.max(minRange, ...all.map((span) => span.end ?? clock), clock)
  const slowest = markSlowest ? all.filter((span) => span.status === 'done' && (span.kind === 'llm' || span.kind === 'tool')).reduce<TraceSpan | null>((best, span) => (!best || span.end! - span.start > best.end! - best.start ? span : best), null) : null

  interface Row { span: TraceSpan; depth: number; parentId: string | null }
  const rows: Row[] = []
  const visit = (span: TraceSpan, depth: number, parentId: string | null) => {
    rows.push({ span, depth, parentId })
    if (span.children?.length && !currentCollapsed.includes(span.id)) span.children.forEach((child) => visit(child, depth + 1, span.id))
  }
  visit(root, 0, null)

  const toggleCollapse = (id: string) => {
    const next = currentCollapsed.includes(id) ? currentCollapsed.filter((item) => item !== id) : [...currentCollapsed, id]
    setCollapsedState(next); onCollapsedChange?.(next)
  }
  const setOpen = (id: string | null, span?: TraceSpan) => { setOpenState(id); onOpenChange?.(id, span) }
  const focusRow = (id: string | null) => { if (!id) return; setFocusedId(id); rowRefs.current[id]?.focus() }
  const onRowKeyDown = (row: Row, index: number) => (event: KeyboardEvent) => {
    const children = row.span.children ?? []
    if (event.key === 'ArrowDown') { event.preventDefault(); focusRow(rows[Math.min(rows.length - 1, index + 1)]?.span.id ?? null) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(rows[Math.max(0, index - 1)]?.span.id ?? null) }
    else if (event.key === 'Home') { event.preventDefault(); focusRow(rows[0]?.span.id ?? null) }
    else if (event.key === 'End') { event.preventDefault(); focusRow(rows[rows.length - 1]?.span.id ?? null) }
    else if (event.key === 'ArrowRight' && children.length) { event.preventDefault(); if (currentCollapsed.includes(row.span.id)) toggleCollapse(row.span.id); else focusRow(children[0].id) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); if (children.length && !currentCollapsed.includes(row.span.id)) toggleCollapse(row.span.id); else if (row.parentId) focusRow(row.parentId) }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen(currentOpen === row.span.id ? null : row.span.id, row.span) }
    else if (event.key === 'Escape') setOpen(null)
  }
  const details = currentOpen ? all.find((span) => span.id === currentOpen) : undefined
  const statusTone = root.status === 'failed' ? 'danger' : root.status === 'running' ? 'info' : 'success'

  return (
    <div data-slot="trace-waterfall" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={l.title} description={root.input ?? root.name} actions={<AffectToneBadge tone={statusTone}>{root.status === 'running' ? l.live : root.status === 'failed' ? l.failed : l.done}</AffectToneBadge>} />
        <div className="mt-3 flex justify-between border-b border-border pb-1 text-[10px] tabular-nums text-muted-foreground"><span>0</span><span>{formatDuration(range / 2)}</span><span>{formatDuration(range)}</span></div>
        <div role="tree" aria-label={`${l.title} ${l.spans}`} className="mt-1 space-y-0.5">
          {rows.map((row, index) => {
            const span = row.span
            const children = span.children ?? []
            const expanded = children.length > 0 && !currentCollapsed.includes(span.id)
            const end = span.end ?? clock
            const left = (span.start / range) * 100
            const width = Math.max(0.4, ((end - span.start) / range) * 100)
            return (
              <div
                key={span.id}
                ref={(el) => { rowRefs.current[span.id] = el }}
                role="treeitem"
                aria-level={row.depth + 1}
                aria-expanded={children.length ? expanded : undefined}
                aria-selected={currentOpen === span.id}
                tabIndex={focusedId === span.id || (!focusedId && index === 0) ? 0 : -1}
                onFocus={() => setFocusedId(span.id)}
                onKeyDown={onRowKeyDown(row, index)}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-1.5 py-1 outline-none hover:bg-muted/60 focus-visible:border-border', currentOpen === span.id && 'bg-accent')}
                style={{ paddingLeft: `${6 + row.depth * 16}px` }}
              >
                <button type="button" tabIndex={-1} aria-label={expanded ? `${l.fold} ${span.name}` : `${l.expand} ${span.name}`} onClick={(event) => { event.stopPropagation(); children.length && toggleCollapse(span.id) }} className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  {children.length ? (expanded ? <ChevronDown aria-hidden="true" className="size-3" /> : <ChevronRight aria-hidden="true" className="size-3" />) : null}
                </button>
                <AffectStatusDot status={span.status} />
                <span className="flex w-32 shrink-0 items-center gap-1 truncate text-xs text-foreground" title={span.name}>{span.icon}<span className="truncate">{span.name}</span>{slowest?.id === span.id ? <AffectToneBadge tone="warning">{l.slowest}</AffectToneBadge> : null}</span>
                <span aria-hidden="true" className="relative h-2 min-w-0 flex-1 rounded-full bg-muted">
                  <span className={cn('absolute inset-y-0 rounded-full', span.status === 'failed' ? 'bg-destructive' : kindTone[span.kind], span.status === 'running' && 'animate-pulse')} style={{ left: `${left}%`, width: `${width}%` }} />
                </span>
                <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{formatDuration(end - span.start)}</span>
                <span className="w-14 shrink-0 text-right text-[10px] tabular-nums text-foreground">{span.cost !== undefined ? formatCost(span.cost) : span.kind === 'llm' ? `${(span.tokensIn ?? 0) + (span.tokensOut ?? 0)} tok` : '—'}</span>
              </div>
            )
          })}
        </div>
        {details ? (
          <div role="dialog" aria-label={`${details.name} ${l.details}`} className="mt-3 rounded-md border border-border bg-background p-2.5">
            <div className="mb-2 flex items-center justify-between"><AffectSectionLabel>{details.name}{details.detail ? ` · ${details.detail}` : ''}</AffectSectionLabel><button type="button" aria-label={l.closeDetails} onClick={() => setOpen(null)} className="text-[11px] text-muted-foreground">{l.close}</button></div>
            {details.error ? <p className="mb-1 text-[11px] text-destructive">{details.error}</p> : null}
            {details.model ? <p className="mb-1 text-[11px] text-muted-foreground">{details.model}</p> : null}
            {details.input ? <pre className="mb-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5 text-[10px] text-foreground">{details.input}</pre> : null}
            {details.output ? <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5 text-[10px] text-foreground">{details.output}</pre> : null}
            {!details.input && !details.output && !details.error ? <p className="text-[11px] text-muted-foreground">{l.noDetails}</p> : null}
          </div>
        ) : null}
      </AffectSurface>
    </div>
  )
}
