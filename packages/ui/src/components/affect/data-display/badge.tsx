import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { affectToneClass } from '../shared'
import type { AffectTone } from '../shared'

export type BadgeTone = AffectTone | 'purple'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  dot?: boolean
  live?: boolean
  icon?: ReactNode
  count?: number
  max?: number
}

const toneClass: Record<BadgeTone, string> = {
  neutral: affectToneClass.neutral,
  primary: affectToneClass.primary,
  success: affectToneClass.success,
  warning: affectToneClass.warning,
  danger: affectToneClass.danger,
  info: affectToneClass.info,
  purple: 'bg-violet-500/10 text-violet-500'
}

const dotClass: Record<BadgeTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  purple: 'bg-violet-500'
}

/** A small status label with a soft tone, optional dot, live pulse or round count. */
export function Badge({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  live = false,
  icon,
  count,
  max = 99,
  className,
  children,
  ...props
}: BadgeProps) {
  const showDot = dot || live
  const hasCount = typeof count === 'number' && Number.isFinite(count)
  const value = hasCount ? Math.max(0, Math.floor(count as number)) : 0
  const text = hasCount ? (value > max ? `${max}+` : value.toLocaleString()) : children
  if (!showDot && !icon && !hasCount && (children == null || children === '')) return null

  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-[22px] px-2.5 text-xs',
        toneClass[tone],
        className
      )}
      {...props}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn('size-1.5 shrink-0 rounded-full', dotClass[tone], live && 'animate-pulse')}
        />
      ) : null}
      {icon ? <span aria-hidden="true" className="shrink-0 [&>svg]:size-3">{icon}</span> : null}
      {text != null && text !== '' ? <span className="truncate">{text}</span> : null}
    </span>
  )
}
