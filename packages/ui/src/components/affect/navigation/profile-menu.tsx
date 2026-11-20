import { ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter, AffectSurface } from '../shared'

export interface ProfileMenuItem {
  id: string
  label: string
  icon?: ReactNode
  badge?: string
  onSelect?: () => void
}

export interface ProfileSetup {
  done: number
  total: number
  next: string
  onContinue?: () => void
}

export interface ProfileMenuProps {
  name: string
  email: string
  avatar?: ReactNode
  items?: ProfileMenuItem[]
  setup?: ProfileSetup
  className?: string
}

/** Avatar-triggered account card with menu actions and profile setup progress. */
export function ProfileMenu({ name, email, avatar, items = [], setup, className }: ProfileMenuProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length)
      setActive(next)
      itemRefs.current[next]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : items.length - 1
      setActive(next)
      itemRefs.current[next]?.focus()
    }
  }

  return (
    <div ref={rootRef} data-slot="profile-menu" className={cn('relative inline-block', className)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Account menu for ${name}`} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {avatar ?? <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">{name.charAt(0).toUpperCase()}</span>}
      </button>
      {open ? (
        <AffectSurface className="absolute top-full right-0 z-50 mt-2 w-64 p-0 shadow-lg">
          <div className="flex items-center gap-2.5 border-b border-border px-3 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{name.charAt(0).toUpperCase()}</span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">{name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{email}</span>
            </span>
          </div>
          {setup ? (
            <div className="border-b border-border px-3 py-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Profile setup</span>
                <span className="tabular-nums text-foreground">{setup.done}/{setup.total}</span>
              </div>
              <AffectMeter value={setup.done} max={setup.total} label="Profile setup" />
              <button type="button" onClick={() => { setup.onContinue?.(); setOpen(false) }} className="mt-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted">
                <span>{setup.next}</span><ChevronRight className="size-3 text-muted-foreground" />
              </button>
            </div>
          ) : null}
          <div role="menu" aria-label={`Account menu for ${name}`} onKeyDown={onKeyDown} className="p-1">
            {items.map((item, index) => (
              <button
                key={item.id}
                ref={(el) => { itemRefs.current[index] = el }}
                type="button"
                role="menuitem"
                tabIndex={index === active ? 0 : -1}
                onMouseEnter={() => setActive(index)}
                onClick={() => { item.onSelect?.(); setOpen(false) }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
              >
                {item.icon ? <span className="shrink-0 text-muted-foreground">{item.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{item.badge}</span> : null}
              </button>
            ))}
          </div>
          <div className="sr-only" id={`${id}-status`} aria-live="polite">{open ? 'Account menu open' : ''}</div>
        </AffectSurface>
      ) : null}
    </div>
  )
}
