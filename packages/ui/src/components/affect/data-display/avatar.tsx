import { UserRound } from 'lucide-react'
import { useState } from 'react'
import type { HTMLAttributes } from 'react'

import { cn } from '../../../lib/utils'

export type AvatarSize = 20 | 24 | 32 | 40
export type AvatarStatus = 'online' | 'away' | 'busy'
export type AvatarKind = 'person' | 'agent'

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  name?: string
  src?: string
  size?: AvatarSize
  shape?: 'circle' | 'square'
  status?: AvatarStatus
  kind?: AvatarKind
  seed?: string
  color?: string
  working?: boolean
}

export interface AvatarGroupProps extends HTMLAttributes<HTMLSpanElement> {
  size?: AvatarSize
  max?: number
  total?: number
}

const palette = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500'
]

const statusClass: Record<AvatarStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-destructive'
}

const statusLabel: Record<AvatarStatus, string> = {
  online: 'online',
  away: 'away',
  busy: 'busy'
}

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

function initials(name?: string): string {
  if (!name?.trim()) return ''
  const words = name.trim().split(/\s+/).filter((w) => !/^(iii|ii|jr\.?|sr\.?)$/i.test(w))
  const source = words.length ? words : name.trim().split(/\s+/)
  const first = Array.from(source[0] ?? '')[0] ?? ''
  const last = source.length > 1 ? (Array.from(source[source.length - 1] ?? '')[0] ?? '') : ''
  return (first + last).toUpperCase()
}

/** A person's picture or initials, or an agent's twinkling pixel mark. */
export function Avatar({
  name,
  src,
  size = 32,
  shape,
  status,
  kind = 'person',
  seed,
  color = '#2f6bff',
  working = false,
  className,
  style,
  'aria-label': ariaLabel,
  ...props
}: AvatarProps) {
  const [loaded, setLoaded] = useState(false)
  const resolvedShape = shape ?? (kind === 'agent' ? 'square' : 'circle')
  const key = seed ?? name ?? ''
  const tone = palette[hash(key) % palette.length]
  const letters = initials(name)
  const dot = status ? Math.max(6, Math.round(size * 0.3)) : 0
  const label = ariaLabel ?? (name ? (status ? `${name}, ${statusLabel[status]}` : name) : undefined)
  const isAgent = kind === 'agent'
  const mark = Array.from({ length: 9 }, (_, i) => {
    const on = (hash(`${key}:${i}`) % 5) < 3
    return (
      <span
        key={i}
        aria-hidden="true"
        className={cn('block rounded-[1px]', on && 'opacity-100', !on && 'opacity-0')}
        style={{ backgroundColor: color, animationDelay: `${(i % 3) * 120}ms` }}
      />
    )
  })

  return (
    <span
      data-slot="avatar"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-visible align-middle',
        resolvedShape === 'circle' ? 'rounded-full' : 'rounded-md',
        className
      )}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden',
          resolvedShape === 'circle' ? 'rounded-full' : 'rounded-md',
          isAgent ? 'bg-card ring-1 ring-border' : tone
        )}
      >
        {src ? (
          <img
            src={src}
            alt=""
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(false)}
            className={cn('size-full object-cover', !loaded && 'opacity-0')}
          />
        ) : null}
        {!src || !loaded ? (
          isAgent ? (
            <span
              className={cn(
                'grid gap-px',
                working && 'animate-pulse',
                resolvedShape === 'circle' ? 'rounded-full p-0.5' : 'p-[3px]'
              )}
              style={{ width: size, height: size, gridTemplateColumns: 'repeat(3, 1fr)' }}
            >
              {mark}
            </span>
          ) : letters ? (
            <span className="font-semibold leading-none text-white" style={{ fontSize: Math.max(9, size * 0.38) }}>
              {letters}
            </span>
          ) : (
            <UserRound className="text-muted-foreground" style={{ width: size * 0.55, height: size * 0.55 }} />
          )
        ) : null}
      </span>
      {status ? (
        <span
          aria-hidden="true"
          className={cn('absolute rounded-full ring-2 ring-card', statusClass[status])}
          style={{ width: dot, height: dot, right: -1, bottom: -1 }}
        />
      ) : null}
    </span>
  )
}

/** Overlapping avatars that end in a +N chip when there are more. */
export function AvatarGroup({ children, size = 32, max = 4, total, className, ...props }: AvatarGroupProps) {
  const array = Array.isArray(children) ? children : children == null ? [] : [children]
  const shown = array.slice(0, max)
  const hidden = (typeof total === 'number' ? total : array.length) - shown.length
  const overflow = hidden > 0 ? (hidden > 99 ? '99+' : `+${hidden}`) : ''

  return (
    <span
      data-slot="avatar-group"
      role="group"
      className={cn('inline-flex items-center', className)}
      {...props}
    >
      {shown.map((child, i) => (
        <span key={i} className="relative" style={{ marginLeft: i === 0 ? 0 : -size * 0.28, zIndex: shown.length - i }}>
          {child}
        </span>
      ))}
      {overflow ? (
        <span
          aria-label={`${hidden} more`}
          className="relative z-0 inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card"
          style={{ width: size, height: size, marginLeft: -size * 0.28, fontSize: Math.max(9, size * 0.32) }}
        >
          {overflow}
        </span>
      ) : null}
    </span>
  )
}
