import { FileQuestion } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  icon?: ReactNode | null
  bare?: boolean
  tall?: boolean
}

/** What a list, table or panel shows while it has nothing yet. */
export function EmptyState({
  title,
  text,
  action,
  icon,
  bare = false,
  tall = false,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-8 text-center',
        !bare && 'rounded-lg border border-dashed border-border bg-background',
        tall && 'min-h-full',
        className
      )}
      {...props}
    >
      {icon !== null ? (
        <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm">
          {icon ?? <FileQuestion className="size-5" />}
        </span>
      ) : null}
      <div className="text-sm font-medium text-foreground">{title}</div>
      {text ? <div className="max-w-sm text-xs leading-relaxed text-muted-foreground">{text}</div> : null}
      {children}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}
