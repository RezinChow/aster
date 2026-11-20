import { Check, ChevronDown, CircleHelp } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty } from '../shared'

export type DecisionAnswer = 'primary' | 'secondary'

export interface Decision {
  id: string
  title: string
  detail?: string
  primary: string
  secondary: string
  collapsed?: boolean
}

export interface DecisionInboxProps {
  decisions: Decision[]
  onDecide?: (decision: Decision, answer: DecisionAnswer) => void
  className?: string
}

/** Open decisions with two quick answers; answered ones confirm and fold away. */
export function DecisionInbox({ decisions, onDecide, className }: DecisionInboxProps) {
  const [answers, setAnswers] = useState<Record<string, DecisionAnswer>>({})
  const [folded, setFolded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(decisions.filter((d) => d.collapsed).map((d) => [d.id, true]))
  )
  const open = decisions.filter((decision) => !answers[decision.id])
  const answered = decisions.filter((decision) => answers[decision.id])

  const decide = (decision: Decision, answer: DecisionAnswer) => {
    setAnswers((current) => ({ ...current, [decision.id]: answer }))
    onDecide?.(decision, answer)
  }

  return (
    <div
      data-slot="decision-inbox"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
        Decisions {open.length ? <span className="ml-1 text-muted-foreground">· {open.length} open</span> : null}
      </div>
      <div className="divide-y divide-border" aria-live="polite">
        {decisions.length === 0 ? <AffectEmpty className="m-2">Nothing to decide</AffectEmpty> : null}
        {open.map((decision) => {
          const isFolded = folded[decision.id]
          return (
            <div key={decision.id} className="px-3 py-2.5">
              <button
                type="button"
                aria-expanded={!isFolded}
                onClick={() => setFolded((current) => ({ ...current, [decision.id]: !isFolded }))}
                className="flex w-full items-start gap-2 text-left"
              >
                <CircleHelp aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-foreground">{decision.title}</span>
                  {decision.detail ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{decision.detail}</span> : null}
                </span>
                <ChevronDown aria-hidden="true" className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', isFolded && '-rotate-90')} />
              </button>
              {!isFolded ? (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                  <button
                    type="button"
                    onClick={() => decide(decision, 'primary')}
                    className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {decision.primary}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(decision, 'secondary')}
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-muted"
                  >
                    {decision.secondary}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}
        {answered.map((decision) => (
          <div key={decision.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground">
            <Check aria-hidden="true" className="size-3 shrink-0 text-success" />
            <span className="min-w-0 flex-1 truncate">{decision.title}</span>
            <span className="shrink-0">{decision[answers[decision.id] ?? 'primary']}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
