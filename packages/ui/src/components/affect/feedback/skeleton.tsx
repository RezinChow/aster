import { useEffect, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface SkeletonProps extends HTMLAttributes<HTMLSpanElement> {
  width?: number | string
  height?: number | string
  radius?: number | string
  line?: boolean | number | string
}

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  label?: string
  delay?: number
  children?: ReactNode
}

const cssLength = (value: number | string | undefined, fallback?: string) =>
  value === undefined ? fallback : typeof value === 'number' ? `${value}px` : value

/** A gray shape in the exact size of the content it stands in for. */
export function Skeleton({ width, height, radius, line, className, children, style, ...props }: SkeletonProps) {
  const shape = (
    <span
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('block max-w-full animate-pulse rounded bg-muted', className)}
      style={{
        width: cssLength(width, '100%'),
        height: cssLength(height, line ? cssLength(line === true ? '1lh' : line, '12px') : '12px'),
        borderRadius: cssLength(radius, '6px'),
        ...style
      }}
      {...props}
    >
      {children}
    </span>
  )

  if (!line) return shape
  return (
    <span aria-hidden="true" className="flex w-full items-center" style={{ height: cssLength(line === true ? '1lh' : line, '1lh') }}>
      {shape}
    </span>
  )
}

/** A delayed, screen-reader-friendly wrapper around the skeletons of one area. */
export function Loading({ label = 'Loading', delay = 180, className, children, style, ...props }: LoadingProps) {
  const [visible, setVisible] = useState(delay <= 0)
  useEffect(() => {
    if (delay <= 0) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      role="status"
      aria-label={label}
      data-slot="skeleton-loading"
      className={cn('transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0', className)}
      style={style}
      {...props}
    >
      {visible ? children : null}
    </div>
  )
}
