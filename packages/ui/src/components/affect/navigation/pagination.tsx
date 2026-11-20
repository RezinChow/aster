import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'

import { cn } from '../../../lib/utils'

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  page: number
  onPageChange: (page: number) => void
  total?: number
  pageSize?: number
  pageCount?: number
  pageSizes?: number[]
  onPageSizeChange?: (pageSize: number) => void
  siblings?: number
  compact?: boolean
  disabled?: boolean
  'aria-label'?: string
}

type Slot = number | 'ellipsis'

function buildSlots(page: number, count: number, siblings: number): Slot[] {
  const pages = new Set<number>([1, count, page])
  for (let i = 1; i <= siblings; i++) { pages.add(page - i); pages.add(page + i) }
  const sorted = [...pages].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b)
  const slots: Slot[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) slots.push('ellipsis')
    slots.push(p)
  })
  return slots
}

/** Pager with a range label, page numbers, arrows and a custom rows-per-page picker. */
export function Pagination({
  page,
  onPageChange,
  total,
  pageSize = 20,
  pageCount,
  pageSizes,
  onPageSizeChange,
  siblings = 1,
  compact = false,
  disabled = false,
  'aria-label': ariaLabel = 'Pagination',
  className,
  ...props
}: PaginationProps) {
  const [sizeOpen, setSizeOpen] = useState(false)
  const sizeRef = useRef<HTMLDivElement>(null)
  const count = pageCount ?? (total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1)
  const current = Math.min(Math.max(1, page), count)
  const slots = buildSlots(current, count, siblings)
  const start = total ? (current - 1) * pageSize + 1 : 0
  const end = total ? Math.min(total, current * pageSize) : 0
  const range = total !== undefined ? `${start}–${end} of ${total.toLocaleString()}` : `Page ${current} of ${count}`

  useEffect(() => {
    if (!sizeOpen) return
    const onDoc = (e: MouseEvent) => { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [sizeOpen])

  const sizes = pageSizes ? Array.from(new Set([...pageSizes, pageSize])).sort((a, b) => a - b) : []
  const changeSize = (size: number) => {
    const firstRow = (current - 1) * pageSize
    onPageSizeChange?.(size)
    onPageChange(Math.floor(firstRow / size) + 1)
    setSizeOpen(false)
  }

  return (
    <nav aria-label={ariaLabel} data-slot="pagination" {...props} className={cn('flex flex-wrap items-center justify-between gap-3 text-xs', disabled && 'pointer-events-none opacity-60', className)}>
      <div className="flex items-center gap-3">
        {sizes.length ? (
          <div ref={sizeRef} className="relative flex items-center gap-1.5 text-muted-foreground">
            Rows per page
            <button type="button" aria-haspopup="listbox" aria-expanded={sizeOpen} disabled={disabled} onClick={() => setSizeOpen((o) => !o)} className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-foreground">
              {pageSize} <ChevronDown className="size-3 text-muted-foreground" />
            </button>
            {sizeOpen ? (
              <div role="listbox" className="absolute top-full left-0 z-50 mt-1 w-16 rounded-md border border-border bg-card p-1 shadow-lg">
                {sizes.map((size) => (
                  <div key={size} role="option" aria-selected={size === pageSize} onClick={() => changeSize(size)} className={cn('cursor-pointer rounded px-2 py-1 text-xs text-foreground hover:bg-accent', size === pageSize && 'bg-accent')}>{size}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <span aria-live="polite" className="tabular-nums text-muted-foreground">{range}</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" aria-disabled={current <= 1} onClick={() => current > 1 && onPageChange(current - 1)} className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-3.5" /></button>
        {!compact ? slots.map((slot, i) => slot === 'ellipsis' ? (
          <span key={`e-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">…</span>
        ) : (
          <button key={slot} type="button" aria-label={`Page ${slot}`} aria-current={slot === current ? 'page' : undefined} onClick={() => onPageChange(slot)} className={cn('size-7 rounded-md text-xs tabular-nums', slot === current ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground hover:bg-muted')}>{slot}</button>
        )) : null}
        <button type="button" aria-label="Next page" aria-disabled={current >= count} onClick={() => current < count && onPageChange(current + 1)} className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-40"><ChevronRight className="size-3.5" /></button>
      </div>
    </nav>
  )
}
