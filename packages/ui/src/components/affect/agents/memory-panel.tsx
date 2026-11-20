import { Pause, Pencil, Play, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty, AffectHeader, AffectIconButton, AffectSurface, AffectToneBadge } from '../shared'

export interface PanelMemory {
  id: string
  text: string
  category: string
  source?: string
  date?: string
  paused?: boolean
}
export interface MemoryPanelProps {
  memories: PanelMemory[]
  onChange?: (memories: PanelMemory[]) => void
  onAdd?: (memory: PanelMemory) => void
  onEdit?: (id: string, text: string) => void
  onPause?: (id: string, paused: boolean) => void
  onForget?: (id: string) => void
  onRestore?: (memory: PanelMemory) => void
  enabled?: boolean
  defaultEnabled?: boolean
  onEnabledChange?: (enabled: boolean) => void
  categories?: string[]
  title?: string
  maxHeight?: number
  undoFor?: number
  addedSource?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

/** Editable, grouped list of what an assistant remembers about the user. */
export function MemoryPanel({
  memories,
  onChange,
  onAdd,
  onEdit,
  onPause,
  onForget,
  onRestore,
  enabled,
  defaultEnabled = true,
  onEnabledChange,
  categories,
  title = 'Memory',
  maxHeight = 360,
  undoFor = 5000,
  addedSource = 'You added',
  action,
  className
}: MemoryPanelProps) {
  const [list, setList] = useState<PanelMemory[]>(memories)
  const [enabledState, setEnabledState] = useState(defaultEnabled)
  const [filter, setFilter] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [forgotten, setForgotten] = useState<{ memory: PanelMemory; index: number } | null>(null)
  const [announce, setAnnounce] = useState('')
  const items = onChange ? memories : list
  const on = enabled !== undefined ? enabled : enabledState
  const order = categories ?? [...new Set(items.map((memory) => memory.category))]
  const chips = ['All', ...order]
  const shown = items.filter((memory) => (filter === 'All' || memory.category === filter) && (!search || memory.text.toLowerCase().includes(search.toLowerCase())))

  const commit = (next: PanelMemory[]) => { if (!onChange) setList(next); onChange?.(next) }
  const flipEnabled = () => { setEnabledState(!on); onEnabledChange?.(!on); setAnnounce(`Memory ${!on ? 'on' : 'off'}`) }
  const saveEdit = (id: string) => {
    if (!editText.trim()) return
    commit(items.map((memory) => (memory.id === id ? { ...memory, text: editText.trim() } : memory)))
    onEdit?.(id, editText.trim()); setEditingId(null); setAnnounce('Memory saved')
  }
  const togglePause = (memory: PanelMemory) => {
    const paused = !memory.paused
    commit(items.map((item) => (item.id === memory.id ? { ...item, paused } : item)))
    onPause?.(memory.id, paused); setAnnounce(`${paused ? 'Paused' : 'Resumed'} memory`)
  }
  const forget = (memory: PanelMemory) => {
    const index = items.findIndex((item) => item.id === memory.id)
    commit(items.filter((item) => item.id !== memory.id))
    onForget?.(memory.id); setForgotten({ memory, index }); setAnnounce(`Forgotten “${memory.text}”. Undo available.`)
    setTimeout(() => setForgotten((current) => (current?.memory.id === memory.id ? null : current)), undoFor)
  }
  const undoForget = () => {
    if (!forgotten) return
    const next = [...items]
    next.splice(Math.min(forgotten.index, next.length), 0, forgotten.memory)
    commit(next); onRestore?.(forgotten.memory); setAnnounce('Memory restored'); setForgotten(null)
  }
  const addMemory = () => {
    if (!newText.trim()) return
    const memory: PanelMemory = { id: `mem-${Date.now()}`, text: newText.trim(), category: newCategory || order[0] || 'General', source: addedSource, date: new Date().toLocaleDateString() }
    commit([...items, memory]); onAdd?.(memory); setNewOpen(false); setNewText(''); setAnnounce('Memory added')
  }
  const onChipKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const current = chips.indexOf(filter)
      const next = (current + (event.key === 'ArrowRight' ? 1 : -1) + chips.length) % chips.length
      setFilter(chips[next])
      ;(event.currentTarget.querySelectorAll('button')[next] as HTMLButtonElement | undefined)?.focus()
    }
  }

  return (
    <div data-slot="memory-panel" className={cn('w-full max-w-[380px]', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          actions={
            <button type="button" role="switch" aria-checked={on} onClick={flipEnabled} className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px]', on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', on ? 'bg-primary-foreground' : 'bg-muted-foreground')} />Use memory {on ? 'on' : 'off'}
            </button>
          }
        />
        {!on ? <p className="mt-2 rounded-md bg-muted p-2 text-[11px] text-muted-foreground">Memory is off. Nothing is saved or recalled while it's off; existing memories stay here.</p> : null}
        <div role="radiogroup" aria-label="Categories" onKeyDown={onChipKeyDown} className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {chips.map((chip) => (
            <button key={chip} type="button" role="radio" aria-checked={filter === chip} tabIndex={filter === chip ? 0 : -1} onClick={() => setFilter(chip)} className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px]', filter === chip ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>
              {chip}<span className="ml-1 text-[10px] opacity-70">{chip === 'All' ? items.length : items.filter((memory) => memory.category === chip).length}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-md border border-border px-2">
          <Search aria-hidden="true" className="size-3 text-muted-foreground" />
          <input aria-label="Search memories" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearch(''); event.currentTarget.blur() } }} placeholder="Search memories…" className="w-full bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground" />
        </div>

        <div className="mt-2 space-y-2 overflow-y-auto" style={{ maxHeight }}>
          {order.filter((category) => filter === 'All' || filter === category).map((category) => {
            const group = shown.filter((memory) => memory.category === category)
            if (!group.length) return null
            return (
              <section key={category} aria-label={category}>
                <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{category}</h3>
                <div className="space-y-1">
                  {group.map((memory) => (
                    <div key={memory.id} className={cn('group rounded-md border border-border p-2', memory.paused && 'opacity-60')}>
                      {editingId === memory.id ? (
                        <>
                          <textarea autoFocus aria-label="Edit memory" value={editText} onChange={(event) => setEditText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); saveEdit(memory.id) } else if (event.key === 'Escape') setEditingId(null) }} rows={2} className="w-full resize-none rounded border border-border bg-background p-1.5 text-xs text-foreground outline-none focus:border-ring" />
                          <div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground">Cancel</button><button type="button" onClick={() => saveEdit(memory.id)} className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">Save</button></div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-foreground">{memory.text}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{memory.source}{memory.date ? ` · ${memory.date}` : ''}</span>
                            {memory.paused ? <AffectToneBadge tone="warning">Paused</AffectToneBadge> : null}
                            <span className="ml-auto flex items-center gap-0.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                              <AffectIconButton label={`Edit “${memory.text}”`} onClick={() => { setEditingId(memory.id); setEditText(memory.text) }}><Pencil aria-hidden="true" className="size-3" /></AffectIconButton>
                              <AffectIconButton label={`${memory.paused ? 'Resume' : 'Pause'} “${memory.text}”`} onClick={() => togglePause(memory)}>{memory.paused ? <Play aria-hidden="true" className="size-3" /> : <Pause aria-hidden="true" className="size-3" />}</AffectIconButton>
                              <AffectIconButton label={`Forget “${memory.text}”`} onClick={() => forget(memory)}><Trash2 aria-hidden="true" className="size-3" /></AffectIconButton>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
          {shown.length === 0 ? <AffectEmpty>No memories here yet.</AffectEmpty> : null}
          {newOpen ? (
            <div className="rounded-md border border-border p-2">
              <textarea autoFocus aria-label="New memory" value={newText} onChange={(event) => setNewText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addMemory() } else if (event.key === 'Escape') setNewOpen(false) }} placeholder="What should the assistant remember?" rows={2} className="w-full resize-none rounded border border-border bg-background p-1.5 text-xs text-foreground outline-none" />
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {order.map((category) => <button key={category} type="button" onClick={() => setNewCategory(category)} className={cn('rounded-full px-1.5 py-0.5 text-[10px]', (newCategory || order[0]) === category ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{category}</button>)}
                <button type="button" onClick={() => setNewOpen(false)} className="ml-auto text-[10px] text-muted-foreground">Cancel</button>
                <button type="button" disabled={!newText.trim()} onClick={addMemory} className="rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground disabled:opacity-40">Add</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <button type="button" onClick={() => { setNewOpen(true); setNewCategory(order[0] ?? '') }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"><Plus aria-hidden="true" className="size-3" />New memory</button>
          {forgotten ? <button type="button" onClick={undoForget} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] text-accent-foreground"><RotateCcw aria-hidden="true" className="size-3" />Undo</button> : action ? <button type="button" onClick={action.onClick} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">{action.label}</button> : null}
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
