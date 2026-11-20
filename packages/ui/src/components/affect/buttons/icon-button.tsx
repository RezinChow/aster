import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  variant?: 'ghost' | 'secondary' | 'primary'
  size?: 'sm' | 'md'
  pressed?: boolean
  title?: string
}

const variantClass = {
  ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
  secondary: 'border-border bg-background text-foreground hover:bg-muted',
  primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
} as const

const sizeClass = {
  sm: 'size-8 [&_svg]:size-4',
  md: 'size-10 [&_svg]:size-[18px]'
} as const

/** A square, label-only button with an optional toggle (pressed) state. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  pressed,
  title,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  const tooltip = title === undefined ? label : title || undefined
  return (
    <button
      type={type}
      data-slot="icon-button"
      aria-label={label}
      title={tooltip}
      aria-pressed={pressed}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        variantClass[variant],
        sizeClass[size],
        pressed === true && 'bg-accent text-accent-foreground',
        className
      )}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        {icon}
      </span>
    </button>
  )
}
