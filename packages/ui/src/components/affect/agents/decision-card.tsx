import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface, AffectToneBadge } from '../shared'

export interface DecisionOption {
  id: string
  title: string
  summary?: string
  recommended?: boolean
  preview?: ReactNode
  blocks?: string
}

export interface DecisionFact { label: string; value: ReactNode }

export interface Decision {
  id: string
  question: string
  task?: string
  kind?: 'decision' | 'pick' | 'approval'
  options?: DecisionOption[]
  facts?: DecisionFact[]
}

export type DecisionAnswer = { option: string } | { text: string } | 'approve' | 'decline'

export interface DecisionCardLabels {
  needsYou: string
  later: string
  show: string
  recommended: string
  approve: string
  decline: string
  own: string
  waiting: (n: number) => string
  of: (i: number, n: number) => string
}

export interface DecisionCardProps {
  decisions: Decision[]
  onDecide?: (id: string, answer: DecisionAnswer) => void
  onLater?: (id: string) => void
  defaultFolded?: boolean
  reveal?: number
  labels?: Partial<DecisionCardLabels>
  className?: string
}

const defaultLabels: DecisionCardLabels = {
  needsYou: 'Needs you',
  later: 'Later',
  show: 'Show',
  recommended: 'Recommended',
  approve: 'Approve',
  decline: 'Decline',
  own: 'Or write your own…',
  waiting: (n) => `${n} decision${n === 1 ? '' : 's'} waiting`,
  of: (i, n) => `${i} of ${n}`
}

/** A single agent question above the composer, with keyboard answers. */
export function DecisionCard({
  decisions,
  onDecide,
  onLater,
  defaultFolded = false,
  reveal,
  labels,
  className
}: DecisionCardProps) {
  const [folded, setFolded] = useState(defaultFolded)
  const [index, setIndex] = useState(0)
  const [focused, setFocused] = useState(0)
  const [ownText, setOwnText] = useState('')
  const [announce, setAnnounce] = useState('')
  const [pulse, setPulse] = useState(false)
  const text = { ...defaultLabels, ...labels }

  useEffect(() => {
    if (reveal === undefined) return
    setFolded(false)
    setPulse(true)
    const timer = setTimeout(() => setPulse(false), 400)
    return () => clearTimeout(timer)
  }, [reveal])

  const decision = decisions[Math.min(index, Math.max(0, decisions.length - 1))]
  const kind = decision?.kind ?? 'decision'
  const options = decision?.options ?? []
  const isPick = kind === 'pick'

  const advance = () => {
    setFocused(0)
    setOwnText('')
    setIndex((current) => (decisions.length > 1 ? Math.min(current + 1, decisions.length - 1) : current))
  }
  const answer = (value: DecisionAnswer, description: string) => {
    if (!decision) return
    onDecide?.(decision.id, value)
    setAnnounce(`${description}. ${Math.max(0, decisions.length - 1)} still waiting.`)
    advance()
  }
  const later = () => {
    if (!decision) return
    onLater?.(decision.id)
    setAnnounce(`${text.later}.`)
    setFolded(true)
  }
  const move = (delta: number) => {
    if (!options.length) return
    setFocused((current) => (current + delta + options.length) % options.length)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (event.key === 'Escape') { event.preventDefault(); later(); return }
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return
    if (/^[1-5]$/.test(event.key)) {
      const position = Number(event.key) - 1
      if (kind === 'approval') { event.preventDefault(); answer(position === 0 ? 'approve' : 'decline', text[position === 0 ? 'approve' : 'decline']); return }
      const option = options[position]
      if (option) { event.preventDefault(); answer({ option: option.id }, option.title) }
    }
  }

  if (!decisions.length) return null

  if (folded) {
    return (
      <div data-slot="decision-card" className={cn('w-full', className)}>
        <button
          type="button"
          onClick={() => { setFolded(false); setAnnounce(text.needsYou) }}
          className="flex w-full items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-left text-xs text-foreground hover:bg-accent"
        >
          <span>{text.waiting(decisions.length)}</span>
          <span className="inline-flex items-center gap-1 text-primary">{text.show}<ChevronRight aria-hidden="true" className="size-3" /></span>
        </button>
      </div>
    )
  }

  return (
    <div data-slot="decision-card" role="group" aria-label={decision.question} onKeyDown={onKeyDown} className={cn('w-full', pulse && 'animate-pulse', className)}>
      <AffectSurface className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 bg-muted px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <AffectToneBadge tone="warning">{text.needsYou}</AffectToneBadge>
            {decision.task ? <span className="truncate text-[11px] text-muted-foreground">{decision.task}</span> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {decisions.length > 1 ? (
              <>
                <button type="button" aria-label="Previous decision" onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFocused(0) }} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><ChevronLeft aria-hidden="true" className="size-3.5" /></button>
                <span className="text-[11px] tabular-nums text-muted-foreground">{text.of(index + 1, decisions.length)}</span>
                <button type="button" aria-label="Next decision" onClick={() => { setIndex((i) => Math.min(decisions.length - 1, i + 1)); setFocused(0) }} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><ChevronRight aria-hidden="true" className="size-3.5" /></button>
              </>
            ) : null}
            <button type="button" onClick={later} className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground">{text.later}</button>
          </div>
        </div>

        <div className="space-y-2.5 p-3">
          <p className="text-sm font-medium text-foreground">{decision.question}</p>

          {kind === 'approval' ? (
            <div className="space-y-2">
              {(decision.facts ?? []).map((fact) => (
                <div key={fact.label} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{fact.label}</span><span className="font-medium text-foreground">{fact.value}</span>
                </div>
              ))}
              <div className="flex gap-2">
                <button type="button" aria-keyshortcuts="1" onClick={() => answer('approve', text.approve)} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">{text.approve}</button>
                <button type="button" aria-keyshortcuts="2" onClick={() => answer('decline', text.decline)} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted">{text.decline}</button>
              </div>
            </div>
          ) : (
            <>
              <div role="listbox" aria-label={decision.question} className={cn('gap-1.5', isPick ? 'grid grid-cols-2' : 'space-y-1')}>
                {options.map((option, position) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={focused === position}
                    aria-keyshortcuts={String(position + 1)}
                    tabIndex={focused === position ? 0 : -1}
                    onFocus={() => setFocused(position)}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); move(1) }
                      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); move(-1) }
                      else if (event.key === 'Home') { event.preventDefault(); setFocused(0) }
                      else if (event.key === 'End') { event.preventDefault(); setFocused(options.length - 1) }
                      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); answer({ option: option.id }, option.title) }
                    }}
                    onClick={() => answer({ option: option.id }, option.title)}
                    className={cn('flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors', focused === position ? 'border-border bg-accent' : 'border-transparent hover:bg-muted/60')}
                  >
                    {isPick && option.preview ? <span className="shrink-0 rounded bg-muted p-1">{option.preview}</span> : <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-[9px] text-muted-foreground">{position + 1}</span>}
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-foreground">{option.title}</span>
                        {option.recommended ? <AffectToneBadge tone="success">{text.recommended}</AffectToneBadge> : null}
                      </span>
                      {option.summary ? <span className="block truncate text-[11px] text-muted-foreground">{option.summary}</span> : null}
                      {option.blocks ? <span className="block text-[10px] text-warning">{option.blocks}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-2">
                <textarea
                  aria-label={text.own}
                  placeholder={text.own}
                  rows={1}
                  value={ownText}
                  onChange={(event) => setOwnText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (ownText.trim()) answer({ text: ownText.trim() }, text.own) } }}
                  className="min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring"
                />
                <button type="button" disabled={!ownText.trim()} onClick={() => answer({ text: ownText.trim() }, text.own)} className="rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-40">Send</button>
              </div>
            </>
          )}
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
