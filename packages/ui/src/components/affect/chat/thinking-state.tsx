import { Check, ChevronDown, LoaderCircle, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectStatusDot } from '../shared'

export interface ThinkingSource {
  label: string
  href?: string
}

export interface ThinkingStep {
  kind?: 'search' | 'step'
  label: string
  sources?: ThinkingSource[]
  moreSources?: number
}

export interface ThinkingStateProps {
  steps?: ThinkingStep[]
  doneLabel?: string
  stepMs?: number
  loop?: boolean
  onDone?: (seconds: number) => void
  className?: string
}

/** Working panel that reveals search and thinking steps in order with a live timer. */
export function ThinkingState({
  steps = [],
  doneLabel = 'Finished thinking',
  stepMs = 1300,
  loop = false,
  onDone,
  className
}: ThinkingStateProps) {
  const [visible, setVisible] = useState(1)
  const [expanded, setExpanded] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [showAllSources, setShowAllSources] = useState(false)
  const secondsRef = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const finished = visible >= steps.length

  useEffect(() => {
    const started = Date.now()
    const id = window.setInterval(() => {
      secondsRef.current = Math.floor((Date.now() - started) / 1000)
      setSeconds(secondsRef.current)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (finished) {
      doneRef.current?.(secondsRef.current)
      return
    }
    const id = window.setTimeout(() => setVisible((count) => count + 1), stepMs)
    return () => window.clearTimeout(id)
  }, [finished, stepMs])

  useEffect(() => {
    if (!loop || !finished) return
    const id = window.setTimeout(() => setVisible(1), stepMs * 3)
    return () => window.clearTimeout(id)
  }, [loop, finished, stepMs])

  return (
    <div data-slot="thinking-state" className={cn('w-full max-w-md rounded-lg border border-border bg-card p-3', className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AffectStatusDot status={finished ? 'done' : 'running'} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {finished ? doneLabel : 'Thinking…'}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">{seconds}s</span>
        <ChevronDown aria-hidden="true" className={cn('size-3.5 text-muted-foreground transition-transform', !expanded && '-rotate-90')} />
      </button>
      {expanded ? (
        <ul aria-live="polite" className="mt-3 space-y-2 border-l border-border pl-3">
          {steps.slice(0, visible).map((step, index) => (
            <li key={index} className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs text-foreground">
                {step.kind === 'search' ? (
                  <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                ) : finished ? (
                  <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" />
                ) : (
                  <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}
                {step.label}
              </span>
              {step.sources?.length ? (
                <span className="flex flex-wrap items-center gap-1 pl-5">
                  {step.sources.slice(0, showAllSources ? undefined : 3).map((source, sourceIndex) =>
                    source.href ? (
                      <a
                        key={sourceIndex}
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        title={source.label}
                        className="max-w-32 truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {source.label}
                      </a>
                    ) : (
                      <span key={sourceIndex} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {source.label}
                      </span>
                    )
                  )}
                  {!showAllSources && step.moreSources ? (
                    <button
                      type="button"
                      onClick={() => setShowAllSources(true)}
                      className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      +{step.moreSources} more
                    </button>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
          {finished ? (
            <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check aria-hidden="true" className="size-3.5 text-success" />
              {doneLabel}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
