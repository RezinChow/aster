import { Check, ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty } from '../shared'

export interface FilterOption {
  id: string
  label: string
}

export interface FilterGroup {
  id: string
  label: string
  options: FilterOption[]
  chipPrefix?: string
}

export type FilterValue = Record<string, string[]>

export interface FilterMenuProps {
  groups: FilterGroup[]
  value?: FilterValue
  defaultValue?: FilterValue
  onChange?: (value: FilterValue) => void
  defaultOpen?: string[]
  title?: string
  hints?: boolean
  className?: string
}

/** Grouped checkbox filters with removable chips and Clear all. */
export function FilterMenu({
  groups,
  value,
  defaultValue = {},
  onChange,
  defaultOpen,
  title = 'Filters',
  hints = true,
  className
}: FilterMenuProps) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<FilterValue>(defaultValue)
  const current = isControlled ? value : internal
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ?? [groups[0]?.id]))
  const [focused, setFocused] = useState(0)

  const emit = (next: FilterValue) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }
  const toggle = (groupId: string, optionId: string) => {
    const picked = current[groupId] ?? []
    emit({ ...current, [groupId]: picked.includes(optionId) ? picked.filter((v) => v !== optionId) : [...picked, optionId] })
  }
  const toggleGroup = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

  const rows: Array<{ kind: 'header' | 'option'; group: FilterGroup; optionId?: string }> = []
  for (const group of groups) {
    rows.push({ kind: 'header', group })
    if (open.has(group.id)) for (const option of group.options) rows.push({ kind: 'option', group, optionId: option.id })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'ArrowDown') setFocused((n) => Math.min(rows.length - 1, n + 1))
    else if (event.key === 'ArrowUp') setFocused((n) => Math.max(0, n - 1))
    else if (event.key === 'Home') setFocused(0)
    else if (event.key === 'End') setFocused(rows.length - 1)
    else {
      const row = rows[focused]
      if (!row) return
      if (row.kind === 'header') toggleGroup(row.group.id)
      else if (row.optionId) toggle(row.group.id, row.optionId)
    }
  }

  const chips = groups.flatMap((group) => (current[group.id] ?? []).map((id) => ({ group, id, label: group.options.find((o) => o.id === id)?.label ?? id })))
  const clearAll = () => emit({})

  return (
    <div data-slot="filter-menu" className={cn('w-full max-w-[420px] rounded-lg border border-border bg-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {chips.length ? <button type="button" onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-foreground">Clear all</button> : null}
      </div>
      {chips.length ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2" aria-live="polite">
          {chips.map(({ group, id, label }) => (
            <span key={`${group.id}-${id}`} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
              {group.chipPrefix}{label}
              <button type="button" aria-label={`Remove filter ${label}`} onClick={() => toggle(group.id, id)} className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
            </span>
          ))}
        </div>
      ) : null}
      <div role="group" aria-label={title} tabIndex={0} onKeyDown={onKeyDown} className="max-h-72 overflow-auto p-1.5 outline-none focus-visible:ring-1 focus-visible:ring-ring">
        {groups.length === 0 ? <AffectEmpty>No filters available</AffectEmpty> : null}
        {rows.map((row, index) => row.kind === 'header' ? (
          <button key={row.group.id} type="button" aria-expanded={open.has(row.group.id)} onClick={() => toggleGroup(row.group.id)} className={cn('flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs font-medium text-foreground', focused === index && 'bg-accent')}>
            {row.group.label}
            <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', !open.has(row.group.id) && '-rotate-90')} />
          </button>
        ) : (
          <div
            key={`${row.group.id}-${row.optionId}`}
            role="checkbox"
            aria-checked={(current[row.group.id] ?? []).includes(row.optionId!)}
            tabIndex={-1}
            onClick={() => row.optionId && toggle(row.group.id, row.optionId)}
            className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground', focused === index && 'bg-accent')}
          >
            <span className={cn('flex size-3.5 items-center justify-center rounded border border-border', (current[row.group.id] ?? []).includes(row.optionId!) && 'border-primary bg-primary text-primary-foreground')}>
              {(current[row.group.id] ?? []).includes(row.optionId!) ? <Check className="size-2.5" /> : null}
            </span>
            {row.group.options.find((o) => o.id === row.optionId)?.label}
          </div>
        ))}
      </div>
      {hints ? <div className="border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">↑ ↓ navigate · Enter toggle</div> : null}
    </div>
  )
}
