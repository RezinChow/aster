import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  label?: ReactNode
  decorative?: boolean
}

/** A thin line between groups, optionally with a word in its middle. */
export function Separator({
  orientation = 'horizontal',
  label,
  decorative = true,
  className,
  style,
  children,
  ...props
}: SeparatorProps) {
  const vertical = orientation === 'vertical'
  const text = label ?? children

  if (vertical) {
    return (
      <div
        data-slot="separator"
        role={decorative ? undefined : 'separator'}
        aria-orientation={decorative ? undefined : 'vertical'}
        aria-hidden={decorative || undefined}
        className={cn('mx-1 h-4 w-px shrink-0 bg-border', className)}
        style={style}
        {...props}
      />
    )
  }

  if (text != null && text !== '') {
    return (
      <div
        data-slot="separator"
        role="none"
        className={cn('flex items-center gap-2', className)}
        style={style}
        {...props}
      >
        <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-border" />
        <span
          role={decorative ? undefined : 'separator'}
          aria-orientation={decorative ? undefined : 'horizontal'}
          className="shrink-0 text-[11px] text-muted-foreground"
        >
          {text}
        </span>
        <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-border" />
      </div>
    )
  }

  return (
    <div
      data-slot="separator"
      role={decorative ? undefined : 'separator'}
      aria-orientation={decorative ? undefined : 'horizontal'}
      aria-hidden={decorative || undefined}
      className={cn('my-1 h-px w-full bg-border', className)}
      style={style}
      {...props}
    />
  )
}
