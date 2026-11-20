import { RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost as defaultCost } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type CheckpointStatus = 'running' | 'done' | 'failed' | 'stopped'

export interface Checkpoint {
  id: string
  title: string
  icon?: ReactNode
  parent?: string
  status?: CheckpointStatus
  at?: number
  files?: number
  cost?: number
}

export interface AgentCheckpointsProps {
  checkpoints: Checkpoint[]
  head?: string
  onRewind?: (checkpoint: Checkpoint) => void
  task?: string
  formatTime?: (ms: number) => string
  formatCost?: (amount: number) => string
  title?: string
  className?: string
}

const statusTone: Record<CheckpointStatus, AffectTone> = {
  running: 'info',
  done: 'success',
  failed: 'danger',
  stopped: 'neutral'
}

function clock(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** A run replayed as rewindable checkpoints; the path to the head stays bright. */
export function AgentCheckpoints({
  checkpoints,
  head,
  onRewind,
  task,
  formatTime = clock,
  formatCost = defaultCost,
  title = 'Checkpoints',
  className
}: AgentCheckpointsProps) {
  const [focused, setFocused] = useState(0)
  const rows = useRef<Array<HTMLButtonElement | null>>([])
  const headId = head ?? checkpoints[checkpoints.length - 1]?.id

  const onPath = useMemo(() => {
    const path = new Set<string>()
    const byId = new Map(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]))
    let current: string | undefined = headId
    while (current && !path.has(current)) {
      path.add(current)
      current = byId.get(current)?.parent
    }
    return path
  }, [checkpoints, headId])

  const lanes = useMemo(() => {
    const counts = new Map<string, number>()
    const result = new Map<string, number>()
    checkpoints.forEach((checkpoint) => {
      const key = checkpoint.parent ?? '__root__'
      const index = counts.get(key) ?? 0
      counts.set(key, index + 1)
      result.set(checkpoint.id, index)
    })
    return result
  }, [checkpoints])

  const total = checkpoints.reduce((sum, checkpoint) => sum + (checkpoint.cost ?? 0), 0)
  const move = (index: number) => {
    setFocused(index)
    rows.current[index]?.focus()
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-checkpoints">
      <div className="space-y-3 p-3">
        <AffectHeader
          title={title}
          description={task}
          actions={
            <span className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
              {checkpoints.length} checkpoints · {formatCost(total)}
            </span>
          }
        />
        <ol className="space-y-1" role="list" aria-label={title}>
          {checkpoints.map((checkpoint, index) => {
            const status = checkpoint.status ?? 'done'
            const lane = lanes.get(checkpoint.id) ?? 0
            const active = onPath.has(checkpoint.id)
            return (
              <li key={checkpoint.id}>
                <button
                  ref={(node) => { rows.current[index] = node }}
                  type="button"
                  tabIndex={index === focused ? 0 : -1}
                  aria-current={checkpoint.id === headId ? 'step' : undefined}
                  aria-label={`${checkpoint.title}, attempt ${lane + 1}, ${status}${active ? ', current path' : ', left behind'}`}
                  onClick={() => onRewind?.(checkpoint)}
                  onFocus={() => setFocused(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                      event.preventDefault()
                      move(Math.min(checkpoints.length - 1, index + 1))
                    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                      event.preventDefault()
                      move(Math.max(0, index - 1))
                    } else if (event.key === 'Home') {
                      event.preventDefault()
                      move(0)
                    } else if (event.key === 'End') {
                      event.preventDefault()
                      move(checkpoints.length - 1)
                    } else if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRewind?.(checkpoint)
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:border-border',
                    !active && 'opacity-50',
                    checkpoint.id === headId && 'border-border bg-accent'
                  )}
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    {checkpoint.icon ?? <RotateCcw aria-hidden="true" className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">{checkpoint.title}</span>
                    {lane > 0 ? (
                      <span className="text-[10px] text-muted-foreground">Attempt {lane + 1}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {checkpoint.files ? (
                      <span className="text-[10px] text-muted-foreground">{checkpoint.files} files</span>
                    ) : null}
                    {checkpoint.at !== undefined ? (
                      <span className="text-[10px] tabular-nums text-muted-foreground">{formatTime(checkpoint.at)}</span>
                    ) : null}
                    {checkpoint.cost !== undefined ? (
                      <span className="text-[11px] tabular-nums text-foreground">{formatCost(checkpoint.cost)}</span>
                    ) : null}
                    <AffectToneBadge tone={statusTone[status]}>
                      {status === 'stopped' ? 'Stopped' : status[0].toUpperCase() + status.slice(1)}
                    </AffectToneBadge>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        {checkpoints.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No checkpoints yet.</p>
        ) : null}
      </div>
    </AffectSurface>
  )
}
