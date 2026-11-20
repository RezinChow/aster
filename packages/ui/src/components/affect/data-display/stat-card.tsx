import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface StatCardProps {
  label: string
  value: number | string
  format?: (value: number) => string
  change?: number
  changeFormat?: (value: number) => string
  changeLabel?: string
  lowerIsBetter?: boolean
  icon?: ReactNode
  chart?: ReactNode
  layout?: 'stacked' | 'inline'
  footer?: ReactNode
  loading?: boolean
  href?: string
  onClick?: () => void
  hitProps?: HTMLAttributes<HTMLElement>
  action?: ReactNode
  selected?: boolean
  className?: string
  style?: CSSProperties
}

/** One number with its label, change and room for a chart below or beside it. */
export function StatCard({
  label,
  value,
  format,
  change,
  changeFormat = (n) => `${n.toFixed(1)}%`,
  changeLabel,
  lowerIsBetter = false,
  icon,
  chart,
  layout = 'stacked',
  footer,
  loading = false,
  href,
  onClick,
  hitProps,
  action,
  selected = false,
  className,
  style
}: StatCardProps) {
  const numeric = typeof value === 'number'
  const shown = loading ? null : numeric ? (format ? format(value as number) : Math.round(value as number).toLocaleString('en-US')) : value
  const good = lowerIsBetter ? (change ?? 0) <= 0 : (change ?? 0) >= 0
  const inline = layout === 'inline'

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {icon ? <span className="shrink-0" aria-hidden="true">{icon}</span> : null}
            <span className="truncate">{label}</span>
          </div>
          {loading ? (
            <div aria-hidden="true" className="mt-1 h-8 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <div className="mt-1 truncate text-2xl font-semibold tabular-nums text-foreground">{shown}</div>
          )}
          {typeof change === 'number' ? (
            <div className={cn('mt-1 flex items-center gap-1 text-[11px]', good ? 'text-success' : 'text-destructive')}>
              {change >= 0 ? <ArrowUpRight aria-hidden="true" className="size-3" /> : <ArrowDownRight aria-hidden="true" className="size-3" />}
              <span className="font-medium tabular-nums">{changeFormat(Math.abs(change))}</span>
              {changeLabel ? <span className="text-muted-foreground">{changeLabel}</span> : null}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0" onClick={(event) => event.stopPropagation()}>{action}</div> : null}
      </div>

      {inline ? (
        <div className={cn('mt-2 min-w-0 flex-1', loading && 'h-11 animate-pulse rounded bg-muted')}>
          {loading ? null : chart}
        </div>
      ) : (
        <div className={cn('mt-3', loading && 'h-11 animate-pulse rounded bg-muted')}>
          {loading ? null : chart}
        </div>
      )}
      {footer ? <div className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">{footer}</div> : null}
    </>
  )

  const classes = cn(
    'block w-full rounded-lg border border-border bg-card p-3 text-left text-card-foreground shadow-sm transition-opacity',
    inline && 'flex gap-3',
    selected && 'opacity-60',
    !loading && (href || onClick) && 'hover:bg-muted/30',
    className
  )
  const common = { style, 'data-slot': 'stat-card' as const, className: classes }

  if (href) {
    return <a {...common} {...hitProps} href={href}>{content}</a>
  }
  if (onClick) {
    return <button {...common} {...hitProps} type="button" onClick={onClick}>{content}</button>
  }
  return <div {...common} {...hitProps}>{content}</div>
}
