import { Check, Plus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  hint?: string
  avatar?: string | boolean
  color?: string
  icon?: ReactNode
  group?: string
  keywords?: string
}

export interface ComboboxProps {
  options: ComboboxOption[]
  multiple?: boolean
  value?: string[]
  defaultValue?: string[]
  onChange?: (value: string[], options: ComboboxOption[]) => void
  placeholder?: string
  creatable?: boolean
  onCreate?: (text: string) => ComboboxOption | void
  createLabel?: (text: string) => string
  maxVisibleTags?: number
  label?: string
  defaultOpen?: boolean
  emptyText?: string
  className?: string
}

/** Searchable single/multi picker with chips, grouped options and create-on-the-fly. */
export function Combobox({
  options,
  multiple = true,
  value,
  defaultValue = [],
  onChange,
  placeholder = 'Search…',
  creatable = false,
  onCreate,
  createLabel = (text) => `Create “${text}”`,
  maxVisibleTags,
  label,
  defaultOpen = false,
  emptyText = 'No results',
  className
}: ComboboxProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<string[]>(defaultValue)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(defaultOpen)
  const [active, setActive] = useState(0)
  const selected = isControlled ? value : internal

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(
    () => options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  )
  const canCreate = creatable && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase())
  const rows: Array<{ kind: 'option'; option: ComboboxOption } | { kind: 'create' }> = [
    ...filtered.map((option) => ({ kind: 'option' as const, option })),
    ...(canCreate ? [{ kind: 'create' as const }] : [])
  ]

  const emit = (next: string[]) => {
    if (!isControlled) setInternal(next)
    onChange?.(next, next.map((v) => options.find((o) => o.value === v)).filter((o): o is ComboboxOption => Boolean(o)))
  }

  const toggle = (option: ComboboxOption) => {
    if (multiple) emit(selected.includes(option.value) ? selected.filter((v) => v !== option.value) : [...selected, option.value])
    else { emit([option.value]); setOpen(false); setQuery('') }
  }

  const create = () => {
    const created = onCreate?.(query.trim()) as unknown as ComboboxOption | undefined
    const made = created ?? { value: query.trim(), label: query.trim() }
    if (!multiple) { emit([made.value]); setOpen(false) }
    else emit([...selected, made.value])
    setQuery('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { setOpen(false); setQuery(''); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActive((n) => (n + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % Math.max(1, rows.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[active]
      if (!row) return
      if (row.kind === 'create') create()
      else toggle(row.option)
    } else if (event.key === 'Backspace' && !query && selected.length) {
      emit(selected.slice(0, -1))
    }
  }

  const visibleTags = maxVisibleTags ? selected.slice(0, maxVisibleTags) : selected
  const hiddenCount = selected.length - visibleTags.length
  let lastGroup: string | undefined

  return (
    <div ref={rootRef} data-slot="combobox" className={cn('relative w-full', className)}>
      {label ? <label className="mb-1.5 block text-xs font-medium text-foreground">{label}</label> : null}
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-ring" onClick={() => setOpen(true)}>
        {visibleTags.map((v) => {
          const option = options.find((o) => o.value === v)
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
              {option?.avatar ? <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{option.label.charAt(0)}</span> : null}
              <span className="max-w-28 truncate">{option?.label ?? v}</span>
              <button type="button" aria-label={`Remove ${option?.label ?? v}`} onClick={(e) => { e.stopPropagation(); emit(selected.filter((s) => s !== v)) }} className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
            </span>
          )
        })}
        {hiddenCount > 0 ? <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">+{hiddenCount}</span> : null}
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] ? `${id}-row-${active}` : undefined}
          aria-label={label ?? 'Search options'}
          value={query}
          placeholder={selected.length ? '' : placeholder}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-24 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open ? (
        <div id={`${id}-list`} role="listbox" aria-multiselectable={multiple} className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {rows.length === 0 ? <div className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</div> : null}
          {rows.map((row, index) => {
            if (row.kind === 'create') {
              return (
                <div key="create" id={`${id}-row-${index}`} role="option" aria-selected={false} onMouseEnter={() => setActive(index)} onClick={create} className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs', index === active && 'bg-accent text-accent-foreground')}>
                  <Plus className="size-3.5" /> {createLabel(query.trim())}
                </div>
              )
            }
            const option = row.option
            const showGroup = option.group && option.group !== lastGroup
            lastGroup = option.group
            return (
              <div key={option.value}>
                {showGroup ? <div className="px-2 pt-2 pb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{option.group}</div> : null}
                <div id={`${id}-row-${index}`} role="option" aria-selected={selected.includes(option.value)} onMouseEnter={() => setActive(index)} onClick={() => toggle(option)} className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs', index === active && 'bg-accent text-accent-foreground')}>
                  {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                  {option.color ? <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} /> : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.hint ? <span className="block truncate text-[11px] text-muted-foreground">{option.hint}</span> : null}
                  </span>
                  {selected.includes(option.value) ? <Check className="size-3.5 shrink-0" /> : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
