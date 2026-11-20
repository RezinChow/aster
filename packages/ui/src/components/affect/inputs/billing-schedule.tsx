import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface, formatCost } from '../shared'

export type ScheduleRepeat = 'once' | 'monthly' | 'yearly'

export interface CatalogItem {
  name: string
  repeat: ScheduleRepeat
  price: number
}

export interface ScheduleLine {
  id: string
  name: string
  quantity: number
  repeat: ScheduleRepeat
  price: number
}

export interface BillingScheduleValue {
  phase: string
  start: string
  duration: number
  lines: ScheduleLine[]
  discount: number
  minimum: number
}

export interface BillingScheduleProps {
  title?: string
  phase?: string
  currency?: string
  catalog?: CatalogItem[]
  defaultLines?: ScheduleLine[]
  defaultStart?: string
  onChange?: (schedule: BillingScheduleValue) => void
  className?: string
}

const repeatLabel: Record<ScheduleRepeat, string> = { once: 'Once', monthly: 'Monthly', yearly: 'Yearly' }

function RepeatCell({ value, onChange }: { value: ScheduleRepeat; onChange: (next: ScheduleRepeat) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded px-1 text-foreground hover:bg-muted">{repeatLabel[value]}</button>
      {open ? (
        <div role="listbox" className="absolute left-0 z-10 mt-1 w-24 rounded-md border border-border bg-card p-1 shadow-lg">
          {(Object.keys(repeatLabel) as ScheduleRepeat[]).map((key) => (
            <div key={key} role="option" aria-selected={key === value} onClick={() => { onChange(key); setOpen(false) }} className="cursor-pointer rounded px-2 py-1 text-xs text-foreground hover:bg-accent">{repeatLabel[key]}</div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Builder for one billing phase with catalog lines, discount, minimum and live totals. */
export function BillingSchedule({
  title = 'Create a billing schedule',
  phase = 'Build-out phase',
  currency = '$',
  catalog = [],
  defaultLines = [],
  defaultStart = '2026-01-01',
  onChange,
  className
}: BillingScheduleProps) {
  const [value, setValue] = useState<BillingScheduleValue>({ phase, start: defaultStart, duration: 12, lines: defaultLines, discount: 0, minimum: 0 })
  const [catalogOpen, setCatalogOpen] = useState(false)
  const catalogRef = useRef<HTMLDivElement>(null)

  const update = (changes: Partial<BillingScheduleValue>) => {
    setValue((current) => { const next = { ...current, ...changes }; onChange?.(next); return next })
  }
  const patchLine = (id: string, changes: Partial<ScheduleLine>) => update({ lines: value.lines.map((l) => l.id === id ? { ...l, ...changes } : l) })
  const addItem = (item: CatalogItem) => {
    update({ lines: [...value.lines, { id: `${Date.now()}`, ...item, quantity: 1 }] })
    setCatalogOpen(false)
  }

  useEffect(() => {
    if (!catalogOpen) return
    const onDoc = (e: MouseEvent) => { if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) setCatalogOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [catalogOpen])

  const subtotal = value.lines.reduce((sum, line) => sum + line.price * line.quantity * (line.repeat === 'yearly' ? Math.ceil(value.duration / 12) : line.repeat === 'monthly' ? value.duration : 1), 0)
  const discounted = subtotal * (1 - value.discount / 100)
  const total = Math.max(value.minimum, discounted)

  const inputClass = 'h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring'

  return (
    <AffectSurface data-slot="billing-schedule" className={cn('w-full max-w-[560px] space-y-4 p-4', className)}>
      <div>
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <input aria-label="Phase name" value={value.phase} onChange={(e) => update({ phase: e.target.value })} className={cn(inputClass, 'mt-2 w-full font-medium')} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 text-[11px] text-muted-foreground">Start date
          <input type="date" value={value.start} onChange={(e) => update({ start: e.target.value })} className={cn(inputClass, 'w-full')} />
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">Duration (months)
          <input type="number" min={1} value={value.duration} onChange={(e) => update({ duration: Math.max(1, Number(e.target.value)) })} className={cn(inputClass, 'w-full tabular-nums')} />
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">Discount (%)
          <input type="number" min={0} max={100} value={value.discount} onChange={(e) => update({ discount: Math.min(100, Math.max(0, Number(e.target.value))) })} className={cn(inputClass, 'w-full tabular-nums')} />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b border-border text-[10px] tracking-wide text-muted-foreground uppercase"><th className="py-1.5">Product</th><th>Qty</th><th>Repeats</th><th className="text-right">Price</th><th /></tr></thead>
          <tbody>
            {value.lines.map((line) => (
              <tr key={line.id} className="border-b border-border/60">
                <td className="py-1.5 pr-2"><input aria-label={`Name for ${line.name}`} value={line.name} onChange={(e) => patchLine(line.id, { name: e.target.value })} className="w-full min-w-24 bg-transparent text-foreground outline-none" /></td>
                <td className="pr-2"><input type="number" min={1} aria-label={`Quantity for ${line.name}`} value={line.quantity} onChange={(e) => patchLine(line.id, { quantity: Math.max(1, Number(e.target.value)) })} className="w-12 bg-transparent tabular-nums text-foreground outline-none" /></td>
                <td className="pr-2">
                  <RepeatCell value={line.repeat} onChange={(repeat) => patchLine(line.id, { repeat })} />
                </td>
                <td className="pr-2 text-right"><input type="number" min={0} aria-label={`Price for ${line.name}`} value={line.price} onChange={(e) => patchLine(line.id, { price: Math.max(0, Number(e.target.value)) })} className="w-16 bg-transparent text-right tabular-nums text-foreground outline-none" /></td>
                <td className="text-right"><button type="button" aria-label={`Remove ${line.name}`} onClick={() => update({ lines: value.lines.filter((l) => l.id !== line.id) })} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div ref={catalogRef} className="relative inline-block">
        <button type="button" aria-haspopup="listbox" aria-expanded={catalogOpen} onClick={() => setCatalogOpen((o) => !o)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground hover:bg-muted"><Plus className="size-3.5" /> Add product <ChevronDown className="size-3 text-muted-foreground" /></button>
        {catalogOpen ? (
          <div role="listbox" className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-md border border-border bg-card p-1 shadow-lg">
            {catalog.length === 0 ? <div className="px-2 py-2 text-[11px] text-muted-foreground">No products in catalog</div> : null}
            {catalog.map((item, i) => (
              <div key={`${item.name}-${i}`} role="option" onClick={() => addItem(item)} className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-xs text-foreground hover:bg-accent">
                <span>{item.name}<span className="ml-1 text-[10px] text-muted-foreground">{repeatLabel[item.repeat]}</span></span>
                <span className="tabular-nums text-muted-foreground">{formatCost(item.price, currency)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
        <label className="space-y-1 text-[11px] text-muted-foreground">Minimum commitment
          <input type="number" min={0} value={value.minimum} onChange={(e) => update({ minimum: Math.max(0, Number(e.target.value)) })} className={cn(inputClass, 'w-28 tabular-nums')} />
        </label>
        <div className="text-right" aria-live="polite">
          <div className="text-[10px] text-muted-foreground">Subtotal {formatCost(subtotal, currency)} · discount {value.discount}%</div>
          <div className="text-sm font-medium text-foreground">Total {formatCost(total, currency)}</div>
        </div>
      </div>
    </AffectSurface>
  )
}
