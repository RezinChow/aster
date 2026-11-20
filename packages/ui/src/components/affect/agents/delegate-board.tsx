import { GripVertical, Sparkles } from 'lucide-react'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectIconButton, AffectSurface, AffectToneBadge, formatCost as defaultFormatCost } from '../shared'

export interface DelegateAgent {
  id: string
  name: string
  model?: string
  avatar?: ReactNode
  current?: number
  rate?: number
}
export interface DelegateTask {
  id: string
  title: string
  estimate: number
  tools?: string[]
  agentId?: string
}
export type DelegateMode = 'auto' | 'manual'

export interface DelegateBoardProps {
  agents: DelegateAgent[]
  tasks: DelegateTask[]
  onAssign?: (taskId: string, agentId: string | null) => void
  mode?: DelegateMode
  defaultMode?: DelegateMode
  onModeChange?: (mode: DelegateMode) => void
  suggestion?: { taskId: string; agentId: string } | null
  now?: number
  title?: string
  formatCost?: (amount: number) => string
  className?: string
}

function clock(offsetMs: number): string {
  return new Date(offsetMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Hand tasks to agents by drag, keyboard or automatic routing. */
export function DelegateBoard({
  agents,
  tasks,
  onAssign,
  mode,
  defaultMode = 'manual',
  onModeChange,
  suggestion,
  now = Date.now(),
  title = 'Delegate',
  formatCost = defaultFormatCost,
  className
}: DelegateBoardProps) {
  const [placement, setPlacement] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, task.agentId]))
  )
  const [modeState, setModeState] = useState<DelegateMode>(defaultMode)
  const [picked, setPicked] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)
  const [announce, setAnnounce] = useState('')
  const currentMode = mode ?? modeState

  const assign = (taskId: string, agentId: string | null) => {
    setPlacement((current) => ({ ...current, [taskId]: agentId ?? undefined }))
    const agent = agents.find((item) => item.id === agentId)
    setAnnounce(agent ? `${taskId} handed to ${agent.name}` : `${taskId} back to unassigned`)
    onAssign?.(taskId, agentId)
    setPicked(null)
  }
  const busyMinutes = (agent: DelegateAgent): number =>
    (agent.current ?? 0) + tasks.filter((task) => placement[task.id] === agent.id).reduce((sum, task) => sum + task.estimate, 0)

  const setMode = (next: DelegateMode) => { setModeState(next); onModeChange?.(next) }

  useEffect(() => {
    if (currentMode !== 'auto') return
    const timer = setInterval(() => {
      const next = tasks.find((task) => !placement[task.id])
      if (!next) return
      const agent = [...agents].sort((a, b) => busyMinutes(a) - busyMinutes(b))[0]
      if (agent) assign(next.id, agent.id)
    }, 800)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode, placement, agents, tasks])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!picked) return
    if (event.key === 'Escape') { event.preventDefault(); setPicked(null); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((i) => Math.min(agents.length - 1, i + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((i) => Math.max(0, i - 1)) }
    else if (/^[1-9]$/.test(event.key)) {
      const agent = agents[Number(event.key) - 1]
      if (agent) { event.preventDefault(); assign(picked, agent.id) }
    } else if (event.key === 'Enter') {
      const agent = agents[highlight]
      if (agent) { event.preventDefault(); assign(picked, agent.id) }
    }
  }
  const taskButton = (task: DelegateTask) => (
    <button
      key={task.id}
      type="button"
      draggable
      aria-label={`${task.title}. ${task.estimate} minutes. Press Enter to pick up.`}
      aria-pressed={picked === task.id}
      onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
      onClick={() => setPicked((current) => (current === task.id ? null : task.id))}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60',
        picked === task.id && 'border-primary bg-accent',
        suggestion?.taskId === task.id && 'ring-1 ring-info'
      )}
    >
      <GripVertical aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{task.estimate}m</span>
    </button>
  )

  const unassigned = tasks.filter((task) => !placement[task.id])

  return (
    <div data-slot="delegate-board" onKeyDown={onKeyDown} className={cn('w-full max-w-[720px]', className)}>
      <AffectSurface className="p-3">
        <AffectHeader
          title={title}
          actions={
            <button
              type="button"
              role="switch"
              aria-checked={currentMode === 'auto'}
              onClick={() => setMode(currentMode === 'auto' ? 'manual' : 'auto')}
              className={cn('inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px]', currentMode === 'auto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              <Sparkles aria-hidden="true" className="size-3" /> Auto
            </button>
          }
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <section aria-label="Unassigned" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); assign(event.dataTransfer.getData('text/plain'), null) }} className="space-y-1.5 rounded-lg border border-dashed border-border p-2">
            <div className="flex items-center justify-between"><h3 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Unassigned</h3><AffectToneBadge tone="neutral">{unassigned.length}</AffectToneBadge></div>
            {unassigned.length ? unassigned.map(taskButton) : <p className="py-4 text-center text-[11px] text-muted-foreground">No tasks waiting.</p>}
          </section>
          <section aria-label="Agents" className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Agents</h3>
            {agents.map((agent, position) => {
              const queue = tasks.filter((task) => placement[task.id] === agent.id)
              const minutes = busyMinutes(agent)
              const cost = queue.reduce((sum, task) => sum + task.estimate * (agent.rate ?? 0), 0)
              return (
                <div
                  key={agent.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); assign(event.dataTransfer.getData('text/plain'), agent.id) }}
                  className={cn('rounded-lg border border-border p-2', suggestion?.agentId === agent.id && 'ring-1 ring-info', picked && position === highlight && 'border-primary')}
                >
                  <div className="flex items-center gap-2">
                    {agent.avatar ? <span className="shrink-0">{agent.avatar}</span> : <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">{agent.name.slice(0, 2)}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><span className="truncate text-xs font-medium text-foreground">{agent.name}</span><span className="text-[10px] text-muted-foreground">{position + 1}</span></div>
                      <div className="truncate text-[10px] text-muted-foreground">{agent.model}{agent.rate !== undefined ? ` · ${formatCost(agent.rate)}/min` : null}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] tabular-nums text-foreground">until {clock(now + minutes * 60_000)}</div>
                      <div className="text-[10px] tabular-nums text-muted-foreground">{formatCost(cost)} queued</div>
                    </div>
                    <AffectIconButton label={`Highlight ${agent.name}`} active={picked !== null && position === highlight} onClick={() => setHighlight(position)}><span className="text-[10px]">◎</span></AffectIconButton>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {queue.slice(0, 3).map((task, i) => (
                      <div key={task.id} className="flex items-center gap-1.5 rounded border border-border bg-background px-2 py-1 text-[11px]">
                        {i === 0 ? <AffectToneBadge tone="info">Running</AffectToneBadge> : null}
                        <span className="min-w-0 flex-1 truncate text-foreground">{task.title}</span>
                        <button type="button" aria-label={`Unassign ${task.title}`} onClick={() => assign(task.id, null)} className="text-[10px] text-muted-foreground hover:text-destructive">×</button>
                      </div>
                    ))}
                    {queue.length > 3 ? <span className="block text-[10px] text-muted-foreground">+{queue.length - 3} more</span> : null}
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
