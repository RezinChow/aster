import { FileText, Link2, Plus, Trash2 } from 'lucide-react'
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, formatRelativeTime } from '../shared'

export interface MemoryArtifact { name: string; kind?: string; logo?: ReactNode; href?: string }
export interface Memory {
  id: string
  text: string
  source?: string
  tag?: string
  artifact?: MemoryArtifact
  via?: string
  replaces?: string
  outdated?: boolean
  related?: string[]
  learned?: number
  uses?: number
  disabled?: boolean
}
export interface MemoryTool {
  id: string
  name: string
  logo?: ReactNode
  access?: string
  scope?: string
  note?: string
  used?: number
  calls?: number
  disabled?: boolean
}
export interface MemoryGraphProps {
  agent: { id: string; name: string; subtitle?: string; logo?: ReactNode }
  memories: Memory[]
  tools: MemoryTool[]
  using?: string[]
  recalling?: string[]
  onToggle?: (kind: 'memory' | 'tool', id: string, enabled: boolean) => void
  onForget?: (memory: Memory) => void
  catalog?: MemoryTool[]
  onAddTool?: (tool: MemoryTool) => void
  onAddFiles?: (files: FileList | null) => void
  onSelect?: (memory: Memory | null) => void
  title?: string
  now?: number
  formatDate?: (ms: number) => string
  className?: string
}

/** What an agent remembers and the tools it can reach, around it in a ring. */
export function MemoryGraph({
  agent,
  memories,
  tools,
  using = [],
  recalling = [],
  onToggle,
  onForget,
  catalog = [],
  onAddTool,
  onAddFiles,
  onSelect,
  title = 'What I know',
  now = Date.now(),
  formatDate = (ms) => new Date(ms).toLocaleDateString(),
  className
}: MemoryGraphProps) {
  const [disabled, setDisabled] = useState<ReadonlySet<string>>(() => new Set([...memories, ...tools].filter((item) => item.disabled).map((item) => item.id)))
  const [selected, setSelected] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [side, setSide] = useState<'memories' | 'tools'>('memories')
  const [focusIndex, setFocusIndex] = useState(0)
  const [announce, setAnnounce] = useState('')
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const isOff = (id: string) => disabled.has(id)
  const toggle = (kind: 'memory' | 'tool', id: string) => {
    const enabled = isOff(id)
    setDisabled((current) => { const next = new Set(current); if (enabled) next.delete(id); else next.add(id); return next })
    onToggle?.(kind, id, enabled)
    setAnnounce(`${id} ${enabled ? 'enabled' : 'disabled'}`)
  }
  const move = (nextSide: 'memories' | 'tools', delta: number) => {
    const list = nextSide === 'memories' ? memories : tools
    if (!list.length) return
    const next = Math.min(list.length - 1, Math.max(0, focusIndex + delta))
    setFocusIndex(next); setSide(nextSide)
    refs.current[list[next].id]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { setSelected(null); setShowAdd(false); onSelect?.(null); return }
    const list = side === 'memories' ? memories : tools
    if (event.key === 'ArrowDown') { event.preventDefault(); move(side, 1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(side, -1) }
    else if (event.key === 'Home') { event.preventDefault(); setFocusIndex(0); refs.current[list[0]?.id]?.focus() }
    else if (event.key === 'End') { event.preventDefault(); setFocusIndex(list.length - 1); refs.current[list[list.length - 1]?.id]?.focus() }
    else if (event.key === 'ArrowRight' && side === 'memories') { event.preventDefault(); setFocusIndex(0); refs.current[tools[0]?.id]?.focus() }
    else if (event.key === 'ArrowLeft' && side === 'tools') { event.preventDefault(); setFocusIndex(0); refs.current[memories[0]?.id]?.focus() }
  }
  const openMemory = (memory: Memory) => { setSelected((current) => (current === memory.id ? null : memory.id)); onSelect?.(selected === memory.id ? null : memory) }

  const shownMemories = memories.slice(0, 6)
  const shownTools = tools.slice(0, 6)
  const selectedMemory = memories.find((memory) => memory.id === selected)
  const selectedTool = tools.find((tool) => tool.id === selected)

  return (
    <div data-slot="memory-graph" onKeyDown={onKeyDown} className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={`${memories.length} memories · ${tools.length} tools`} />
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div role="group" aria-label="Memories" className="space-y-1.5">
            {shownMemories.map((memory, index) => (
              <button
                key={memory.id}
                ref={(el) => { refs.current[memory.id] = el }}
                type="button"
                tabIndex={side === 'memories' && focusIndex === index ? 0 : -1}
                onFocus={() => { setSide('memories'); setFocusIndex(index) }}
                onClick={() => openMemory(memory)}
                aria-label={`Memory: ${memory.text}. ${memory.source ?? ''}${memory.outdated ? '. Outdated' : ''}${isOff(memory.id) ? '. Switched off' : ''}${recalling.includes(memory.id) ? '. Recalled now' : ''}`}
                className={cn('w-full rounded-md border border-border p-2 text-left transition-opacity hover:bg-muted/60', isOff(memory.id) && 'opacity-50', recalling.includes(memory.id) && 'ring-1 ring-info', selected === memory.id && 'bg-accent')}
              >
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><FileText aria-hidden="true" className="size-3" />{memory.artifact?.name ?? memory.tag ?? 'Memory'}</span>
                <span className="mt-0.5 block truncate text-xs text-foreground">{memory.text}</span>
                {memory.outdated ? <AffectToneBadge tone="warning" className="mt-1">Outdated</AffectToneBadge> : null}
              </button>
            ))}
            {memories.length > 6 ? <span className="block text-[10px] text-muted-foreground">+{memories.length - 6} more</span> : null}
          </div>

          <div className="flex items-center justify-center">
            <button type="button" aria-label={`${agent.name}. Add memories or connect tools.`} aria-expanded={showAdd} onClick={() => setShowAdd((current) => !current)} className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-muted p-2 text-center hover:bg-accent">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">{agent.logo ?? <span className="text-xs">{agent.name.slice(0, 1)}</span>}</span>
              <span className="truncate text-[11px] font-medium text-foreground">{agent.name}</span>
              <span className="line-clamp-2 text-[9px] text-muted-foreground">{using.length ? `Using ${using.join(', ')}` : recalling.length ? `Recalling ${recalling.length} memories` : agent.subtitle ?? 'Idle'}</span>
            </button>
          </div>

          <div role="group" aria-label="Tools" className="space-y-1.5">
            {shownTools.map((tool, index) => (
              <button
                key={tool.id}
                ref={(el) => { refs.current[tool.id] = el }}
                type="button"
                tabIndex={side === 'tools' && focusIndex === index ? 0 : -1}
                onFocus={() => { setSide('tools'); setFocusIndex(index) }}
                onClick={() => setSelected((current) => (current === tool.id ? null : tool.id))}
                aria-label={`Tool: ${tool.name}. ${tool.access ?? 'Access'}. ${isOff(tool.id) ? 'Switched off' : ''}${using.includes(tool.id) ? '. In use now' : ''}`}
                className={cn('w-full rounded-md border border-border p-2 text-left transition-opacity hover:bg-muted/60', isOff(tool.id) && 'opacity-50', using.includes(tool.id) && 'ring-1 ring-info', selected === tool.id && 'bg-accent')}
              >
                <span className="flex items-center gap-1.5 text-xs"><span className="shrink-0 text-muted-foreground">{tool.logo ?? tool.name.slice(0, 1)}</span><span className="min-w-0 flex-1 truncate font-medium text-foreground">{tool.name}</span></span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{tool.access ?? 'Access'}{tool.scope ? ` · ${tool.scope}` : ''}</span>
              </button>
            ))}
            {tools.length > 6 ? <span className="block text-[10px] text-muted-foreground">+{tools.length - 6} more</span> : null}
          </div>
        </div>

        {showAdd ? (
          <div role="dialog" aria-label="Add memories or tools" className="mt-3 rounded-md border border-border bg-background p-2.5">
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-medium text-foreground">Add</span><button type="button" aria-label="Close add" onClick={() => setShowAdd(false)} className="text-[11px] text-muted-foreground">Close</button></div>
            <label className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2 text-[11px] text-muted-foreground"><Plus aria-hidden="true" className="size-3" />Drop files here<button type="button" onClick={() => { onAddFiles?.(null); setAnnounce('Files added') }} className="ml-auto rounded bg-muted px-1.5 py-0.5 text-foreground">Add files</button></label>
            {catalog.length ? <div className="mt-2 space-y-1">{catalog.map((tool) => <button key={tool.id} type="button" onClick={() => { onAddTool?.(tool); setAnnounce(`Connected ${tool.name}`) }} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted/60"><span className="text-muted-foreground">{tool.logo ?? <Link2 aria-hidden="true" className="size-3" />}</span>Connect {tool.name}</button>)}</div> : null}
          </div>
        ) : null}

        {selectedMemory ? (
          <div role="dialog" aria-label={`${selectedMemory.text} details`} className="mt-3 rounded-md border border-border bg-background p-2.5 text-[11px]">
            <div className="flex items-center justify-between"><span className="font-medium text-foreground">Memory</span><button type="button" aria-label="Close details" onClick={() => { setSelected(null); onSelect?.(null) }} className="text-muted-foreground">Close</button></div>
            <p className="mt-1 text-foreground">{selectedMemory.text}</p>
            {selectedMemory.source ? <p className="mt-1 text-muted-foreground">Source: {selectedMemory.source}</p> : null}
            {selectedMemory.artifact?.href ? <a href={selectedMemory.artifact.href} className="mt-1 inline-block text-info underline">Open {selectedMemory.artifact.name}</a> : null}
            <p className="mt-1 text-muted-foreground">{selectedMemory.learned ? `Learned ${formatDate(selectedMemory.learned)}` : 'Learned date unknown'}{selectedMemory.uses !== undefined ? ` · used ${selectedMemory.uses}×` : ''}</p>
            <div className="mt-2 flex gap-2">
              {onToggle ? <button type="button" role="switch" aria-checked={!isOff(selectedMemory.id)} onClick={() => toggle('memory', selectedMemory.id)} className={cn('rounded-md border border-border px-2 py-1', isOff(selectedMemory.id) ? 'text-muted-foreground' : 'bg-primary text-primary-foreground')}>{isOff(selectedMemory.id) ? 'Off' : 'On'}</button> : null}
              {onForget ? <button type="button" onClick={() => { onForget(selectedMemory); setAnnounce('Memory forgotten'); setSelected(null) }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-destructive hover:bg-destructive/10"><Trash2 aria-hidden="true" className="size-3" />Forget</button> : null}
            </div>
          </div>
        ) : null}
        {selectedTool ? (
          <div role="dialog" aria-label={`${selectedTool.name} details`} className="mt-3 rounded-md border border-border bg-background p-2.5 text-[11px]">
            <div className="flex items-center justify-between"><span className="font-medium text-foreground">{selectedTool.name}</span><button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="text-muted-foreground">Close</button></div>
            <p className="mt-1 text-muted-foreground">{selectedTool.access ?? 'Access'}{selectedTool.scope ? ` · ${selectedTool.scope}` : ''}</p>
            {selectedTool.note ? <p className="mt-1 text-foreground">{selectedTool.note}</p> : null}
            <p className="mt-1 text-muted-foreground">{selectedTool.used ? `Last used ${formatRelativeTime(selectedTool.used, now)}` : 'Not used yet'}{selectedTool.calls !== undefined ? ` · ${selectedTool.calls} calls` : ''}</p>
            {onToggle ? <button type="button" role="switch" aria-checked={!isOff(selectedTool.id)} onClick={() => toggle('tool', selectedTool.id)} className={cn('mt-2 rounded-md border border-border px-2 py-1', isOff(selectedTool.id) ? 'text-muted-foreground' : 'bg-primary text-primary-foreground')}>{isOff(selectedTool.id) ? 'Off' : 'On'}</button> : null}
          </div>
        ) : null}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
