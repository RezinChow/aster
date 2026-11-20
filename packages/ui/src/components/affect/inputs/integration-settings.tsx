import { Check, ChevronDown, KeyRound } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface } from '../shared'
import { Switch } from './switch'

export interface IntegrationValues {
  enabled: boolean
  siteUrl: string
  timeZone: string
  apiKey: string
}

export interface IntegrationSettingsProps {
  name: string
  logo?: ReactNode
  count?: number
  meta?: string
  defaultValues?: Partial<IntegrationValues>
  siteHint?: string
  timeZones?: string[]
  onGenerateKey?: () => string | Promise<string>
  onSave?: (values: IntegrationValues) => void | Promise<void>
  onToggle?: (enabled: boolean) => void
  className?: string
}

const defaults: IntegrationValues = { enabled: true, siteUrl: '', timeZone: 'UTC', apiKey: '' }

/** Settings card for a connected service with a switch, validated fields and a save bar. */
export function IntegrationSettings({
  name,
  logo,
  count,
  meta,
  defaultValues,
  siteHint = 'The public address of your store.',
  timeZones = ['UTC', '(GMT +01:00) Berlin', '(GMT +08:00) Shanghai', '(GMT -05:00) New York'],
  onGenerateKey,
  onSave,
  onToggle,
  className
}: IntegrationSettingsProps) {
  const id = useId()
  const tzRef = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<IntegrationValues>({ ...defaults, ...defaultValues })
  const [dirty, setDirty] = useState(false)
  const [tzOpen, setTzOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const invalidSite = values.siteUrl.length > 0 && !/^https?:\/\/.+\..+/.test(values.siteUrl) && !/^[\w-]+(\.[\w-]+)+$/.test(values.siteUrl)

  const set = <K extends keyof IntegrationValues>(key: K, value: IntegrationValues[K]) => { setValues((v) => ({ ...v, [key]: value })); setDirty(true) }

  useEffect(() => {
    if (!tzOpen) return
    const onDoc = (e: MouseEvent) => { if (tzRef.current && !tzRef.current.contains(e.target as Node)) setTzOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [tzOpen])

  const generate = async () => {
    const key = onGenerateKey ? await onGenerateKey() : `sk_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
    set('apiKey', key)
    setNotice('New key generated — copy it now.')
  }

  return (
    <AffectSurface data-slot="integration-settings" className={cn('w-full max-w-lg p-4', className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-sm">{logo ?? <KeyRound className="size-4 text-muted-foreground" />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{name}</span>
            {count !== undefined ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{count}</span> : null}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{values.enabled ? meta : 'Integration paused'}</span>
        </span>
        <Switch
          checked={values.enabled}
          onChange={(e) => { set('enabled', e.target.checked); onToggle?.(e.target.checked) }}
          aria-label={`Enable ${name}`}
        />
      </div>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1 text-xs text-foreground">
          <span className="font-medium">Site address</span>
          <input value={values.siteUrl} onChange={(e) => set('siteUrl', e.target.value)} placeholder="example.com" aria-invalid={invalidSite || undefined} aria-describedby={`${id}-site-hint`} className={cn('h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-ring', invalidSite && 'border-destructive bg-destructive/5')} />
          <span id={`${id}-site-hint`} className={cn('block text-[11px]', invalidSite ? 'text-destructive' : 'text-muted-foreground')}>{invalidSite ? 'Enter a valid address, e.g. example.com' : siteHint}</span>
        </label>
        <div ref={tzRef} className="space-y-1 text-xs text-foreground">
          <span className="block font-medium">Time zone</span>
          <button type="button" aria-haspopup="listbox" aria-expanded={tzOpen} onClick={() => setTzOpen((o) => !o)} className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-background px-2.5 text-left text-sm">
            <span className="truncate">{values.timeZone}</span><ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
          {tzOpen ? (
            <div role="listbox" className="max-h-40 overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
              {timeZones.map((zone) => (
                <div key={zone} role="option" aria-selected={zone === values.timeZone} onClick={() => { set('timeZone', zone); setTzOpen(false) }} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent">
                  <span className="flex-1">{zone}</span>{zone === values.timeZone ? <Check className="size-3.5" /> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-1 text-xs text-foreground">
          <span className="flex items-center justify-between font-medium">
            API key
            <button type="button" onClick={() => void generate()} className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground hover:text-foreground"><KeyRound className="size-3" /> Generate new key</button>
          </span>
          <input value={values.apiKey} readOnly placeholder="No key generated" className="h-9 w-full rounded-md border border-border bg-muted px-2.5 font-mono text-xs text-foreground" />
        </div>
      </div>
      {notice ? <p role="status" className="mt-2 text-[11px] text-success">{notice}</p> : null}
      {dirty ? (
        <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
          <button type="button" onClick={() => { setValues({ ...defaults, ...defaultValues }); setDirty(false); setNotice('') }} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">Discard</button>
          <button type="button" onClick={() => { void onSave?.(values); setDirty(false) }} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">Save changes</button>
        </div>
      ) : null}
    </AffectSurface>
  )
}
