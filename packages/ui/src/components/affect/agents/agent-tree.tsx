import { ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost, formatDuration } from '../shared/format'
import type { AffectStatus } from '../shared/types'
import { AffectStatusDot, AffectToneBadge, affectStatusTone } from '../shared/ui'

export interface TreeAgent {
  id: string
  name: string
  task: string
  model?: string
  avatar?: string
  tools?: string[]
  status: AffectStatus
  ask?: string
  error?: string
  cost?: number
  started?: number
  ended?: number
  children?: TreeAgent[]
}

export interface AgentTreeProps {
  root: TreeAgent
  onSelect?: (agent: TreeAgent) => void
  selectedId?: string
  className?: string
}

function totalCost(agent: TreeAgent): number {
  return (agent.cost ?? 0) + (agent.children ?? []).reduce((sum, child) => sum + totalCost(child), 0)
}

function descendantCount(agent: TreeAgent): number {
  return (agent.children ?? []).reduce((sum, child) => sum + 1 + descendantCount(child), 0)
}

function TreeRow({
  agent,
  depth,
  collapsed,
  onToggle,
  selectedId,
  onSelect
}: {
  agent: TreeAgent
  depth: number
  collapsed: ReadonlySet<string>
  onToggle: (id: string) => void
  selectedId?: string
  onSelect?: (agent: TreeAgent) => void
}) {
  const children = agent.children ?? []
  const isCollapsed = collapsed.has(agent.id)
  const cost = totalCost(agent)
  const elapsed = agent.ended && agent.started ? agent.ended - agent.started : undefined
  const statusLabel: Record<AffectStatus, string> = {
    queued: 'Queued',
    running: 'Running',
    waiting: 'Needs you',
    done: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
    paused: 'Paused'
  }

  return (
    <div role="treeitem" aria-expanded={children.length ? !isCollapsed : undefined} aria-selected={selectedId === agent.id}>
      <div
        tabIndex={0}
        onClick={() => onSelect?.(agent)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect?.(agent)
          }
        }}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:border-border',
          selectedId === agent.id && 'border-border bg-accent'
        )}
        style={{ paddingLeft: `${8 + depth * 18}px` }}
      >
        {children.length ? (
          <button
            type="button"
            aria-label={isCollapsed ? `Expand ${agent.name}` : `Collapse ${agent.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggle(agent.id)
            }}
            className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn('size-3 transition-transform', !isCollapsed && 'rotate-90')} />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <AffectStatusDot status={agent.status} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">{agent.name}</span>
            {agent.model ? (
              <span className="truncate rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                {agent.model}
              </span>
            ) : null}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">{agent.task}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {agent.tools?.length ? (
            <span className="text-[10px] text-muted-foreground">{agent.tools.length} tools</span>
          ) : null}
          {elapsed !== undefined ? (
            <span className="text-[10px] tabular-nums text-muted-foreground">{formatDuration(elapsed)}</span>
          ) : null}
          <span className="text-[11px] tabular-nums text-foreground">{formatCost(cost)}</span>
          <AffectToneBadge tone={affectStatusTone[agent.status]}>{statusLabel[agent.status]}</AffectToneBadge>
        </span>
      </div>
      {!isCollapsed && children.length
        ? children.map((child) => (
            <TreeRow
              key={child.id}
              agent={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

/** A live orchestrator tree with per-branch status, cost rollup and folding. */
export function AgentTree({ root, onSelect, selectedId, className }: AgentTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div data-slot="agent-tree" role="tree" aria-label="Agent tree" className={cn('w-full space-y-0.5', className)}>
      <TreeRow
        agent={root}
        depth={0}
        collapsed={collapsed}
        onToggle={toggle}
        onSelect={onSelect}
        selectedId={selectedId}
      />
      {descendantCount(root) > 0 ? null : (
        <div className="px-2 py-2 text-[11px] text-muted-foreground">No sub-agents yet.</div>
      )}
    </div>
  )
}
