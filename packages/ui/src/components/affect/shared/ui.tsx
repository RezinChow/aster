import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectOption, AffectStatus, AffectTone } from './types'

/** Shared tone recipes. Components may reuse these instead of inventing new colors. */
export const affectToneClass: Record<AffectTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success-subtle text-success-subtle-foreground',
  warning: 'bg-warning-subtle text-warning-subtle-foreground',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-info-subtle text-info-subtle-foreground'
}

export const affectStatusClass: Record<AffectStatus, string> = {
  queued: 'bg-muted-foreground/60',
  running: 'bg-info',
  waiting: 'bg-warning',
  done: 'bg-success',
  failed: 'bg-destructive',
  cancelled: 'bg-muted-foreground/50',
  paused: 'bg-warning'
}

export const affectStatusTone: Record<AffectStatus, AffectTone> = {
  queued: 'neutral',
  running: 'info',
  waiting: 'warning',
  done: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  paused: 'warning'
}

export function AffectSurface({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function AffectHeader({
  title,
  description,
  actions,
  className
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0 space-y-0.5">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  )
}

export function AffectSectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'text-[10px] font-medium tracking-wide text-muted-foreground uppercase',
        className
      )}
    >
      {children}
    </div>
  )
}

export function AffectStatusDot({
  status,
  className,
  label
}: {
  status: AffectStatus
  className?: string
  label?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        aria-hidden="true"
        className={cn('size-1.5 shrink-0 rounded-full', affectStatusClass[status])}
      />
      {label ? <span className="text-xs text-muted-foreground">{label}</span> : null}
    </span>
  )
}

export function AffectToneBadge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: AffectTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        affectToneClass[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function AffectMeter({
  value,
  max = 100,
  tone = 'primary',
  label,
  className
}: {
  value: number
  max?: number
  tone?: AffectTone
  label?: string
  className?: string
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-200', affectToneClass[tone].split(' ')[0])}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

export function AffectKeyValue({
  label,
  value,
  className
}: {
  label: ReactNode
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 text-xs', className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium text-foreground">{value}</span>
    </div>
  )
}

export function AffectEmpty({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-16 items-center justify-center rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground',
        className
      )}
    >
      {children}
    </div>
  )
}

export function AffectToolbar({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} {...props}>
      {children}
    </div>
  )
}

export function AffectRow({
  icon,
  title,
  subtitle,
  trailing,
  selected,
  onClick,
  className
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      {icon ? <span className="shrink-0 text-muted-foreground">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{title}</span>
        {subtitle ? <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  )
  const styles = cn(
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
    selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
    onClick && 'cursor-pointer',
    className
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={styles}>
        {content}
      </button>
    )
  }
  return <div className={styles}>{content}</div>
}

/** Custom listbox trigger; replaces native select on product surfaces. */
export function AffectSelectMenu({
  value,
  options,
  onChange,
  label,
  autoFocus,
  className
}: {
  value: string
  options: ReadonlyArray<AffectOption>
  onChange: (value: string) => void
  label: string
  autoFocus?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        autoFocus={autoFocus}
        onClick={() => setOpen((previous) => !previous)}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="max-w-28 truncate">{current?.label ?? value}</span>
        <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-20 mt-1 max-h-52 min-w-32 overflow-auto rounded-md border border-border bg-background p-1 shadow-md"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted disabled:opacity-40',
                option.value === value && 'bg-accent'
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.description ? (
                <span className="truncate text-[10px] text-muted-foreground">{option.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function AffectIconButton({
  label,
  children,
  onClick,
  disabled,
  active,
  className
}: {
  label: string
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-border focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-accent text-accent-foreground',
        className
      )}
    >
      {children}
    </button>
  )
}
