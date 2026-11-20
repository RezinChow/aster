import { Check, ChevronDown, Sparkles, Undo2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'

export interface Recommendation {
  id: string
  label: string
  reason: string
  signal: number
}

export interface SmartRecommendationProps {
  options: Recommendation[]
  onAccept?: (option: Recommendation) => void
  onUndo?: (option: Recommendation) => void
  defaultOpen?: boolean
  title?: string
  className?: string
}

const signalWords = ['No signal', 'Low confidence', 'Good confidence', 'Strong confidence']

function Signal({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={signalWords[Math.max(0, Math.min(3, value))]}>
      {[1, 2, 3].map((level) => (
        <span key={level} className={cn('h-1.5 w-3 rounded-full', level <= value ? 'bg-primary' : 'bg-muted')} />
      ))}
      <span className="ml-0.5 text-[10px] text-muted-foreground">{signalWords[Math.max(0, Math.min(3, value))]}</span>
    </span>
  )
}

/** Suggestion card with a confidence signal, alternatives and accept with undo. */
export function SmartRecommendation({
  options,
  onAccept,
  onUndo,
  defaultOpen = true,
  title = 'Smart recommendation',
  className
}: SmartRecommendationProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [alternativesOpen, setAlternativesOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? '')
  const [accepted, setAccepted] = useState<Recommendation | null>(null)
  const selected = options.find((item) => item.id === selectedId) ?? options[0]
  if (!selected) return null

  const accept = () => {
    setAccepted(selected)
    onAccept?.(selected)
  }
  const undo = () => {
    if (!accepted) return
    onUndo?.(accepted)
    setAccepted(null)
  }

  return (
    <div data-slot="smart-recommendation" className={cn('w-full max-w-sm rounded-lg border border-border bg-card p-3', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sparkles aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="flex-1 text-xs font-medium text-foreground">{title}</span>
        <Signal value={selected.signal} />
        <ChevronDown aria-hidden="true" className={cn('size-3.5 text-muted-foreground transition-transform', !open && '-rotate-90')} />
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-foreground">{selected.label}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{selected.reason}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={accepted?.id === selected.id}
              onClick={accept}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
            >
              <Check aria-hidden="true" className="size-3" />Accept
            </button>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={alternativesOpen}
                onClick={() => setAlternativesOpen((value) => !value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setAlternativesOpen(false)
                }}
                className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Alternatives ({options.length - 1})
              </button>
              {alternativesOpen ? (
                <div role="menu" aria-label="Alternatives" className="absolute z-20 mt-1 w-48 rounded-md border border-border bg-card p-1 shadow-lg">
                  {options.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={item.id === selectedId}
                      onClick={() => { setSelectedId(item.id); setAlternativesOpen(false) }}
                      className={cn('block w-full rounded px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted', item.id === selectedId && 'bg-accent')}
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{item.reason}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          {accepted ? (
            <div role="status" className="flex items-center gap-2 rounded-md bg-success-subtle px-2 py-1.5 text-[11px] text-success-subtle-foreground">
              <Check aria-hidden="true" className="size-3.5" />
              Accepted {accepted.label}
              <button type="button" onClick={undo} className="ml-auto inline-flex items-center gap-1 hover:underline">
                <Undo2 aria-hidden="true" className="size-3" />Undo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
