import { ChevronDown, ChevronRight, Coins, Hash } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

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

type Mode = 'cost' | 'tokens'

export interface CostStep {
  id: string
  name: string
  kind: 'agent' | 'llm' | 'tool'
  status: 'running' | 'done' | 'failed'
  model?: string
  detail?: string
  icon?: ReactNode
  tokensIn?: number
  tokensOut?: number
  cost?: number
  duration?: number
  input?: string
  output?: string
  error?: string
  children?: CostStep[]
}

export interface CostWaterfallProps {
  steps: CostStep[]
  task?: string
  mode?: Mode
  defaultMode?: Mode
  onModeChange?: (mode: Mode) => void
  collapsed?: string[]
  defaultCollapsed?: string[]
  onCollapsedChange?: (collapsed: string[]) => void
  openId?: string | null
  defaultOpenId?: string | null
  onOpenChange?: (id: string | null, step?: CostStep) => void
  maxHeight?: number
  formatCost?: (amount: number) => string
  title?: string
  className?: string
}

function totalCost(step: CostStep): number {
  return (step.cost ?? 0) + (step.children ?? []).reduce((sum, child) => sum + totalCost(child), 0)
}
function totalTokens(step: CostStep): number {
  return (step.tokensIn ?? 0) + (step.tokensOut ?? 0) + (step.children ?? []).reduce((sum, child) => sum + totalTokens(child), 0)
}
function allSteps(steps: CostStep[]): CostStep[] {
  return steps.flatMap((step) => [step, ...allSteps(step.children ?? [])])
}

/** A waterfall of an agent run's cost or tokens, step by step. */
export function CostWaterfall({
  steps,
  task,
  mode,
  defaultMode = 'cost',
  onModeChange,
  collapsed,
  defaultCollapsed = [],
  onCollapsedChange,
  openId,
  defaultOpenId = null,
  onOpenChange,
  maxHeight,
  formatCost = defaultFormatCost,
  title = 'Run cost',
  className
}: CostWaterfallProps) {
  const [modeState, setModeState] = useState<Mode>(defaultMode)
  const [collapsedState, setCollapsedState] = useState<string[]>(defaultCollapsed)
  const [openState, setOpenState] = useState<string | null>(defaultOpenId)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const currentMode = mode ?? modeState
  const currentCollapsed = collapsed ?? collapsedState
  const currentOpen = openId !== undefined ? openId : openState
  const value = (step: CostStep) => (currentMode === 'cost' ? totalCost(step) : totalTokens(step))
  const label = (step: CostStep) => (currentMode === 'cost' ? formatCost(value(step)) : `${value(step).toLocaleString()} tok`)
  const changeMode = (next: Mode) => { setModeState(next); onModeChange?.(next) }
  const toggleCollapse = (id: string) => {
    const next = currentCollapsed.includes(id) ? currentCollapsed.filter((x) => x !== id) : [...currentCollapsed, id]
    setCollapsedState(next); onCollapsedChange?.(next)
  }
  const setOpen = (id: string | null, step?: CostStep) => { setOpenState(id); onOpenChange?.(id, step) }

  interface Row { step: CostStep; depth: number; parentId: string | null }
  const rows: Row[] = []
  const visit = (list: CostStep[], depth: number, parentId: string | null) => {
    list.forEach((step) => {
      rows.push({ step, depth, parentId })
      if (step.children?.length && !currentCollapsed.includes(step.id)) visit(step.children, depth + 1, step.id)
    })
  }
  visit(steps, 0, null)

  const values = allSteps(steps).map(value)
  const peak = Math.max(1, ...values)
  let cumulative = 0
  const bars = new Map<string, { left: number; width: number }>()
  rows.forEach(({ step }) => {
    const width = (value(step) / peak) * 100
    bars.set(step.id, { left: (cumulative / peak) * 100, width })
    cumulative += value(step)
  })

  const focusRow = (id: string | null) => {
    if (!id) return
    setFocusedId(id)
    rowRefs.current[id]?.focus()
  }
  const onRowKeyDown = (row: Row, index: number) => (event: KeyboardEvent) => {
    const children = row.step.children ?? []
    if (event.key === 'ArrowDown') { event.preventDefault(); focusRow(rows[Math.min(rows.length - 1, index + 1)]?.step.id ?? null) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(rows[Math.max(0, index - 1)]?.step.id ?? null) }
    else if (event.key === 'Home') { event.preventDefault(); focusRow(rows[0]?.step.id ?? null) }
    else if (event.key === 'End') { event.preventDefault(); focusRow(rows[rows.length - 1]?.step.id ?? null) }
    else if (event.key === 'ArrowRight' && children.length) {
      event.preventDefault()
      if (currentCollapsed.includes(row.step.id)) toggleCollapse(row.step.id)
      else focusRow(children[0].id)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (children.length && !currentCollapsed.includes(row.step.id)) toggleCollapse(row.step.id)
      else if (row.parentId) focusRow(row.parentId)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); setOpen(currentOpen === row.step.id ? null : row.step.id, row.step)
    } else if (event.key === 'Escape') { setOpen(null) }
  }
  const showMostExpensive = () => {
    const target = allSteps(steps).reduce((best, step) => (value(step) > value(best) ? step : best))
    const ancestors = new Set<string>()
    const find = (list: CostStep[], trail: string[]): boolean => {
      for (const step of list) {
        if (step.id === target.id) { trail.forEach((id) => ancestors.add(id)); return true }
        if (find(step.children ?? [], [...trail, step.id])) return true
      }
      return false
    }
    find(steps, [])
    const next = currentCollapsed.filter((id) => !ancestors.has(id))
    setCollapsedState(next); onCollapsedChange?.(next)
    setOpen(target.id, target)
    focusRow(target.id)
  }

  const details = currentOpen ? allSteps(steps).find((step) => step.id === currentOpen) : undefined

  return (
    <div data-slot="cost-waterfall" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          description={task}
          actions={
            <div className="flex items-center gap-1.5">
              <div role="group" aria-label="Measure by" className="flex rounded-md border border-border p-0.5">
                <button type="button" aria-pressed={currentMode === 'cost'} onClick={() => changeMode('cost')} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]', currentMode === 'cost' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}><Coins aria-hidden="true" className="size-3" />Cost</button>
                <button type="button" aria-pressed={currentMode === 'tokens'} onClick={() => changeMode('tokens')} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px]', currentMode === 'tokens' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}><Hash aria-hidden="true" className="size-3" />Tokens</button>
              </div>
              <button type="button" onClick={showMostExpensive} className="rounded-md border border-border px-1.5 py-1 text-[11px] text-foreground hover:bg-accent">Most expensive</button>
            </div>
          }
        />
        <div role="tree" aria-label={`${title} steps`} className="mt-3 space-y-0.5" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
          {rows.map((row, index) => {
            const step = row.step
            const children = step.children ?? []
            const expanded = children.length > 0 && !currentCollapsed.includes(step.id)
            const bar = bars.get(step.id) ?? { left: 0, width: 0 }
            return (
              <div
                key={step.id}
                ref={(el) => { rowRefs.current[step.id] = el }}
                role="treeitem"
                aria-level={row.depth + 1}
                aria-expanded={children.length ? expanded : undefined}
                aria-selected={currentOpen === step.id}
                tabIndex={focusedId === step.id || (!focusedId && index === 0) ? 0 : -1}
                onFocus={() => setFocusedId(step.id)}
                onKeyDown={onRowKeyDown(row, index)}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 outline-none hover:bg-muted/60 focus-visible:border-border', currentOpen === step.id && 'bg-accent')}
                style={{ paddingLeft: `${6 + row.depth * 16}px` }}
              >
                <button type="button" tabIndex={-1} aria-label={expanded ? `Fold ${step.name}` : `Expand ${step.name}`} onClick={(e) => { e.stopPropagation(); children.length && toggleCollapse(step.id) }} className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  {children.length ? (expanded ? <ChevronDown aria-hidden="true" className="size-3" /> : <ChevronRight aria-hidden="true" className="size-3" />) : null}
                </button>
                <AffectStatusDot status={step.status} />
                <span className="w-28 shrink-0 truncate text-xs text-foreground" title={step.name}>{step.name}</span>
                <span aria-hidden="true" className="relative h-2 min-w-0 flex-1 rounded-full bg-muted">
                  <span className={cn('absolute inset-y-0 rounded-full', step.status === 'failed' ? 'bg-destructive' : step.kind === 'llm' ? 'bg-primary' : step.kind === 'tool' ? 'bg-info' : 'bg-success')} style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-foreground">{label(step)}</span>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{step.duration ? formatDuration(step.duration) : '—'}</span>
              </div>
            )
          })}
        </div>
        {details ? (
          <div role="dialog" aria-label={`${details.name} details`} className="mt-3 rounded-md border border-border bg-background p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <AffectSectionLabel>{details.name}</AffectSectionLabel>
              <button type="button" aria-label="Close details" onClick={() => setOpen(null)} className="rounded px-1 text-xs text-muted-foreground hover:text-foreground">Close</button>
            </div>
            {details.error ? <p className="mb-1 text-[11px] text-destructive">{details.error}</p> : null}
            {details.input ? <pre className="mb-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5 text-[11px] text-foreground">{details.input}</pre> : null}
            {details.output ? <pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5 text-[11px] text-foreground">{details.output}</pre> : null}
            {!details.input && !details.output && !details.error ? <p className="text-[11px] text-muted-foreground">No details for this step.</p> : null}
          </div>
        ) : null}
        <AffectToneBadge tone={steps.some((s) => s.status === 'running') ? 'info' : 'neutral'} className="mt-2">
          {steps.some((s) => s.status === 'running') ? 'Live' : 'Done'}
        </AffectToneBadge>
      </AffectSurface>
    </div>
  )
}
