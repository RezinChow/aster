import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize, AffectTone } from '../shared/types'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'danger'
  tone?: AffectTone
  size?: AffectSize
  loading?: boolean
  icon?: ReactNode
}

const variantClass = {
  solid: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-background text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-destructive text-white hover:bg-destructive/90'
} as const

const sizeClass: Record<AffectSize, string> = {
  sm: 'h-7 gap-1 px-2 text-xs',
  md: 'h-9 gap-1.5 px-3 text-sm',
  lg: 'h-11 gap-2 px-4 text-sm'
}

/** Button used across affect components; independent of the legacy Button variant set. */
export function Button({
  variant = 'solid',
  tone,
  size = 'md',
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        tone && variant === 'solid' && tone !== 'primary' && 'bg-foreground text-background',
        className
      )}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : icon}
      {children}
    </button>
  )
}
