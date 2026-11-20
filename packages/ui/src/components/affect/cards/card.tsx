import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li'
  interactive?: boolean
  selected?: boolean
  onClick?: () => void
}

export interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  titleAs?: 'h2' | 'h3' | 'h4' | 'p'
  className?: string
}

/** Base surface with a header, content and footer; optionally a whole-card click target. */
export function Card({
  as: Tag = 'div',
  interactive = false,
  selected = false,
  onClick,
  onKeyDown,
  className,
  children,
  ...props
}: CardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event)
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onClick?.()
    }
  }
  return (
    <Tag
      data-slot="card"
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm outline-none',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'border-foreground/30 bg-muted',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

/** Card heading with a title, quiet description, leading icon and trailing action. */
export function CardHeader({ title, description, icon, action, titleAs: Title = 'h3', className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start gap-2 p-4 pb-2', className)}>
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <Title className="m-0 text-sm font-medium text-foreground">{title}</Title>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('px-4 pb-3 text-xs text-foreground', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-footer" className={cn('flex items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground', className)} {...props} />
}
