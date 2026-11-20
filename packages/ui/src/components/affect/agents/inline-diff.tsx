import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface } from '../shared'

export type DiffSegment = { type: 'equal'; text: string } | { type: 'change'; remove: string; insert: string }
type Decision = 'pending' | 'accepted' | 'rejected'

export interface InlineDiffProps {
  original?: string
  suggested?: string
  changes?: DiffSegment[]
  onChange?: (text: string) => void
  onDone?: (text: string) => void
  label?: string
  className?: string
}

function wordDiff(original: string, suggested: string): DiffSegment[] {
  const a = original.split(/\s+/).filter(Boolean)
  const b = suggested.split(/\s+/).filter(Boolean)
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const raw: DiffSegment[] = []
  let i = 0; let j = 0; let equal: string[] = []
  const flush = () => { if (equal.length) { raw.push({ type: 'equal', text: equal.join(' ') }); equal = [] } }
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { equal.push(a[i]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { flush(); raw.push({ type: 'change', remove: a[i], insert: '' }); i++ }
    else { flush(); raw.push({ type: 'change', remove: '', insert: b[j] }); j++ }
  }
  while (i < a.length) { flush(); raw.push({ type: 'change', remove: a[i++], insert: '' }) }
  while (j < b.length) { flush(); raw.push({ type: 'change', remove: '', insert: b[j++] }) }
  flush()
  const merged: DiffSegment[] = []
  raw.forEach((segment) => {
    if (segment.type === 'change' && merged.length && merged[merged.length - 1].type === 'change') {
      const previous = merged[merged.length - 1] as { type: 'change'; remove: string; insert: string }
      previous.remove = [previous.remove, segment.remove].filter(Boolean).join(' ')
      previous.insert = [previous.insert, segment.insert].filter(Boolean).join(' ')
    } else merged.push(segment)
  })
  return merged
}

/** Word-by-word AI edits to prose, accepted or rejected one by one. */
export function InlineDiff({ original = '', suggested = '', changes, onChange, onDone, label, className }: InlineDiffProps) {
  const segments = changes ?? wordDiff(original, suggested)
  const changeCount = segments.filter((segment) => segment.type === 'change').length
  const [decisions, setDecisions] = useState<Decision[]>(() => Array(changeCount).fill('pending'))
  const [history, setHistory] = useState<Decision[][]>([])
  const [highlight, setHighlight] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')

  const textFor = (values: Decision[]): string => {
    let changeIndex = -1
    return segments.map((segment) => {
      if (segment.type === 'equal') return segment.text
      changeIndex += 1
      const decision = values[changeIndex] ?? 'pending'
      return decision === 'accepted' ? segment.insert : segment.remove
    }).filter(Boolean).join(' ')
  }
  const pending = decisions.filter((decision) => decision === 'pending').length
  const decide = (index: number, value: Decision) => {
    setHistory((stack) => [...stack.slice(-19), decisions])
    const next = decisions.map((decision, i) => (i === index ? value : decision))
    setDecisions(next)
    const text = textFor(next)
    onChange?.(text)
    const remaining = next.filter((decision) => decision === 'pending').length
    setAnnounce(`${value === 'accepted' ? 'Accepted' : 'Rejected'} suggestion. ${remaining} left.`)
    if (remaining === 0) onDone?.(text)
    setHighlight((current) => (current === index ? null : current))
  }
  const step = (delta: number) => {
    if (!changeCount) return
    setHighlight((current) => (current === null ? (delta > 0 ? 0 : changeCount - 1) : (current + delta + changeCount) % changeCount))
  }
  const undo = () => {
    if (!history.length) return
    const previous = history[history.length - 1]
    setHistory((stack) => stack.slice(0, -1))
    setDecisions(previous)
    onChange?.(textFor(previous))
    setAnnounce('Undid last decision')
  }
  const decideAll = (value: 'accepted' | 'rejected') => {
    setHistory((stack) => [...stack.slice(-19), decisions])
    const next = decisions.map(() => value)
    setDecisions(next)
    onChange?.(textFor(next))
    onDone?.(textFor(next))
    setAnnounce(`${value === 'accepted' ? 'Accepted' : 'Rejected'} all suggestions`)
  }

  let changeIndex = -1
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key.toLowerCase() === 'y' || event.key === 'Enter') { event.preventDefault(); decide(index, 'accepted') }
    else if (event.key.toLowerCase() === 'n' || event.key === 'Backspace') { event.preventDefault(); decide(index, 'rejected') }
    else if (event.key === 'Escape') { event.preventDefault(); setHighlight(null) }
  }

  return (
    <div data-slot="inline-diff" className={cn('w-full', className)} onKeyDown={(event) => { if (event.key === 'Escape') setHighlight(null) }}>
      <AffectSurface className="overflow-hidden">
        {label ? <div className="border-b border-border bg-muted px-3 py-1.5 text-[11px] text-muted-foreground">{label}</div> : null}
        <div className="p-3">
          <div className="mb-2 flex items-center gap-1">
            <button type="button" aria-label="Previous suggestion" onClick={() => step(-1)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft aria-hidden="true" className="size-3.5" /></button>
            <button type="button" aria-label="Next suggestion" onClick={() => step(1)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowRight aria-hidden="true" className="size-3.5" /></button>
            <span className="mx-1 text-[10px] text-muted-foreground">{pending} pending</span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" disabled={!changeCount} onClick={() => decideAll('accepted')} className="rounded px-1.5 py-1 text-[10px] text-success hover:bg-success-subtle disabled:opacity-40">Accept all</button>
              <button type="button" disabled={!changeCount} onClick={() => decideAll('rejected')} className="rounded px-1.5 py-1 text-[10px] text-destructive hover:bg-destructive/10 disabled:opacity-40">Reject all</button>
              <button type="button" aria-label="Undo last decision" disabled={!history.length} onClick={undo} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"><RotateCcw aria-hidden="true" className="size-3.5" /></button>
            </div>
          </div>
          <p className="text-sm leading-7 text-foreground">
            {segments.map((segment, index) => {
              if (segment.type === 'equal') return <span key={index}>{segment.text}{' '}</span>
              changeIndex += 1
              const position = changeIndex
              const decision = decisions[position] ?? 'pending'
              const number = position + 1
              return (
                <span key={index} className="relative inline">
                  <button
                    type="button"
                    aria-label={`Suggestion ${number} of ${changeCount}: replace “${segment.remove}” with “${segment.insert}”. Press Y to accept, N to reject.`}
                    aria-expanded={highlight === position}
                    onClick={() => setHighlight((current) => (current === position ? null : position))}
                    onFocus={() => setHighlight(position)}
                    onKeyDown={(event) => onKeyDown(event, position)}
                    className={cn('rounded-sm px-0.5 outline-none focus-visible:ring-1 focus-visible:ring-ring', decision === 'pending' ? 'bg-warning-subtle' : decision === 'accepted' ? 'bg-success-subtle' : 'bg-muted', highlight === position && 'ring-1 ring-primary')}
                  >
                    {decision !== 'rejected' && segment.remove ? <del className="text-destructive line-through">{segment.remove}</del> : null}
                    {decision !== 'rejected' && segment.remove && segment.insert ? ' ' : null}
                    {decision !== 'pending' && segment.insert ? <ins className="text-success no-underline">{segment.insert}</ins> : null}
                    {decision === 'pending' ? <span className="sr-only">pending</span> : null}
                  </button>
                  {' '}
                  {highlight === position && decision === 'pending' ? (
                    <span role="group" aria-label={`Suggestion ${number} actions`} className="absolute left-0 top-full z-10 mt-1 flex gap-1 rounded-md border border-border bg-card p-1 shadow-md">
                      <button type="button" aria-label={`Accept suggestion ${number}`} onClick={() => decide(position, 'accepted')} className="inline-flex items-center gap-1 rounded bg-success-subtle px-1.5 py-0.5 text-[10px] text-success-subtle-foreground"><Check aria-hidden="true" className="size-3" />Y</button>
                      <button type="button" aria-label={`Reject suggestion ${number}`} onClick={() => decide(position, 'rejected')} className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive"><X aria-hidden="true" className="size-3" />N</button>
                    </span>
                  ) : null}
                </span>
              )
            })}
          </p>
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
