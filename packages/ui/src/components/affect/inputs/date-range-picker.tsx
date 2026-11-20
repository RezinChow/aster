import { CalendarRange, Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { cn } from '../../../lib/utils'

export interface DateRange {
  start: Date
  end: Date
}

export type CompareMode = 'off' | 'previous' | 'year'

export interface DateRangePreset {
  id: string
  label: string
  range: (today: Date) => DateRange
}

export interface DateRangePickerProps {
  value?: DateRange
  defaultValue?: DateRange
  onChange?: (range: DateRange, compare: DateRange | null, mode: CompareMode) => void
  presets?: DateRangePreset[]
  compare?: boolean
  defaultCompare?: CompareMode
  min?: Date
  max?: Date
  defaultOpen?: boolean
  today?: Date
  className?: string
}

const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromInput = (s: string) => new Date(`${s}T00:00:00`)
const defaultPresets: DateRangePreset[] = [
  { id: 'today', label: 'Today', range: (t) => ({ start: t, end: t }) },
  { id: '7d', label: 'Last 7 days', range: (t) => ({ start: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6), end: t }) },
  { id: '30d', label: 'Last 30 days', range: (t) => ({ start: new Date(t.getFullYear(), t.getMonth(), t.getDate() - 29), end: t }) },
  { id: 'ytd', label: 'Year to date', range: (t) => ({ start: new Date(t.getFullYear(), 0, 1), end: t }) }
]

/** Two-date range picker with presets and comparison, styled as a text field. */
export function DateRangePicker({
  value,
  defaultValue,
  onChange,
  presets = defaultPresets,
  compare = true,
  defaultCompare = 'previous',
  min,
  max,
  defaultOpen = false,
  today,
  className
}: DateRangePickerProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const reference = today ?? new Date()
  const initial = defaultValue ?? presets[2].range(reference)
  const [draft, setDraft] = useState<DateRange>(value ?? initial)
  const [mode, setMode] = useState<CompareMode>(defaultCompare)
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const apply = () => {
    let comparison: DateRange | null = null
    const days = Math.round((draft.end.getTime() - draft.start.getTime()) / 86_400_000)
    if (mode === 'previous') comparison = { start: new Date(draft.start.getFullYear(), draft.start.getMonth(), draft.start.getDate() - days - 1), end: new Date(draft.start.getFullYear(), draft.start.getMonth(), draft.start.getDate() - 1) }
    else if (mode === 'year') comparison = { start: new Date(draft.start.getFullYear() - 1, draft.start.getMonth(), draft.start.getDate()), end: new Date(draft.end.getFullYear() - 1, draft.end.getMonth(), draft.end.getDate()) }
    onChange?.(draft, comparison, mode)
    setOpen(false)
  }

  const label = `${toInput(draft.start)} → ${toInput(draft.end)}`

  return (
    <div ref={rootRef} data-slot="date-range-picker" className={cn('relative w-full', className)}>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`Date range: ${label}`} onClick={() => setOpen((o) => !o)} className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-left text-sm text-foreground hover:border-ring">
        <span className="truncate tabular-nums">{label}</span>
        <span className="flex items-center gap-1 text-muted-foreground"><CalendarRange className="size-3.5" /><ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} /></span>
      </button>
      {open ? (
        <div role="dialog" aria-label="Choose date range" className="absolute top-full left-0 z-50 mt-1 w-[min(30rem,90vw)] rounded-lg border border-border bg-card p-3 shadow-lg">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => setDraft(preset.range(reference))} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted">{preset.label}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="space-y-1 text-[11px] text-muted-foreground">Start
              <input type="date" value={toInput(draft.start)} min={min ? toInput(min) : undefined} max={max ? toInput(max) : undefined} onChange={(e) => { const d = fromInput(e.target.value); if (!Number.isNaN(d.getTime())) setDraft((r) => ({ ...r, start: d })) }} className="block h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">End
              <input type="date" value={toInput(draft.end)} min={toInput(draft.start)} max={max ? toInput(max) : undefined} onChange={(e) => { const d = fromInput(e.target.value); if (!Number.isNaN(d.getTime())) setDraft((r) => ({ ...r, end: d })) }} className="block h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
          </div>
          {compare ? (
            <div className="mt-3">
              <div className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Compare</div>
              <div className="flex gap-1.5">
                {(['off', 'previous', 'year'] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn('flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]', mode === m ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    {m === 'off' ? 'Off' : m === 'previous' ? 'Previous period' : 'Previous year'}
                    {mode === m ? <Check className="size-3" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
            <button type="button" onClick={apply} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">Apply</button>
          </div>
        </div>
      ) : null}
      <span id={`${id}-hint`} className="sr-only">Date range picker</span>
    </div>
  )
}
