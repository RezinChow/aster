import { Check, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface Tip {
  id: string
  title: string
  description: ReactNode
  action: string
  doneLabel?: string
  primary?: boolean
  onAction?: () => void
}

export interface TipsPanelProps {
  tips: Tip[]
  title?: string
  onClose?: () => void
  closeLabel?: string
  className?: string
}

/** Grid of short tips whose actions turn each card into a done state. */
export function TipsPanel({
  tips,
  title = 'Tips',
  onClose,
  closeLabel = 'Close',
  className
}: TipsPanelProps) {
  const [done, setDone] = useState<Set<string>>(() => new Set())
  const take = (tip: Tip) => {
    tip.onAction?.()
    setDone((current) => new Set(current).add(tip.id))
  }

  return (
    <div data-slot="tips-panel" className={cn('w-full rounded-lg bg-muted p-2', className)}>
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-medium text-foreground">
          {title} <span role="status" className="ml-1 text-[11px] font-normal text-muted-foreground" aria-live="polite">{done.size}/{tips.length}</span>
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tips.map((tip) => {
          const isDone = done.has(tip.id)
          return (
            <li key={tip.id} className={cn('flex flex-col rounded-lg border border-border bg-card p-3', isDone && 'opacity-70')}>
              <span className="text-xs font-medium text-foreground">{tip.title}</span>
              <span className="mt-1 flex-1 text-[11px] leading-relaxed text-muted-foreground">{tip.description}</span>
              <button
                type="button"
                disabled={isDone}
                onClick={() => take(tip)}
                className={cn(
                  'mt-2 inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-[11px] disabled:cursor-default',
                  isDone
                    ? 'bg-success-subtle text-success-subtle-foreground'
                    : tip.primary
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-muted'
                )}
              >
                {isDone ? <Check aria-hidden="true" className="size-3" /> : null}
                {isDone ? (tip.doneLabel ?? 'Done') : tip.action}
              </button>
            </li>
          )
        })}
      </ul>
      {onClose ? (
        <div className="flex justify-end border-t border-border pt-2">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-background hover:text-foreground">
            <X aria-hidden="true" className="size-3" />{closeLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
