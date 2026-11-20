import { Check, ChevronDown, Copy, LoaderCircle, RotateCcw, Wrench, X } from 'lucide-react'
import { isValidElement, useEffect, useState, type ReactElement, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface, formatDuration } from '../shared'

export type ToolCallStatus = 'running' | 'success' | 'error'
export interface ToolCallCardProps {
  name: string
  status: ToolCallStatus
  summary?: ReactNode
  icon?: ReactNode
  args?: unknown
  result?: unknown
  error?: string
  startedAt?: number
  duration?: number
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  openOnError?: boolean
  onRetry?: () => void
  maxCodeHeight?: number
  className?: string
}

function printable(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string') {
    try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
  }
  return JSON.stringify(value, null, 2) ?? String(value)
}

/** One agent tool call in a line, folding open to arguments and result. */
export function ToolCallCard({
  name,
  status,
  summary,
  icon,
  args,
  result,
  error,
  startedAt,
  duration,
  defaultOpen = false,
  open,
  onOpenChange,
  openOnError = true,
  onRetry,
  maxCodeHeight = 220,
  className
}: ToolCallCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [manual, setManual] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [tick, setTick] = useState(Date.now())
  const started = useState(() => Date.now())[0]
  const isOpen = open ?? internalOpen

  useEffect(() => {
    if (manual || open !== undefined) return
    if (status === 'error' && openOnError) setInternalOpen(true)
    else if (status === 'running') setInternalOpen(false)
  }, [status, openOnError, manual, open])
  useEffect(() => {
    if (status !== 'running' || duration !== undefined) return
    const timer = setInterval(() => setTick(Date.now()), 250)
    return () => clearInterval(timer)
  }, [status, duration])

  const elapsed = duration ?? (startedAt ? Math.max(0, tick - startedAt) : Math.max(0, tick - started))
  const toggle = () => { setManual(true); const next = !isOpen; setInternalOpen(next); onOpenChange?.(next) }
  const copy = async (label: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(() => setCopied(null), 1500) } catch { setCopied(null) }
  }
  const code = (label: 'arguments' | 'result', value: string) => (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <button type="button" aria-label={`Copy ${label}`} onClick={() => void copy(label, value)} className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground">
          {copied === label ? <Check aria-hidden="true" className="size-3 text-success" /> : <Copy aria-hidden="true" className="size-3" />}{copied === label ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className={cn('overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[10px] text-foreground', !showAll && 'max-h-56')} style={showAll ? undefined : { maxHeight: Math.min(maxCodeHeight, 224) }}>{value}</pre>
    </div>
  )

  return (
    <div data-slot="tool-call-card" className={cn('w-full', className)}>
      <AffectSurface className="overflow-hidden">
        <button type="button" aria-expanded={isOpen} aria-controls={`tool-body-${name}`} onClick={toggle} className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/60">
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">{icon ?? <Wrench aria-hidden="true" className="size-3" />}</span>
          <span className="shrink-0 font-mono text-[11px] text-foreground">{name}</span>
          {summary ? <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{summary}</span> : <span className="flex-1" />}
          <span className="flex shrink-0 items-center gap-1.5">
            {status === 'running' ? <><LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-info" /><span className="text-[10px] tabular-nums text-muted-foreground">{formatDuration(elapsed)}</span></> : status === 'error' ? <><X aria-hidden="true" className="size-3.5 text-destructive" /><span className="text-[10px] text-destructive">Failed</span></> : <><Check aria-hidden="true" className="size-3.5 text-success" /><span className="text-[10px] tabular-nums text-muted-foreground">{formatDuration(elapsed)}</span></>}
            <ChevronDown aria-hidden="true" className={cn('size-3 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
          </span>
        </button>
        {isOpen ? (
          <div id={`tool-body-${name}`} className="space-y-2 border-t border-border p-2.5">
            {error ? <p className="rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p> : null}
            {args !== undefined ? code('arguments', printable(args)) : null}
            {result !== undefined ? code('result', printable(result)) : status === 'running' ? <p className="text-[11px] text-muted-foreground">Waiting for result…</p> : null}
            {showAll || (printable(args).length + printable(result).length) <= maxCodeHeight ? null : <button type="button" onClick={() => setShowAll(true)} className="text-[10px] text-info hover:underline">Show all</button>}
            {status === 'error' && onRetry ? <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"><RotateCcw aria-hidden="true" className="size-3" />Retry</button> : null}
          </div>
        ) : null}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{`${name} ${status}`}</p>
    </div>
  )
}

export interface ToolCallGroupProps {
  children: ReactNode
  label?: string
  runningLabel?: string
  duration?: number
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

/** A group that sums its tool cards into one header. */
export function ToolCallGroup({
  children,
  label = 'Used N tools',
  runningLabel = 'Using tools…',
  duration,
  defaultOpen = false,
  open,
  onOpenChange,
  className
}: ToolCallGroupProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = open ?? internalOpen
  const cards = (Array.isArray(children) ? children : [children]).filter((child): child is ReactElement<ToolCallCardProps> => isValidElement<ToolCallCardProps>(child))
  const count = cards.length
  const anyRunning = cards.some((card) => card.props.status === 'running')
  const total = duration ?? cards.reduce((sum, card) => sum + (card.props.duration ?? 0), 0)

  return (
    <div data-slot="tool-call-group" className={cn('w-full space-y-1', className)}>
      <button type="button" aria-expanded={isOpen} onClick={() => { const next = !isOpen; setInternalOpen(next); onOpenChange?.(next) }} className="flex w-full items-center gap-2 px-1 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground">
        <Wrench aria-hidden="true" className="size-3.5" />
        <span className="min-w-0 flex-1 truncate">{anyRunning ? runningLabel : label.replace('N', String(count))}</span>
        <ChevronDown aria-hidden="true" className={cn('size-3 transition-transform', isOpen && 'rotate-180')} />
        <span className="tabular-nums">{formatDuration(total)}</span>
      </button>
      {isOpen ? <div className="space-y-1">{children}</div> : null}
      <p aria-live="polite" className="sr-only">{anyRunning ? runningLabel : label.replace('N', String(count))}</p>
    </div>
  )
}
