import { Check, ChevronDown, Pencil, X } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter } from '../shared'

export interface SetupTask {
  id: string
  label: string
  done?: boolean
}

export interface SetupGroup {
  id: string
  title: string
  tasks: SetupTask[]
}

export interface SetupGuideProps {
  groups: SetupGroup[]
  title?: string
  onEdit?: () => void
  onClose?: () => void
  onChange?: (done: string[]) => void
  className?: string
}

/** An onboarding panel with collapsible groups that strike through when done. */
export function SetupGuide({ groups, title = 'Setup guide', onEdit, onClose, onChange, className }: SetupGuideProps) {
  const [state, setState] = useState<SetupGroup[]>(() => groups.map((group) => ({
    ...group,
    tasks: group.tasks.map((task) => ({ ...task }))
  })))
  const [folded, setFolded] = useState<string[]>([])
  const all = state.flatMap((group) => group.tasks)
  const doneIds = all.filter((task) => task.done).map((task) => task.id)

  const toggle = (taskId: string) => {
    setState((current) => {
      const next = current.map((group) => ({
        ...group,
        tasks: group.tasks.map((task) => task.id === taskId ? { ...task, done: !task.done } : task)
      }))
      onChange?.(next.flatMap((group) => group.tasks).filter((task) => task.done).map((task) => task.id))
      return next
    })
  }

  return (
    <div
      data-slot="setup-guide"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{title}</span>
          <span className="flex shrink-0 items-center gap-0.5">
            {onEdit ? (
              <button type="button" aria-label="Edit setup" onClick={onEdit} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
            {onClose ? (
              <button type="button" aria-label="Close setup guide" onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <AffectMeter value={doneIds.length} max={Math.max(1, all.length)} label="Setup progress" tone="success" className="h-1.5" />
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{doneIds.length}/{all.length}</span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {state.map((group) => {
          const isFolded = folded.includes(group.id)
          const groupDone = group.tasks.filter((task) => task.done).length
          return (
            <div key={group.id}>
              <button
                type="button"
                aria-expanded={!isFolded}
                onClick={() => setFolded((current) => isFolded ? current.filter((id) => id !== group.id) : [...current, group.id])}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <ChevronDown aria-hidden="true" className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', isFolded && '-rotate-90')} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{group.title}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{groupDone}/{group.tasks.length}</span>
              </button>
              {!isFolded ? (
                <ul className="space-y-0.5 px-3 pb-2">
                  {group.tasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        aria-pressed={!!task.done}
                        onClick={() => toggle(task.id)}
                        className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60"
                      >
                        <span aria-hidden="true" className={cn(
                          'flex size-3.5 shrink-0 items-center justify-center rounded-full border',
                          task.done ? 'border-success bg-success text-white' : 'border-border text-transparent'
                        )}>
                          <Check className="size-2.5" />
                        </span>
                        <span className={cn('truncate text-xs', task.done ? 'text-muted-foreground line-through' : 'text-foreground')}>{task.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
