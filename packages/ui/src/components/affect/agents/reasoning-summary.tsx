import { Brain, ChevronDown, ExternalLink, FileText } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, affectToneClass, formatCost, formatDuration, type AffectTone } from '../shared'

export interface ReasonStep { id: string; kind: string; label: string; model?: string; ms?: number; running?: boolean }
export interface ReasonModel {
  id: string
  name: string
  logo?: ReactNode
  effort: 'low' | 'medium' | 'high' | 'max'
  role?: string
  provider?: string
  tokens?: { input?: number; output?: number }
  cost?: number
  note?: string
}
export interface ReasonSource { name: string; detail?: string; href?: string; logo?: ReactNode }
export interface ReasoningSummaryProps {
  steps: ReasonStep[]
  models: ReasonModel[]
  sources?: ReasonSource[]
  sourceCount?: number
  running?: boolean
  estimate?: number
  kinds?: Record<string, { label: string; color?: string; icon?: ReactNode }>
  agent?: { id: string; color?: string }
  defaultOpen?: boolean
  className?: string
}

const palette: AffectTone[] = ['info', 'warning', 'primary', 'success', 'neutral']
const effortLevel: Record<ReasonModel['effort'], number> = { low: 1, medium: 2, high: 3, max: 4 }

/** How an agent spent its time on one answer, and which models took part. */
export function ReasoningSummary({
  steps,
  models,
  sources = [],
  sourceCount,
  running = false,
  estimate,
  kinds,
  agent,
  defaultOpen = false,
  className
}: ReasoningSummaryProps) {
  const [open, setOpen] = useState<string | null>(defaultOpen ? 'steps' : null)
  const [focusedKind, setFocusedKind] = useState(0)
  const [focusedModel, setFocusedModel] = useState(0)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const kindNames = [...new Set(steps.map((step) => step.kind))]
  const total = steps.reduce((sum, step) => sum + (step.ms ?? 0), 0)
  const toneOf = (kind: string) => palette[Math.max(0, kindNames.indexOf(kind)) % palette.length]
  const kindLabel = (kind: string) => kinds?.[kind]?.label ?? kind
  const kindIcon = (kind: string) => kinds?.[kind]?.icon
  const duration = running ? `${formatDuration(total)} and counting` : `Reasoned for ${formatDuration(total)}, ${steps.length} steps`

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { setOpen(null); setHighlight(null); return }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      setFocusedKind((index) => (index + (event.key === 'ArrowRight' ? 1 : -1) + kindNames.length) % Math.max(1, kindNames.length))
      setHighlight(kindNames[focusedKind] ?? null)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!event.currentTarget.contains(document.activeElement) || focusedModel >= 0) {
        event.preventDefault()
        setFocusedModel((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + models.length) % Math.max(1, models.length))
        setHighlight(models[focusedModel]?.id ?? null)
      }
    }
  }
  const toggle = (key: string) => { setOpen((current) => (current === key ? null : key)); setAnnounce(`${key} ${open === key ? 'closed' : 'opened'}`) }

  return (
    <div data-slot="reasoning-summary" onKeyDown={onKeyDown} className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={<span className="inline-flex items-center gap-1.5"><Brain aria-hidden="true" className={cn('size-4', running && 'animate-pulse text-info')} />Reasoning</span>}
          description={agent ? `Agent ${agent.id}` : undefined}
          actions={<AffectToneBadge tone={running ? 'info' : 'neutral'}>{running ? 'Reasoning' : formatDuration(total)}</AffectToneBadge>}
        />
        <div role="img" aria-label={duration} className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
          {steps.map((step) => (
            <button
              key={step.id}
              type="button"
              aria-label={`${kindLabel(step.kind)}: ${step.label}, ${formatDuration(step.ms ?? 0)}`}
              title={`${kindLabel(step.kind)} · ${formatDuration(step.ms ?? 0)}`}
              onFocus={() => setHighlight(step.model ?? step.kind)}
              onMouseEnter={() => setHighlight(step.model ?? step.kind)}
              onMouseLeave={() => setHighlight(null)}
              className={cn('h-full min-w-[2px] rounded-full', affectToneClass[toneOf(step.kind)].split(' ')[0], step.running && 'animate-pulse', highlight && highlight !== (step.model ?? step.kind) && 'opacity-40')}
              style={{ flexGrow: Math.max(1, step.ms ?? 1) }}
            />
          ))}
          {running && estimate ? <span aria-hidden="true" className="h-full rounded-full bg-muted" style={{ flexGrow: Math.max(1, estimate - total) }} /> : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1">
          {kindNames.map((kind, index) => {
            const kindMs = steps.filter((step) => step.kind === kind).reduce((sum, step) => sum + (step.ms ?? 0), 0)
            return (
              <button key={kind} type="button" onFocus={() => { setFocusedKind(index); setHighlight(kind) }} onMouseEnter={() => setHighlight(kind)} onMouseLeave={() => setHighlight(null)} className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] hover:bg-muted/60', highlight === kind && 'bg-muted/60')}>
                <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-sm', affectToneClass[toneOf(kind)])}>{kindIcon(kind) ?? <span className="text-[9px]">{kindLabel(kind).slice(0, 1)}</span>}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{kindLabel(kind)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(kindMs)}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 space-y-0.5">
          {models.map((model, index) => {
            const modelMs = steps.filter((step) => step.model === model.id).reduce((sum, step) => sum + (step.ms ?? 0), 0)
            const level = effortLevel[model.effort]
            return (
              <div key={model.id}>
                <button type="button" aria-expanded={open === model.id} onFocus={() => { setFocusedModel(index); setHighlight(model.id) }} onMouseEnter={() => setHighlight(model.id)} onMouseLeave={() => setHighlight(null)} onClick={() => toggle(model.id)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60', highlight === model.id && 'bg-muted/60')}>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-foreground">{model.logo ?? model.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-foreground">{model.name}{model.role ? <span className="ml-1 font-normal text-muted-foreground">· {model.role}</span> : null}</span></span>
                  <span aria-label={`Effort ${model.effort}`} className="flex shrink-0 items-end gap-0.5">{Array.from({ length: 4 }, (_, bar) => <span key={bar} className={cn('w-1 rounded-sm', bar < level ? 'bg-primary' : 'bg-muted')} style={{ height: `${4 + bar * 2}px` }} />)}</span>
                  <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{formatDuration(modelMs)}</span>
                  <ChevronDown aria-hidden="true" className={cn('size-3 shrink-0 text-muted-foreground transition-transform', open === model.id && 'rotate-180')} />
                </button>
                {open === model.id ? (
                  <div role="region" className="ml-7 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
                    {model.provider ? <p>{model.provider}</p> : null}
                    {model.tokens ? <p>{model.tokens.input?.toLocaleString() ?? 0} in · {model.tokens.output?.toLocaleString() ?? 0} out</p> : null}
                    {model.cost !== undefined ? <p>{formatCost(model.cost)}</p> : null}
                    {model.note ? <p className="mt-1 text-foreground">{model.note}</p> : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <button type="button" aria-expanded={open === 'sources'} onClick={() => toggle('sources')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60"><FileText aria-hidden="true" className="size-3" />Sources {sourceCount ?? sources.length}</button>
          <button type="button" aria-expanded={open === 'steps'} onClick={() => toggle('steps')} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60">Steps {steps.length}</button>
        </div>
        {open === 'sources' ? (
          <ul role="list" className="mt-1 space-y-0.5 rounded-md bg-muted p-2 text-[11px]">
            {sources.map((source, index) => <li key={index} className="flex items-center gap-1.5"><span className="shrink-0 text-muted-foreground">{source.logo ?? <FileText aria-hidden="true" className="size-3" />}</span><span className="min-w-0 flex-1 truncate text-foreground">{source.name}{source.detail ? <span className="text-muted-foreground"> · {source.detail}</span> : null}</span>{source.href ? <a href={source.href} aria-label={`Open ${source.name}`} className="text-info"><ExternalLink aria-hidden="true" className="size-3" /></a> : null}</li>)}
            {sourceCount && sourceCount > sources.length ? <li className="text-muted-foreground">+{sourceCount - sources.length} more</li> : null}
          </ul>
        ) : null}
        {open === 'steps' ? (
          <ol className="mt-1 space-y-0.5 rounded-md bg-muted p-2 text-[11px]">
            {steps.map((step) => <li key={step.id} className="flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', affectToneClass[toneOf(step.kind)].split(' ')[0])} /><span className="min-w-0 flex-1 truncate text-foreground">{step.label}</span><span className="shrink-0 tabular-nums text-muted-foreground">{step.ms ? formatDuration(step.ms) : 'running'}</span></li>)}
          </ol>
        ) : null}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce || duration}</p>
    </div>
  )
}
