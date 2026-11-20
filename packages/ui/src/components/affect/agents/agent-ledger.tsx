import { Redo2, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatRelativeTime } from '../shared/format'
import { AffectEmpty, AffectHeader, AffectRow, AffectSurface, AffectToneBadge } from '../shared/ui'

export interface LedgerEntry {
  id: string
  action: string
  system: string
  at: number
  target?: string
  icon?: ReactNode
  change?: [string, string]
  detail?: string
  reversible?: boolean
  dependsOn?: string[]
}
export interface AgentLedgerProps {
  entries: LedgerEntry[]
  agent?: string
  now?: number
  undone?: string[]
  defaultUndone?: string[]
  onUndo?: (ids: string[]) => void
  onRedo?: (ids: string[]) => void
  pointAt?: string | null
  title?: string
  className?: string
}

/** Every change an agent made, each with an undo that names what goes with it. */
export function AgentLedger({
  entries, agent, now, undone, defaultUndone = [], onUndo, onRedo, pointAt,
  title = 'Ledger', className
}: AgentLedgerProps) {
  const [localUndone, setLocalUndone] = useState<string[]>(defaultUndone)
  const [pointed, setPointed] = useState<string | null>(null)
  const undoneIds = undone ?? localUndone
  const highlight = pointAt ?? pointed
  const sorted = useMemo(() => [...entries].sort((a, b) => b.at - a.at), [entries])
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries])

  const dependents = (id: string): string[] => {
    const ids: string[] = []
    const visit = (current: string) => {
      entries.forEach((entry) => {
        if (entry.dependsOn?.includes(current) && !ids.includes(entry.id)) {
          ids.push(entry.id)
          visit(entry.id)
        }
      })
    }
    visit(id)
    return ids.filter((entryId) => byId.get(entryId)?.reversible !== false)
  }
  const related = (id: string) => [id, ...dependents(id)]
  const isUndone = (id: string) => undoneIds.includes(id)
  const blocked = (entry: LedgerEntry) =>
    entry.reversible !== false && (entry.dependsOn ?? []).some((id) => isUndone(id))

  const setUndone = (ids: string[], value: boolean) => {
    if (undone === undefined) {
      setLocalUndone((current) => value
        ? [...new Set([...current, ...ids])]
        : current.filter((id) => !ids.includes(id)))
    }
    if (value) onUndo?.(ids)
    else onRedo?.(ids)
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-ledger">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={agent ? `By ${agent}` : undefined} />
        {sorted.length ? (
          <ol role="list" aria-label={`${title}, newest first`} className="space-y-1.5">
            {sorted.map((entry) => {
              const group = related(entry.id)
              const isHighlighted = highlight !== null && group.includes(highlight)
              const undoneEntry = isUndone(entry.id)
              return (
                <li key={entry.id} className={cn('rounded-md border border-border px-2 py-1.5',
                  undoneEntry && 'opacity-60', isHighlighted && 'border-warning bg-warning-subtle')}>
                  <AffectRow
                    icon={entry.icon ?? <span aria-hidden="true" className="size-3 rounded-sm bg-muted-foreground" />}
                    title={<span className={cn(undoneEntry && 'line-through')}>{entry.action}</span>}
                    subtitle={`${entry.system}${entry.target ? ` · ${entry.target}` : ''}`}
                    trailing={<span className="flex items-center gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{formatRelativeTime(entry.at, now)}</span>
                      {entry.reversible === false ? (
                        <AffectToneBadge tone="danger">{blocked(entry) ? "Can't undo" : 'Permanent'}</AffectToneBadge>
                      ) : undoneEntry ? (
                        <button type="button" aria-label={`Redo ${entry.action}`}
                          onClick={() => setUndone(group, false)} onFocus={() => setPointed(entry.id)} onBlur={() => setPointed(null)}
                          className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <Redo2 aria-hidden="true" className="size-3" /> Redo
                        </button>
                      ) : (
                        <button type="button" aria-label={`Undo ${entry.action}, ${dependents(entry.id).length} dependent changes`}
                          onClick={() => setUndone(group, true)} onFocus={() => setPointed(entry.id)} onBlur={() => setPointed(null)}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setUndone(group, true) } }}
                          className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <Undo2 aria-hidden="true" className="size-3" /> Undo{dependents(entry.id).length ? ` +${dependents(entry.id).length}` : ''}
                        </button>
                      )}
                    </span>}
                  />
                  {entry.change ? (
                    <p className="mt-1 pl-5 text-[11px] text-muted-foreground">
                      <span className="line-through">{entry.change[0]}</span> <span aria-label="to">→</span> <span className="text-foreground">{entry.change[1]}</span>
                    </p>
                  ) : entry.detail ? (
                    <p className="mt-1 pl-5 text-[11px] text-muted-foreground">{entry.detail}</p>
                  ) : null}
                  {isHighlighted && dependents(entry.id).length ? (
                    <p className="mt-1 pl-5 text-[10px] text-warning-subtle-foreground">
                      Undoing this also undoes {dependents(entry.id).length} change{dependents(entry.id).length === 1 ? '' : 's'} that build on it.
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : <AffectEmpty>No changes yet.</AffectEmpty>}
      </div>
    </AffectSurface>
  )
}
