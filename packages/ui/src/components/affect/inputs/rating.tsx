import { Star, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export type RatingValue = number | 'up' | 'down' | null

export interface RatingProps {
  variant?: 'stars' | 'thumbs'
  value?: RatingValue
  defaultValue?: RatingValue
  onValueChange?: (value: RatingValue) => void
  max?: number
  allowClear?: boolean
  readOnly?: boolean
  disabled?: boolean
  size?: AffectSize
  getValueLabel?: (value: number, max: number) => string
  labels?: { up?: string; down?: string }
  name?: string
  'aria-label'?: string
  className?: string
}

const sizeClass: Record<AffectSize, string> = { sm: 'size-4', md: 'size-5', lg: 'size-6' }

/** Star or thumbs rating with hover preview, clear-on-reselect and a read-only average. */
export function Rating({
  variant = 'stars',
  value,
  defaultValue = null,
  onValueChange,
  max = 5,
  allowClear = true,
  readOnly = false,
  disabled = false,
  size = 'md',
  getValueLabel = (v, m) => `${v} out of ${m}`,
  labels = {},
  name,
  'aria-label': ariaLabel,
  className
}: RatingProps) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<RatingValue>(defaultValue)
  const [hover, setHover] = useState<number | null>(null)
  const current = isControlled ? value : internal

  const set = (next: RatingValue) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(next)
  }

  const chooseStar = (n: number) => set(current === n && allowClear ? null : n)

  if (readOnly) {
    const num = typeof current === 'number' ? current : 0
    const label = variant === 'stars' ? getValueLabel(num, max) : current === 'up' ? 'Good response' : current === 'down' ? 'Bad response' : 'No rating'
    return (
      <span data-slot="rating" role="img" aria-label={ariaLabel ?? label} className={cn('inline-flex items-center gap-0.5', className)}>
        {variant === 'stars'
          ? Array.from({ length: max }, (_, i) => {
              const fill = Math.min(1, Math.max(0, num - i))
              return (
                <span key={i} className={cn('relative inline-block', sizeClass[size])}>
                  <Star className={cn('absolute inset-0', sizeClass[size], 'text-muted-foreground')} />
                  <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                    <Star className={cn(sizeClass[size], 'fill-warning text-warning')} />
                  </span>
                </span>
              )
            })
          : current === 'up' ? <ThumbsUp className={cn(sizeClass[size], 'text-success')} /> : current === 'down' ? <ThumbsDown className={cn(sizeClass[size], 'text-destructive')} /> : <span className="text-xs text-muted-foreground">No rating</span>}
      </span>
    )
  }

  if (variant === 'thumbs') {
    return (
      <div data-slot="rating" role="radiogroup" aria-label={ariaLabel ?? 'Rate this response'} className={cn('inline-flex items-center gap-1', disabled && 'opacity-50', className)}>
        {(['up', 'down'] as const).map((kind) => {
          const Icon = kind === 'up' ? ThumbsUp : ThumbsDown
          const active = current === kind
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={labels[kind] ?? (kind === 'up' ? 'Good response' : 'Bad response')}
              disabled={disabled}
              onClick={() => set(active && allowClear ? null : kind)}
              className={cn('rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted', active && 'bg-accent text-foreground', kind === 'down' && active && 'text-destructive')}
            >
              <Icon className="size-4" />
            </button>
          )
        })}
        {name ? <input type="hidden" name={name} value={typeof current === 'string' ? current : ''} /> : null}
      </div>
    )
  }

  const preview = hover ?? (typeof current === 'number' ? current : 0)
  return (
    <div data-slot="rating" role="radiogroup" aria-label={ariaLabel ?? 'Rating'} className={cn('inline-flex flex-wrap items-center gap-0.5', disabled && 'opacity-50', className)}>
      {Array.from({ length: Math.min(max, 50) }, (_, i) => {
        const n = i + 1
        const active = n <= preview
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={current === n}
            aria-label={getValueLabel(n, max)}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => chooseStar(n)}
            className="rounded p-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star className={cn(sizeClass[size], active && 'fill-warning text-warning')} />
          </button>
        )
      })}
      {name ? <input type="hidden" name={name} value={typeof current === 'number' ? current : ''} /> : null}
    </div>
  )
}
