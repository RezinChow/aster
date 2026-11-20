import { ArrowLeft, Check, Search, Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty, AffectSurface } from '../shared'
import { Switch } from '../inputs/switch'

export interface Integration {
  id: string
  name: string
  domain?: string
  category?: string
  description?: string
  features?: string[]
  color?: string
  icon?: ReactNode
  connected?: boolean
}

export interface IntegrationLabels {
  title?: string
  search?: string
  explore?: string
  connect?: string
  disconnect?: string
}

export interface IntegrationPickerProps {
  integrations?: Integration[]
  appName?: string
  appIcon?: ReactNode
  defaultSelected?: string
  onToggle?: (id: string, connected: boolean) => void
  onExplore?: (id: string) => void
  onBack?: () => void
  onClose?: () => void
  labels?: IntegrationLabels
  action?: 'explore' | 'connect'
  className?: string
}

const samples: Integration[] = [
  { id: 'linear', name: 'Linear', domain: 'linear.app', category: 'Productivity', description: 'Track issues and projects.', features: ['Sync issues', 'Create tasks'], color: '#5e6ad2' },
  { id: 'slack', name: 'Slack', domain: 'slack.com', category: 'Communication', description: 'Send updates to channels.', features: ['Notifications', 'Threads'], color: '#4a154b' },
  { id: 'notion', name: 'Notion', domain: 'notion.so', category: 'Docs', description: 'Read and write pages.', features: ['Search', 'Write pages'], color: '#111111' },
  { id: 'github', name: 'GitHub', domain: 'github.com', category: 'Development', description: 'Work with repositories.', features: ['Pull requests', 'Issues'], color: '#24292f' }
]

/** Searchable integrations list with a detail pane and connect/explore actions. */
export function IntegrationPicker({
  integrations = samples,
  appName = 'affectUI',
  appIcon,
  defaultSelected,
  onToggle,
  onExplore,
  onBack,
  onClose,
  labels = {},
  action = 'explore',
  className
}: IntegrationPickerProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(defaultSelected ?? integrations[0]?.id)
  const [connected, setConnected] = useState<Record<string, boolean>>(() => Object.fromEntries(integrations.map((i) => [i.id, Boolean(i.connected)])))
  const selected = integrations.find((i) => i.id === selectedId)
  const filtered = integrations.filter((i) => `${i.name} ${i.domain ?? ''} ${i.category ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  const toggle = (item: Integration) => {
    const next = !connected[item.id]
    setConnected((c) => ({ ...c, [item.id]: next }))
    onToggle?.(item.id, next)
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { if (query) setQuery(''); else onClose?.() }
    else if (event.key === 'ArrowLeft' && !query && onBack) { event.preventDefault(); onBack() }
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      const index = filtered.findIndex((i) => i.id === selectedId)
      const next = filtered[(index + 1) % Math.max(1, filtered.length)]
      if (next) setSelectedId(next.id)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const index = filtered.findIndex((i) => i.id === selectedId)
      const next = filtered[(index - 1 + filtered.length) % Math.max(1, filtered.length)]
      if (next) setSelectedId(next.id)
    }
  }

  return (
    <AffectSurface data-slot="integration-picker" className={cn('w-full max-w-2xl overflow-hidden', className)}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack ? <button type="button" aria-label="Back" onClick={onBack} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft className="size-4" /></button> : null}
        <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">{appIcon ?? <Sparkles className="size-3.5" />}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{labels.title ?? `${appName} + integrations`}</span>
        <div className="relative w-48">
          <Search className="absolute top-2 left-2 size-3.5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKeyDown} aria-label={labels.search ?? 'Search integrations'} placeholder={labels.search ?? 'Search integrations…'} className="h-8 w-full rounded-md border border-border bg-background pr-2 pl-7 text-xs text-foreground outline-none focus:border-ring" />
        </div>
      </div>
      <div className="grid max-h-80 grid-cols-1 overflow-auto sm:grid-cols-[200px_1fr]">
        <div role="listbox" aria-label="Integrations" className="border-b border-border p-1.5 sm:border-r sm:border-b-0">
          {filtered.length === 0 ? <AffectEmpty>No integrations found</AffectEmpty> : null}
          {filtered.map((item) => (
            <div key={item.id} role="option" aria-selected={item.id === selectedId} tabIndex={0} onClick={() => setSelectedId(item.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(item.id) } }} className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs outline-none', item.id === selectedId ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted')}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded text-[10px] text-white" style={{ backgroundColor: item.color ?? '#666' }}>{item.icon ?? item.name.charAt(0)}</span>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {connected[item.id] ? <Check className="size-3 text-success" /> : null}
            </div>
          ))}
        </div>
        {selected ? (
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg text-sm text-white" style={{ backgroundColor: selected.color ?? '#666' }}>{selected.icon ?? selected.name.charAt(0)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{selected.name}</span>
                <span className="block text-[11px] text-muted-foreground">{selected.domain} · {selected.category}</span>
              </span>
              {action === 'explore' ? (
                <Switch checked={Boolean(connected[selected.id])} onChange={() => toggle(selected)} aria-label={`Connect ${selected.name}`} />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{selected.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {(selected.features ?? []).map((feature) => <span key={feature} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{feature}</span>)}
            </div>
            <button
              type="button"
              onClick={() => action === 'explore' ? onExplore?.(selected.id) : toggle(selected)}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
            >
              {action === 'explore' ? (labels.explore ?? 'Explore integration') : connected[selected.id] ? (labels.disconnect ?? 'Disconnect') : (labels.connect ?? 'Connect')}
            </button>
          </div>
        ) : null}
      </div>
      <span id={`${id}-status`} className="sr-only" aria-live="polite">{selected?.name}</span>
    </AffectSurface>
  )
}
