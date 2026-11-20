import { ArrowRight, CornerDownRight, Flag } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared'

export type DecisionFlag = { text: string; note?: string; source?: string }
export type DecisionText = string | Array<string | DecisionFlag>
export interface DecisionOption { label: string; effects?: DecisionText[]; pick?: boolean }
export interface Decision {
  id: string
  question: string
  context?: string
  agent: string
  model?: string
  icon?: ReactNode
  risk?: 'high' | 'medium' | 'low'
  options: DecisionOption[]
}
export type TreeChoice = { index: number; option: DecisionOption } | { other: string }

export interface DecisionTreeProps {
  decisions: Decision[]
  onChoose?: (decision: Decision, choice: TreeChoice) => string | void | Promise<string | void>
  allowOther?: boolean
  title?: string
  className?: string
}

function renderText(text: DecisionText, onFlag: (note: string) => void): ReactNode {
  if (typeof text === 'string') return text
  return text.map((part, index) => {
    if (typeof part === 'string') return <span key={index}>{part}</span>
    if (!part.note) return <span key={index}>{part.text}</span>
    return (
      <button
        key={index}
        type="button"
        aria-label={`Flag: ${part.text}. ${part.note}`}
        onFocus={() => onFlag(part.note ?? '')}
        onMouseEnter={() => onFlag(part.note ?? '')}
        className="rounded-sm border-b border-dashed border-warning text-warning underline-offset-2"
      >
        {part.text}
      </button>
    )
  })
}

/** An agent's fork laid out as a tree of options and consequences. */
export function DecisionTree({
  decisions,
  onChoose,
  allowOther = true,
  title = 'Decisions',
  className
}: DecisionTreeProps) {
  const [index, setIndex] = useState(0)
  const [focused, setFocused] = useState(0)
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')

  const decision = decisions[Math.min(index, Math.max(0, decisions.length - 1))]
  const options = decision?.options ?? []

  const choose = async (choice: TreeChoice, description: string) => {
    if (!decision) return
    const result = await onChoose?.(decision, choice)
    if ('other' in choice && typeof result === 'string') setAnswer(result)
    setAnnounce(`${description}.`)
    setOtherOpen(false); setOtherText(''); setNote(null)
    setIndex((current) => Math.min(current + 1, decisions.length - 1))
    setFocused(0)
  }
  const nextFlag = () => {
    if (!decision) return
    const notes: string[] = []
    decision.options.forEach((option) => (option.effects ?? []).forEach((effect) => {
      if (typeof effect !== 'string') effect.forEach((part) => { if (typeof part !== 'string' && part.note) notes.push(part.note ?? '') })
    }))
    if (notes.length) setNote(notes[Math.min(focused, notes.length - 1)])
  }
  const go = (delta: number) => { setIndex((current) => Math.min(Math.max(0, current + delta), decisions.length - 1)); setFocused(0); setAnswer(null) }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (event.key === 'Escape') { event.preventDefault(); setOtherOpen(false); setNote(null); return }
    if (target.tagName === 'TEXTAREA') return
    if (/^[1-9]$/.test(event.key)) {
      const position = Number(event.key) - 1
      if (position < options.length) { event.preventDefault(); void choose({ index: position, option: options[position] }, options[position].label) }
      else if (allowOther) { event.preventDefault(); setOtherOpen(true) }
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'j') { event.preventDefault(); go(1) }
    else if (event.key === 'ArrowLeft' || event.key === 'k') { event.preventDefault(); go(-1) }
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); nextFlag() }
  }

  if (!decisions.length) return null

  return (
    <div data-slot="decision-tree" onKeyDown={onKeyDown} className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          description={decision ? `Waiting on ${decision.agent}` : undefined}
          actions={<span className="text-[11px] tabular-nums text-muted-foreground">{Math.min(index + 1, decisions.length)} / {decisions.length}</span>}
        />
        {decision ? (
          <div className="mt-3">
            <div className="rounded-md bg-muted p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{decision.question}</span>
                {decision.risk && decision.risk !== 'low' ? <AffectToneBadge tone={decision.risk === 'high' ? 'danger' : 'warning'}>{decision.risk} risk</AffectToneBadge> : null}
                {decision.model ? <span className="text-[11px] text-muted-foreground">{decision.model}</span> : null}
              </div>
              {decision.context ? <p className="mt-1 text-[11px] text-muted-foreground">{decision.context}</p> : null}
            </div>

            <div className="mt-2 space-y-1.5">
              {options.map((option, position) => (
                <button
                  key={`${option.label}-${position}`}
                  type="button"
                  aria-keyshortcuts={String(position + 1)}
                  onFocus={() => setFocused(position)}
                  onClick={() => void choose({ index: position, option }, option.label)}
                  className={cn('flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors', focused === position ? 'border-border bg-accent' : 'border-transparent hover:bg-muted/60')}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-[9px] text-muted-foreground">{position + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <CornerDownRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{option.label}</span>
                      {option.pick ? <AffectToneBadge tone="info">Agent's pick</AffectToneBadge> : null}
                    </span>
                    {(option.effects ?? []).length ? (
                      <span className="mt-1 block space-y-0.5 pl-5 text-[11px] text-muted-foreground">
                        {option.effects!.map((effect, i) => <span key={i} className="block">{renderText(effect, setNote)}</span>)}
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight aria-hidden="true" className="mt-1 size-3 shrink-0 text-muted-foreground" />
                </button>
              ))}

              {answer ? (
                <div className="ml-6 rounded-md border border-info bg-info-subtle p-2 text-[11px] text-info"><span className="font-medium">Agent: </span>{answer}</div>
              ) : null}

              {allowOther ? (
                otherOpen ? (
                  <div className="ml-6 rounded-md border border-border p-2">
                    <textarea
                      autoFocus
                      aria-label="Your instruction"
                      placeholder="Tell the agent what to do…"
                      rows={2}
                      value={otherText}
                      onChange={(event) => setOtherText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          if (otherText.trim()) void choose({ other: otherText.trim() }, 'Instruction sent')
                        }
                      }}
                      className="w-full resize-none rounded-md border border-border bg-background p-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                    <div className="mt-1 flex justify-end gap-2">
                      <button type="button" onClick={() => setOtherOpen(false)} className="text-[11px] text-muted-foreground">Cancel</button>
                      <button type="button" disabled={!otherText.trim()} onClick={() => void choose({ other: otherText.trim() }, 'Instruction sent')} className="rounded bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-40">Send</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setOtherOpen(true)} className="ml-6 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60"><Flag aria-hidden="true" className="size-3" />Other…</button>
                )
              ) : null}
            </div>
          </div>
        ) : null}
        {note ? <div role="tooltip" className="mt-2 rounded-md border border-warning bg-warning-subtle p-2 text-[11px] text-warning-subtle-foreground">{note}</div> : null}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
