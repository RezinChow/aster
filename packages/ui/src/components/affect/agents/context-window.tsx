import { ChevronRight, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import {
  AffectHeader,
  AffectMeter,
  AffectSectionLabel,
  AffectSurface,
  AffectToneBadge,
  affectToneClass,
  type AffectTone
} from '../shared'

export interface ContextItem {
  id: string
  label: string
  tokens?: number
}

export interface ContextPart {
  id: string
  label: string
  tokens?: number
  items?: ContextItem[]
  locked?: boolean
  compact?: boolean
  color?: string
}

export interface ContextWindowProps {
  parts: ContextPart[]
  limit: number
  title?: string
  model?: string
  modelIcon?: ReactNode
  onRemoveItem?: (partId: string, itemId: string) => void
  onCompact?: (partId: string) => void | Promise<void>
  action?: { label: string; onClick: () => void }
  warnAt?: number
  cells?: number
  columns?: number
  className?: string
}

const tones: AffectTone[] = ['primary', 'info', 'success', 'warning', 'neutral']

function toggleId(current: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** A field of cells showing what fills a model's context window. */
export function ContextWindow({
  parts,
  limit,
  title = 'Context window',
  model,
  modelIcon,
  onRemoveItem,
  onCompact,
  action,
  warnAt = 0.8,
  cells = 216,
  columns = 36,
  className
}: ContextWindowProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set())
  const [compacted, setCompacted] = useState<ReadonlySet<string>>(() => new Set())
  const [shimmer, setShimmer] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const tokensOf = (part: ContextPart): number => {
    const base = part.items
      ? part.items.reduce((sum, item) => sum + (removed.has(item.id) ? 0 : (item.tokens ?? 0)), 0)
      : (part.tokens ?? 0)
    return compacted.has(part.id) ? Math.round(base * 0.4) : base
  }
  const used = parts.reduce((sum, part) => sum + tokensOf(part), 0)
  const ratio = limit > 0 ? used / limit : 0
  const full = ratio >= 0.95
  const warn = ratio >= warnAt
  const filled = Math.min(cells, Math.max(0, Math.round(ratio * cells)))

  const cellData: { tone: number; partId: string }[] = []
  let assigned = 0
  parts.forEach((part, index) => {
    const share = used > 0 ? Math.round((tokensOf(part) / used) * filled) : 0
    const count = index === parts.length - 1 ? filled - assigned : share
    for (let i = 0; i < count; i++) cellData.push({ tone: index % tones.length, partId: part.id })
    assigned += count
  })

  const remove = (partId: string, itemId: string) => {
    setRemoved((current) => new Set(current).add(itemId))
    onRemoveItem?.(partId, itemId)
  }
  const compact = async (partId: string) => {
    setShimmer(partId)
    try {
      await onCompact?.(partId)
      setCompacted((current) => new Set(current).add(partId))
    } finally {
      setShimmer(null)
    }
  }

  return (
    <div data-slot="context-window" role="group" aria-label={title} className={cn('w-full max-w-[360px]', className)}>
      <AffectSurface className="space-y-3 p-3">
        <AffectHeader
          title={title}
          description={model ? <span className="inline-flex items-center gap-1">{modelIcon}{model}</span> : undefined}
          actions={action ? (
            <button type="button" onClick={action.onClick} className="rounded-md bg-muted px-2 py-1 text-[11px] text-foreground hover:bg-accent">
              {action.label}
            </button>
          ) : undefined}
        />

        <div
          aria-hidden="true"
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cells }, (_, index) => {
            const data = cellData[index]
            if (!data) return <span key={index} className="aspect-square rounded-[2px] bg-muted" />
            return (
              <span
                key={index}
                className={cn(
                  'aspect-square rounded-[2px] transition-opacity',
                  affectToneClass[tones[data.tone]].split(' ')[0],
                  hovered && hovered !== data.partId && 'opacity-30',
                  shimmer === data.partId && 'animate-pulse'
                )}
              />
            )
          })}
        </div>
        <p className="sr-only">{used.toLocaleString()} of {limit.toLocaleString()} tokens used</p>

        <div className="space-y-1">
          <AffectSectionLabel>In this window</AffectSectionLabel>
          {parts.map((part) => {
            const items = part.items ?? []
            const expanded = open.has(part.id)
            const tone = tones[parts.indexOf(part) % tones.length]
            return (
              <div key={part.id}>
                <div
                  className="flex items-center gap-2"
                  onMouseEnter={() => setHovered(part.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {items.length && !part.locked ? (
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen((current) => toggleId(current, part.id))}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <ChevronRight aria-hidden="true" className={cn('size-3 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
                      <span className="truncate text-xs text-foreground">{part.label}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-[11px] text-muted-foreground">{tokensOf(part).toLocaleString()}</span>
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1">
                      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-sm', affectToneClass[tone].split(' ')[0])} />
                      <span className="truncate text-xs text-foreground">{part.label}</span>
                      {part.locked ? <span aria-label="locked" className="text-[10px] text-muted-foreground">locked</span> : null}
                      <span className="ml-auto shrink-0 tabular-nums text-[11px] text-muted-foreground">{tokensOf(part).toLocaleString()}</span>
                    </div>
                  )}
                  {part.compact && !compacted.has(part.id) ? (
                    <button
                      type="button"
                      aria-label={`Compact ${part.label}`}
                      onClick={() => void compact(part.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[11px] text-foreground hover:bg-accent"
                    >
                      <Sparkles aria-hidden="true" className="size-3" /> Compact
                    </button>
                  ) : null}
                </div>
                {items.length && expanded ? (
                  <ul role="list" className="ml-5 space-y-0.5 py-0.5">
                    {items.map((item) => removed.has(item.id) ? null : (
                      <li key={item.id} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-[11px]">
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
                        <span className="tabular-nums text-muted-foreground">{item.tokens?.toLocaleString() ?? '—'}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${item.label}`}
                          onClick={() => remove(part.id, item.id)}
                          className="rounded px-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="space-y-1.5 border-t border-border pt-2">
          <AffectMeter value={used} max={limit} tone={full ? 'danger' : warn ? 'warning' : 'primary'} label="Context usage" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">{used.toLocaleString()} / {limit.toLocaleString()} tokens</span>
            <AffectToneBadge tone={full ? 'danger' : warn ? 'warning' : 'success'}>{Math.round(ratio * 100)}% used</AffectToneBadge>
          </div>
          <p aria-live="polite" className="text-[11px] text-muted-foreground">
            {full ? 'Window full — remove files or compact to make room.' : warn ? `${(limit - used).toLocaleString()} tokens left.` : 'Plenty of room left.'}
          </p>
        </div>
      </AffectSurface>
    </div>
  )
}
