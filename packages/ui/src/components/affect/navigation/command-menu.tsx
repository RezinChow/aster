import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty } from '../shared'

export interface CommandItem {
  id: string
  label: string
  hint?: string
  logo?: ReactNode
  icon?: ReactNode
  keys?: string
  keywords?: string
}

export interface CommandGroup {
  id: string
  label: string
  commands: CommandItem[]
}

export interface CommandMenuProps {
  groups?: CommandGroup[]
  placeholder?: string
  onRun?: (id: string, query?: string) => void
  onClose?: () => void
  autoFocus?: boolean
  className?: string
}

const defaultGroups: CommandGroup[] = [
  { id: 'suggestions', label: 'Suggestions', commands: [
    { id: 'ask', label: 'Ask the assistant', hint: 'Type a question', icon: <Search className="size-3.5" />, keys: '⌘1' },
    { id: 'new-run', label: 'Start a new run', keys: '⌘2' },
    { id: 'invite', label: 'Invite a teammate', keys: '⌘3' }
  ] },
  { id: 'general', label: 'General', commands: [
    { id: 'settings', label: 'Open settings' },
    { id: 'docs', label: 'Read the docs' }
  ] }
]

/** ⌘K-style command palette with grouped, searchable actions. */
export function CommandMenu({
  groups = defaultGroups,
  placeholder = 'Type a command or search…',
  onRun,
  onClose,
  autoFocus,
  className
}: CommandMenuProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const filtered = groups
    .map((group) => ({ ...group, commands: group.commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(query.toLowerCase())) }))
    .filter((group) => group.commands.length)
  const flat = filtered.flatMap((group) => group.commands)

  const run = (command: CommandItem) => {
    onRun?.(command.id, command.id === 'ask' ? query : undefined)
    setQuery('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { if (query) setQuery(''); else onClose?.(); return }
    if ((event.metaKey || event.ctrlKey) && /^[1-5]$/.test(event.key)) {
      const command = groups.find((g) => g.id === 'suggestions')?.commands[Number(event.key) - 1]
      if (command) { event.preventDefault(); run(command) }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((n) => (n + (event.key === 'ArrowDown' ? 1 : -1) + Math.max(1, flat.length)) % Math.max(1, flat.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (flat[active]) run(flat[active])
      else if (query.trim()) onRun?.('ask', query)
    }
  }

  return (
    <div data-slot="command-menu" className={cn('w-full max-w-[600px] overflow-hidden rounded-xl border border-border bg-card shadow-xl', className)}>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-activedescendant={flat[active] ? `${id}-cmd-${flat[active].id}` : undefined}
          aria-label="Search commands"
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Commands" className="max-h-80 overflow-auto p-2">
        {flat.length === 0 ? <AffectEmpty>No matching commands</AffectEmpty> : null}
        {filtered.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className="mb-1">
            <div className="px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{group.label}</div>
            {group.commands.map((command) => {
              const index = flat.indexOf(command)
              return (
                <div key={command.id} id={`${id}-cmd-${command.id}`} role="option" aria-selected={index === active} onMouseEnter={() => setActive(index)} onClick={() => run(command)} className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-xs text-foreground', index === active && 'bg-accent text-accent-foreground')}>
                  {command.logo ? <span className="flex size-4 shrink-0 items-center justify-center">{command.logo}</span> : command.icon ? <span className="shrink-0 text-muted-foreground">{command.icon}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.hint ? <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{command.hint}</span> : null}
                  {command.keys ? <kbd className="hidden shrink-0 rounded border border-border bg-background px-1 text-[10px] text-muted-foreground sm:inline">{command.keys}</kbd> : null}
                  {index === active ? <CornerDownLeft className="size-3 shrink-0 text-muted-foreground" /> : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
