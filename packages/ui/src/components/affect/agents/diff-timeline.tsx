import { useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared'

export interface DiffEdit {
  at: number
  file: string
  added: number
  removed: number
  diff?: string[]
}

export interface DiffTimelineProps {
  agent: { id: string; name: string }
  context?: string
  edits: DiffEdit[]
  elapsed?: number
  live?: boolean
  duration?: number
  maxRows?: number
  className?: string
}

function shortCount(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

/** What a coding agent changed, edit by edit, on a time axis. */
export function DiffTimeline({
  agent,
  context,
  edits,
  elapsed,
  live = false,
  duration,
  maxRows = 7,
  className
}: DiffTimelineProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const visible = edits.filter((edit) => edit.at <= (elapsed ?? Infinity))
  const span = Math.max(1, duration ?? Math.ceil(Math.max(1, ...edits.map((edit) => edit.at)) / 60) * 60)
  const peak = Math.max(1, ...edits.map((edit) => Math.max(edit.added, edit.removed)))
  const files = [...new Set(edits.map((edit) => edit.file))]
  const current = selected !== null ? visible[selected] : undefined
  const active = hovered ? visible.find((edit) => edit.file === hovered) : undefined

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); setSelected((i) => Math.min(visible.length - 1, (i ?? -1) + 1)) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setSelected((i) => Math.max(0, (i ?? 0) - 1)) }
    else if (event.key === 'Home') { event.preventDefault(); setSelected(0) }
    else if (event.key === 'End') { event.preventDefault(); setSelected(visible.length - 1) }
    else if (event.key === 'Escape') { event.preventDefault(); setSelected(null) }
  }

  return (
    <div data-slot="diff-timeline" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={agent.name}
          description={context}
          actions={live ? <AffectToneBadge tone="info">Writing…</AffectToneBadge> : <AffectToneBadge tone="neutral">Replay</AffectToneBadge>}
        />

        <div
          role="group"
          aria-label={`Edits by ${agent.name}. Use arrow keys to step through edits.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="mt-3 rounded-md border border-border bg-background p-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="relative mb-1 h-16">
            <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-border" />
            {visible.map((edit, index) => {
              const left = (edit.at / span) * 100
              const selectedHere = selected === index || active?.file === edit.file
              return (
                <button
                  key={`${edit.file}-${edit.at}-${index}`}
                  type="button"
                  aria-label={`${edit.file} at ${edit.at} seconds. ${edit.added} added, ${edit.removed} removed.`}
                  onClick={() => setSelected(index)}
                  className={cn('absolute bottom-0 top-0 w-1.5 -translate-x-1/2 rounded-sm transition-opacity', selectedHere ? 'opacity-100 ring-1 ring-foreground' : 'opacity-70')}
                  style={{ left: `${left}%` }}
                >
                  <span aria-hidden="true" className="absolute bottom-1/2 w-full rounded-t-sm bg-destructive/70" style={{ height: `${(edit.removed / peak) * 45}%` }} />
                  <span aria-hidden="true" className="absolute top-1/2 w-full rounded-b-sm bg-success" style={{ height: `${(edit.added / peak) * 45}%` }} />
                </button>
              )
            })}
            {live ? <span aria-hidden="true" className="absolute -top-1 h-16 w-px animate-pulse bg-info" style={{ left: `${Math.min(100, ((elapsed ?? 0) / span) * 100)}%` }} /> : null}
          </div>
          <div aria-hidden="true" className="flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>0s</span><span>{Math.round(span / 2)}s</span><span>{span}s</span></div>
        </div>

        <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto" style={{ maxHeight: maxRows * 28 }}>
          {files.map((file) => {
            const touches = edits.filter((edit) => edit.file === file)
            const added = touches.reduce((sum, edit) => sum + edit.added, 0)
            const removed = touches.reduce((sum, edit) => sum + edit.removed, 0)
            return (
              <div
                key={file}
                onMouseEnter={() => setHovered(file)}
                onMouseLeave={() => setHovered(null)}
                className={cn('flex items-center gap-2 rounded-md px-2 py-1 text-[11px]', hovered === file && 'bg-muted/60')}
              >
                <span className="min-w-0 flex-1 truncate text-foreground" title={file}>{file}</span>
                <span aria-hidden="true" className="h-1.5 w-16 shrink-0 rounded-full bg-destructive/40"><span className="block h-full rounded-full bg-success" style={{ width: `${(added / Math.max(1, added + removed)) * 100}%` }} /></span>
                <span className="w-10 shrink-0 text-right tabular-nums text-success">+{shortCount(added)}</span>
                <span className="w-10 shrink-0 text-right tabular-nums text-destructive">−{shortCount(removed)}</span>
              </div>
            )
          })}
        </div>

        <p aria-live="polite" className="mt-2 truncate text-[11px] text-muted-foreground">
          {live ? `Working on ${files[files.length - 1] ?? 'the next file'}…` : `${visible.length} edits across ${files.length} files`}
        </p>
        {current ? (
          <div role="dialog" aria-label={`Edit in ${current.file}`} className="mt-2 rounded-md border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between"><span className="truncate text-[11px] font-medium text-foreground">{current.file} · {current.at}s</span><button type="button" aria-label="Close edit" onClick={() => setSelected(null)} className="text-[11px] text-muted-foreground">Close</button></div>
            {(current.diff ?? []).length ? (
              <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-[10px] text-foreground">{current.diff!.join('\n')}</pre>
            ) : <p className="text-[11px] text-muted-foreground">+{current.added} / −{current.removed} lines</p>}
          </div>
        ) : null}
      </AffectSurface>
    </div>
  )
}
