import { Check, ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { affectToneClass, type AffectTone } from '../shared'

export interface ProjectTask {
  id: string
  label: string
  done?: boolean
  assignee?: string
}

export interface ProjectOption {
  id: string
  label: string
  tone?: 'red' | 'amber' | 'green' | 'blue' | 'violet' | 'gray'
  icon?: ReactNode
}

export interface ProjectMember {
  name: string
  avatar?: ReactNode
}

export interface ProjectCardProps {
  title: string
  tasks: ProjectTask[]
  onTasksChange?: (tasks: ProjectTask[]) => void
  status?: string
  statuses?: ProjectOption[]
  onStatusChange?: (id: string) => void
  due?: string
  members?: ProjectMember[]
  action?: { label: string; onClick: () => void }
  hint?: ReactNode
  trigger?: 'hover' | 'click'
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

const toneMap: Record<NonNullable<ProjectOption['tone']>, AffectTone> = {
  red: 'danger', amber: 'warning', green: 'success', blue: 'info', violet: 'primary', gray: 'neutral'
}
const defaultStatuses: ProjectOption[] = [
  { id: 'todo', label: 'To do', tone: 'gray' },
  { id: 'progress', label: 'In progress', tone: 'blue' },
  { id: 'review', label: 'In review', tone: 'amber' },
  { id: 'done', label: 'Done', tone: 'green' }
]

function ProgressRing({ tasks }: { tasks: ProjectTask[] }) {
  const circumference = 2 * Math.PI * 8
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 shrink-0 -rotate-90">
      <circle cx="10" cy="10" r="8" fill="none" strokeWidth="3" stroke="currentColor" className="text-muted" />
      {tasks.map((task, index) => (
        <circle
          key={task.id}
          cx="10" cy="10" r="8" fill="none" strokeWidth="3" stroke="currentColor"
          strokeDasharray={`${Math.max(1, circumference / tasks.length - 1.5)} ${circumference}`}
          strokeDashoffset={-(circumference / tasks.length) * index}
          className={task.done ? 'text-success' : 'text-muted-foreground/40'}
        />
      ))}
    </svg>
  )
}

/** Two-line project summary that unfolds into subtasks, a member filter and a status picker. */
export function ProjectCard({
  title,
  tasks,
  onTasksChange,
  status,
  statuses = defaultStatuses,
  onStatusChange,
  due,
  members = [],
  action,
  hint,
  trigger = 'hover',
  open,
  defaultOpen = false,
  onOpenChange,
  className
}: ProjectCardProps) {
  const [innerTasks, setInnerTasks] = useState(tasks)
  const [innerStatus, setInnerStatus] = useState(status ?? statuses[0]?.id)
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const currentTasks = onTasksChange ? tasks : innerTasks
  const isOpen = open ?? innerOpen
  const currentStatus = status ?? innerStatus
  const statusOption = statuses.find((item) => item.id === currentStatus) ?? statuses[0]
  const done = currentTasks.filter((task) => task.done).length

  const setOpen = (value: boolean) => {
    if (open === undefined) setInnerOpen(value)
    onOpenChange?.(value)
  }
  const toggleTask = (id: string) => {
    const next = currentTasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    if (onTasksChange) onTasksChange(next)
    else setInnerTasks(next)
  }
  const chooseStatus = (id: string) => {
    if (status === undefined) setInnerStatus(id)
    onStatusChange?.(id)
    setStatusOpen(false)
  }
  const summary = `${title}, ${done} of ${currentTasks} done, ${statusOption?.label ?? ''}${due ? `, due ${due}` : ''}`

  return (
    <div
      data-slot="project-card"
      onMouseEnter={() => trigger === 'hover' && setOpen(true)}
      onMouseLeave={() => trigger === 'hover' && setOpen(false)}
      className={cn('w-full rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={summary}
        onClick={() => setOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setStatusOpen(false)
        }}
        className="flex w-full items-center gap-2 rounded-lg p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProgressRing tasks={currentTasks} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{done}/{currentTasks.length} done{due ? ` · Due ${due}` : ''}</span>
        </span>
        {statusOption ? (
          <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', affectToneClass[toneMap[statusOption.tone ?? 'gray']])}>
            {statusOption.icon}{statusOption.label}
          </span>
        ) : null}
        <ChevronDown aria-hidden="true" className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen ? (
        <div className="space-y-2 border-t border-border px-3 py-2">
          {members.length ? (
            <div role="group" aria-label="Filter by member" className="flex flex-wrap items-center gap-1">
              {members.map((member) => (
                <button
                  key={member.name}
                  type="button"
                  aria-pressed={memberFilter === member.name}
                  onClick={() => setMemberFilter(memberFilter === member.name ? null : member.name)}
                  title={member.name}
                  className={cn('inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground hover:text-foreground', memberFilter === member.name && 'ring-2 ring-ring')}
                >
                  {member.avatar ?? member.name.slice(0, 1)}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="space-y-1">
            {currentTasks
              .filter((task) => !memberFilter || task.assignee === memberFilter)
              .map((task) => (
                <li key={task.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[11px] text-foreground hover:bg-muted/60">
                    <input
                      type="checkbox"
                      checked={task.done === true}
                      onChange={() => toggleTask(task.id)}
                      aria-label={task.label}
                      className="size-3.5 accent-primary"
                    />
                    <span className={cn('min-w-0 flex-1 truncate', task.done && 'text-muted-foreground line-through')}>{task.label}</span>
                    {task.assignee ? <span className="text-[10px] text-muted-foreground">{task.assignee}</span> : null}
                  </label>
                </li>
              ))}
          </ul>
          <div className="flex items-center gap-2 border-t border-border pt-2">
            <div className="relative">
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={statusOpen}
                onClick={() => setStatusOpen((value) => !value)}
                className="rounded border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {statusOption?.label ?? 'Status'}
              </button>
              {statusOpen ? (
                <div role="radiogroup" aria-label="Status" className="absolute bottom-full z-20 mb-1 w-32 rounded-md border border-border bg-card p-1 shadow-lg">
                  {statuses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={item.id === currentStatus}
                      onClick={() => chooseStatus(item.id)}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-foreground hover:bg-muted"
                    >
                      {item.id === currentStatus ? <Check aria-hidden="true" className="size-3" /> : <span className="size-3" />}
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <span className="text-[11px] text-muted-foreground">{hint ?? (done === currentTasks.length ? 'All done' : `${currentTasks.length - done} left`)}</span>
            <span className="flex-1" />
            {action ? (
              <button type="button" onClick={action.onClick} className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground">{action.label}</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
