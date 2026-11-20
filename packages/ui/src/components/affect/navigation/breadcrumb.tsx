import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: (event: MouseEvent) => void
  icon?: ReactNode
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
  separator?: 'slash' | 'chevron' | ReactNode
  maxItems?: number
  'aria-label'?: string
}

/** Breadcrumb trail with quiet separators and a folded … menu for long trails. */
export function Breadcrumb({
  items,
  separator = 'chevron',
  maxItems = 4,
  'aria-label': ariaLabel = 'Breadcrumb',
  className,
  ...props
}: BreadcrumbProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLSpanElement>(null)
  const showFold = items.length > maxItems
  const visible = showFold ? [items[0], ...items.slice(items.length - maxItems + 1)] : items
  const hidden = showFold ? items.slice(1, items.length - maxItems + 1) : []

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: globalThis.MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const Sep = () => (
    <span aria-hidden="true" className="shrink-0 text-muted-foreground/60">
      {separator === 'chevron' ? <ChevronRight className="size-3.5" /> : separator === 'slash' ? '/' : separator}
    </span>
  )

  const renderCrumb = (item: BreadcrumbItem, index: number, current: boolean) => {
    const content = (
      <>
        {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
        <span className="truncate" dir="auto" title={item.label}>{item.label}</span>
      </>
    )
    const style = cn('inline-flex max-w-[200px] items-center gap-1.5 rounded px-1 py-0.5 text-xs', current ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted')
    if (current) return <span key={index} aria-current="page" className={style}>{content}</span>
    if (item.href) return <a key={index} href={item.href} onClick={item.onClick} className={style}>{content}</a>
    return <button key={index} type="button" onClick={item.onClick} className={style}>{content}</button>
  }

  return (
    <nav aria-label={ariaLabel} data-slot="breadcrumb" {...props} className={cn('flex min-w-0 items-center gap-1', className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {visible.map((item, i) => {
          const globalIndex = showFold && i > 0 ? hidden.length + i : i
          return (
            <li key={globalIndex} className="flex min-w-0 items-center gap-1">
              {i > 0 ? <Sep /> : null}
              {showFold && i === 1 ? (
                <span ref={menuRef} className="relative">
                  <button type="button" aria-label={`Show ${hidden.length} more crumbs`} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="inline-flex items-center rounded px-1 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="size-3.5" /></button>
                  {menuOpen ? (
                    <span role="menu" className="absolute top-full left-0 z-50 mt-1 flex w-40 flex-col rounded-md border border-border bg-card p-1 shadow-lg">
                      {hidden.map((crumb, j) => (
                        <button key={j} type="button" role="menuitem" onClick={() => setMenuOpen(false)} className="truncate rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent">{crumb.label}</button>
                      ))}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {renderCrumb(item, globalIndex, globalIndex === items.length - 1)}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
