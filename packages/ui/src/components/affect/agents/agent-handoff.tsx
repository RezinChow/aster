import { ArrowRight, FileText, Link2, Lightbulb, GitCommitHorizontal, StickyNote, Undo2 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type HandoffKind = 'file' | 'source' | 'fact' | 'decision' | 'note'
export type TaskStatus = 'todo' | 'working' | 'done' | 'warning'

export interface HandoffAgent { id: string; name: string; model?: string; avatar?: ReactNode; description?: string }
export interface HandoffItem { id: string; label: string; kind?: HandoffKind; lost?: boolean; why?: string }
export interface Handoff { id: string; from: string; to: string; task: string; items: HandoffItem[] }
export interface HandoffTask { id: string; title: string; logo?: ReactNode; status: TaskStatus; agent?: string; note?: string }

export interface AgentHandoffProps {
  agents: HandoffAgent[]
  handoffs?: Handoff[]
  tasks?: HandoffTask[]
  onAssign?: (task: HandoffTask, agent: HandoffAgent) => void
  onRestore?: (handoff: Handoff, item: HandoffItem) => void
  className?: string
}

const kindIcon: Record<HandoffKind, ReactNode> = {
  file: <FileText className="size-3" />, source: <Link2 className="size-3" />,
  fact: <Lightbulb className="size-3" />, decision: <GitCommitHorizontal className="size-3" />,
  note: <StickyNote className="size-3" />
}
const taskTone: Record<TaskStatus, AffectTone> = {
  todo: 'neutral', working: 'info', done: 'success', warning: 'warning'
}

/** A relay of agents with the context each one passed on, including what got lost. */
export function AgentHandoff({ agents, handoffs = [], tasks = [], onAssign, onRestore, className }: AgentHandoffProps) {
  const [pickedTask, setPickedTask] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<string | null>(null)
  const waiting = tasks.filter((task) => task.status === 'todo')

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-handoff">
      <div className="space-y-3 p-3">
        <AffectHeader title="Handoff" description={`${agents.length} agents · ${handoffs.length} handoffs`} />
        {waiting.length ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Waiting tasks</p>
            <div className="flex flex-wrap gap-1">
              {waiting.map((task) => (
                <button key={task.id} type="button" aria-pressed={pickedTask === task.id}
                  aria-label={`Pick up ${task.title} to assign to an agent`}
                  onClick={() => setPickedTask(pickedTask === task.id ? null : task.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPickedTask(pickedTask === task.id ? null : task.id) }
                  }}
                  className={cn('inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    pickedTask === task.id && 'bg-accent')}>
                  {task.logo} <span className="max-w-40 truncate text-foreground">{task.title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <ol role="list" aria-label="Agent relay" className="flex flex-wrap items-start gap-1">
          {agents.map((agent, index) => {
            const arrived = tasks.filter((task) => task.agent === agent.id)
            const outgoing = handoffs.filter((handoff) => handoff.from === agent.id)
            return (
              <li key={agent.id} className="flex items-start gap-1">
                <div className="w-40 shrink-0 space-y-2">
                  <button type="button"
                    aria-label={pickedTask ? `Assign picked task to ${agent.name}` : `${agent.name}, ${agent.model ?? 'agent'}`}
                    onClick={() => {
                      if (pickedTask) {
                        const task = tasks.find((item) => item.id === pickedTask)
                        if (task) onAssign?.(task, agent)
                        setPickedTask(null)
                      }
                    }}
                    className={cn('w-full rounded-md border border-border bg-card p-2 text-left shadow-sm',
                      pickedTask && 'cursor-pointer border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring')}>
                    <span className="flex items-center gap-1.5">
                      {agent.avatar ?? <span aria-hidden="true" className="size-3 rounded-sm bg-foreground" />}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground">{index + 1}</span>
                    </span>
                    {agent.model ? <span className="mt-1 block truncate text-[10px] text-muted-foreground">{agent.model}</span> : null}
                    {agent.description ? <span className="mt-1 block truncate text-[10px] text-muted-foreground">{agent.description}</span> : null}
                    {arrived.map((task) => (
                      <span key={task.id} className="mt-1.5 flex items-center gap-1">
                        <AffectToneBadge tone={taskTone[task.status]}>{task.status}</AffectToneBadge>
                        <span className="min-w-0 truncate text-[10px] text-foreground">{task.title}</span>
                      </span>
                    ))}
                  </button>
                  {outgoing.map((handoff) => (
                    <div key={handoff.id} role="group" aria-label={`Handoff to ${agents.find((a) => a.id === handoff.to)?.name ?? handoff.to}`}
                      className="space-y-1 rounded-md border border-dashed border-border bg-muted/20 p-2">
                      <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                        <ArrowRight aria-hidden="true" className="size-3" /> {handoff.task}
                      </p>
                      <ul role="list" className="space-y-0.5">
                        {handoff.items.map((item) => (
                          <li key={item.id}>
                            <button type="button" aria-expanded={openItem === item.id}
                              aria-label={`${item.label}${item.lost ? ', lost in handoff' : ''}`}
                              onClick={() => setOpenItem(openItem === item.id ? null : item.id)}
                              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpenItem(openItem === item.id ? null : item.id) } }}
                              className={cn('flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[10px] hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                                item.lost && 'text-muted-foreground line-through')}>
                              {kindIcon[item.kind ?? 'note']}
                              <span className="min-w-0 flex-1 truncate">{item.label}</span>
                              {item.lost ? <Undo2 aria-hidden="true" className="size-3" /> : null}
                            </button>
                            {openItem === item.id && item.lost ? (
                              <span className="block px-1 pb-1 text-[10px] text-muted-foreground">
                                {item.why ?? 'Lost in handoff'}
                                {onRestore ? (
                                  <button type="button" onClick={() => onRestore(handoff, item)}
                                    className="ml-1 rounded bg-muted px-1 text-foreground hover:bg-accent">Add back</button>
                                ) : null}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {index < agents.length - 1 ? <ArrowRight aria-hidden="true" className="mt-6 size-4 shrink-0 text-muted-foreground" /> : null}
              </li>
            )
          })}
        </ol>
        {agents.length === 0 ? <AffectEmpty>No agents in the relay.</AffectEmpty> : null}
        <p className="sr-only" aria-live="polite">{pickedTask ? `Picked up ${pickedTask}` : ''}</p>
      </div>
    </AffectSurface>
  )
}
