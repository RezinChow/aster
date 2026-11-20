import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../../../lib/utils'

export interface ThinkingLoaderProps {
  phases?: string[]
  interval?: number
  phase?: number
  loop?: boolean
  done?: boolean
  doneLabel?: string | ((seconds: number) => string)
  size?: 'sm' | 'md'
  variant?: 'pill' | 'plain'
  className?: string
}

const defaultPhases = ['Thinking', 'Searching the web', 'Reading sources', 'Writing response']

function Rays() {
  return (
    <span aria-hidden="true" className="relative inline-block size-4 shrink-0 animate-spin">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 h-1 w-0.5 rounded-full bg-current"
          style={{
            opacity: 0.25 + index * 0.09,
            transform: `translate(-50%, -50%) rotate(${index * 45}deg) translateY(-5px)`
          }}
        />
      ))}
    </span>
  )
}

/** One-line working pill that walks through phases and settles on a check. */
export function ThinkingLoader({
  phases = defaultPhases,
  interval = 2200,
  phase,
  loop = false,
  done = false,
  doneLabel,
  size = 'md',
  variant = 'pill',
  className
}: ThinkingLoaderProps) {
  const [index, setIndex] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const started = useRef(Date.now())
  const controlled = phase !== undefined
  const active = controlled ? Math.max(0, Math.min(phase, phases.length - 1)) : index

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (controlled || done) return
    const id = window.setInterval(() => {
      setIndex((current) => (current >= phases.length - 1 ? (loop ? 0 : current) : current + 1))
    }, interval)
    return () => window.clearInterval(id)
  }, [controlled, done, interval, loop, phases.length])

  const label = done
    ? typeof doneLabel === 'function'
      ? doneLabel(seconds)
      : (doneLabel ?? `Thought for ${seconds}s`)
    : (phases[active] ?? phases[0])

  return (
    <div
      data-slot="thinking-loader"
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 text-xs text-muted-foreground',
        variant === 'pill' && 'rounded-full border border-border bg-card px-2.5',
        size === 'sm' ? 'h-7' : 'h-9',
        className
      )}
    >
      {done ? (
        <Check aria-hidden="true" className="size-4 shrink-0 text-success" />
      ) : (
        <Rays />
      )}
      <span key={done ? 'done' : active} className={cn('truncate', !done && 'animate-pulse')}>
        {label}
      </span>
    </div>
  )
}
