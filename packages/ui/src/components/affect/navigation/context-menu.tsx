import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, ReactElement } from 'react'

import { cn } from '../../../lib/utils'
import type { MenuItem } from './dropdown-menu'

export interface ContextMenuProps {
  children: ReactElement
  items: MenuItem[] | ((target: HTMLElement) => MenuItem[])
  title?: string
  'aria-label'?: string
  onOpenChange?: (open: boolean, target: HTMLElement | null) => void
  disabled?: boolean
  width?: number | string
  menuClassName?: string
  className?: string
}

interface MenuState {
  x: number
  y: number
  target: HTMLElement | null
  list: MenuItem[]
}

/** Right-click menu positioned at the pointer, with keyboard and touch-friendly triggers. */
export function ContextMenu({
  children,
  items,
  title,
  'aria-label': ariaLabel,
  onOpenChange,
  disabled,
  width,
  menuClassName,
  className
}: ContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [state, setState] = useState<MenuState | null>(null)
  const [active, setActive] = useState(0)

  const openAt = (x: number, y: number, target: HTMLElement | null) => {
    if (disabled) return
    const list = typeof items === 'function' ? items(target ?? rootRef.current ?? document.body) : items
    if (!list.length) return
    setState({ x, y, target, list })
    setActive(0)
    onOpenChange?.(true, target)
  }
  const close = () => { setState(null); onOpenChange?.(false, null) }

  useEffect(() => {
    if (!state) return
    const onDoc = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) close() }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [state])

  useEffect(() => {
    if (state) requestAnimationFrame(() => itemRefs.current[active]?.focus())
  }, [state, active])

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    openAt(event.clientX, event.clientY, event.target as HTMLElement)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = state?.list ?? []
    const enabled = list.map((item, i) => item.disabled ? -1 : i).filter((i) => i >= 0)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const pos = enabled.indexOf(active)
      const next = event.key === 'ArrowDown' ? enabled[(pos + 1) % enabled.length] : enabled[(pos - 1 + enabled.length) % enabled.length]
      if (next !== undefined) { setActive(next); itemRefs.current[next]?.focus() }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1]
      if (next !== undefined) { setActive(next); itemRefs.current[next]?.focus() }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const item = list[active]
      if (item && !item.disabled) { item.onSelect?.(); if (!item.keepOpen) close() }
    }
  }

  const onWrapperKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault()
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      openAt(rect.left, rect.bottom, event.target as HTMLElement)
    }
  }

  const renderItem = (item: MenuItem, index: number) => (
    <button
      key={`${item.label}-${index}`}
      ref={(el) => { itemRefs.current[index] = el }}
      type="button"
      role={item.checked !== undefined ? (item.type === 'radio' ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem'}
      aria-checked={item.checked !== undefined ? item.checked : undefined}
      aria-disabled={item.disabled || undefined}
      tabIndex={index === active ? 0 : -1}
      onMouseEnter={() => setActive(index)}
      onClick={() => { if (item.disabled) return; item.onSelect?.(); if (!item.keepOpen) close() }}
      className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground outline-none hover:bg-accent focus:bg-accent', item.disabled && 'pointer-events-none opacity-40', item.danger && 'text-destructive hover:bg-destructive/10')}
    >
      {item.icon ? <span className="shrink-0 text-muted-foreground">{item.icon}</span> : null}
      <span className="flex-1 truncate">{item.label}</span>
      {item.shortcut ? <kbd className="text-[10px] text-muted-foreground">{item.shortcut}</kbd> : null}
      {item.checked ? <Check className="size-3.5" /> : null}
      {item.submenu ? <ChevronRight className="size-3.5 text-muted-foreground" /> : null}
    </button>
  )

  return (
    <div ref={rootRef} data-slot="context-menu" className={className} onContextMenu={onContextMenu} onKeyDown={onWrapperKeyDown}>
      {children}
      {state ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={ariaLabel ?? title}
          onKeyDown={onKeyDown}
          style={{ position: 'fixed', top: Math.min(state.y, window.innerHeight - 240), left: Math.min(state.x, window.innerWidth - 220), width, zIndex: 50 }}
          className={cn('min-w-[180px] rounded-md border border-border bg-card p-1 shadow-lg', menuClassName)}
        >
          {title ? <div className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{title}</div> : null}
          {state.list.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              {item.divider ? <div role="separator" className="my-1 border-t border-border" /> : null}
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
