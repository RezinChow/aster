import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty } from '../shared'

export interface MenuItem {
  label: string
  description?: string
  icon?: ReactNode
  logo?: ReactNode
  checked?: boolean
  type?: 'radio' | 'checkbox'
  danger?: boolean
  shortcut?: string
  divider?: boolean
  disabled?: boolean
  keepOpen?: boolean
  submenu?: MenuItem[]
  onSelect?: () => void
}

export interface DropdownTriggerProps {
  onClick: () => void
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string
  ref: Ref<HTMLButtonElement>
}

export interface DropdownMenuProps {
  trigger: (state: { open: boolean; toggle: () => void; triggerProps: DropdownTriggerProps }) => ReactNode
  items: MenuItem[]
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  title?: string
  header?: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  width?: number | string
  menuClassName?: string
  empty?: ReactNode
  className?: string
  'aria-label'?: string
}

/** Menu behind any trigger, with check items, shortcuts, submenus and full keyboard control. */
export function DropdownMenu({
  trigger,
  items,
  align = 'start',
  side = 'bottom',
  title,
  header,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  width,
  menuClassName,
  empty = 'Nothing here yet',
  className,
  'aria-label': ariaLabel
}: DropdownMenuProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? internalOpen
  const [active, setActive] = useState(0)
  const [submenu, setSubmenu] = useState<number | null>(null)
  const setOpen = (next: boolean) => { if (controlledOpen === undefined) setInternalOpen(next); onOpenChange?.(next) }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  useEffect(() => { if (open) itemRefs.current[active]?.focus() }, [open, active])

  const enabled = items.map((item, i) => !item.disabled ? i : -1).filter((i) => i >= 0)
  const select = (item: MenuItem) => {
    if (item.submenu) { setSubmenu(items.indexOf(item)); return }
    if (item.disabled) return
    item.onSelect?.()
    if (!item.keepOpen) { setOpen(false); setSubmenu(null); triggerRef.current?.focus() }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const pos = enabled.indexOf(active)
      const next = event.key === 'ArrowDown' ? enabled[(pos + 1) % enabled.length] : enabled[(pos - 1 + enabled.length) % enabled.length]
      if (next !== undefined) { setActive(next); itemRefs.current[next]?.focus() }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? enabled[0] : enabled[enabled.length - 1]
      if (next !== undefined) { setActive(next); itemRefs.current[next]?.focus() }
    } else if (event.key === 'ArrowRight' && items[active]?.submenu) {
      event.preventDefault(); setSubmenu(active)
    } else if (event.key === 'ArrowLeft' && submenu !== null) {
      event.preventDefault(); setSubmenu(null)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); select(items[active])
    }
  }

  const triggerProps: DropdownTriggerProps = {
    onClick: () => setOpen(!open),
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': `${id}-menu`,
    ref: triggerRef
  }

  return (
    <div ref={rootRef} data-slot="dropdown-menu" className={cn('relative inline-block', className)}>
      {trigger({ open, toggle: () => setOpen(!open), triggerProps })}
      {open ? (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-label={ariaLabel ?? title}
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          style={{ width }}
          className={cn('absolute z-50 min-w-[180px] rounded-md border border-border bg-card p-1 shadow-lg', side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1', align === 'end' ? 'right-0' : 'left-0', menuClassName)}
        >
          {header ? <div className="border-b border-border px-2 py-1.5">{header}</div> : null}
          {title ? <div className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{title}</div> : null}
          {items.length === 0 ? <div className="p-2"><AffectEmpty>{empty}</AffectEmpty></div> : null}
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`}>
              {item.divider ? <div role="separator" className="my-1 border-t border-border" /> : null}
              <button
                ref={(el) => { itemRefs.current[index] = el }}
                type="button"
                role={item.checked !== undefined ? (item.type === 'radio' ? 'menuitemradio' : 'menuitemcheckbox') : 'menuitem'}
                aria-checked={item.checked !== undefined ? item.checked : undefined}
                aria-disabled={item.disabled || undefined}
                aria-haspopup={item.submenu ? 'menu' : undefined}
                aria-expanded={item.submenu ? submenu === index : undefined}
                tabIndex={index === active ? 0 : -1}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(item)}
                className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground outline-none hover:bg-accent focus:bg-accent', item.disabled && 'pointer-events-none opacity-40', item.danger && 'text-destructive hover:bg-destructive/10')}
              >
                {item.icon ? <span className="shrink-0 text-muted-foreground">{item.icon}</span> : null}
                {item.logo ? <span className="flex size-4 shrink-0 items-center justify-center">{item.logo}</span> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{item.label}</span>
                  {item.description ? <span className="block truncate text-[10px] text-muted-foreground">{item.description}</span> : null}
                </span>
                {item.shortcut ? <kbd className="shrink-0 text-[10px] text-muted-foreground">{item.shortcut}</kbd> : null}
                {item.checked !== undefined && item.checked ? <Check className="size-3.5 shrink-0" /> : null}
                {item.submenu ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" /> : null}
              </button>
              {item.submenu && submenu === index ? (
                <div role="menu" className="absolute left-full ml-1 -mt-8 min-w-[160px] rounded-md border border-border bg-card p-1 shadow-lg">
                  {item.submenu.map((sub, j) => (
                    <button key={j} type="button" role="menuitem" onClick={() => { sub.onSelect?.(); setSubmenu(null); if (!sub.keepOpen) { setOpen(false); triggerRef.current?.focus() } }} className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent', sub.danger && 'text-destructive', sub.disabled && 'pointer-events-none opacity-40')}>
                      <span className="flex-1">{sub.label}</span>{sub.checked ? <Check className="size-3.5" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
