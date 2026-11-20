import type { SVGProps } from 'react'

import { cn } from '../../../lib/utils'

export interface SpinnerProps extends SVGProps<SVGSVGElement> {
  size?: number
  label?: string
}

/** A small turning arc for work that is running right now. */
export function Spinner({ size = 14, label, className, ...props }: SpinnerProps) {
  return (
    <svg
      data-slot="spinner"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0 animate-spin text-current', className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
