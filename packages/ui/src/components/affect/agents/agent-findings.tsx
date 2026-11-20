import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { formatRelativeTime } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectMeter, AffectSurface, AffectToneBadge } from '../shared/ui'

export type FindingSeverity = 'critical' | 'warning' | 'note'

export interface FindingAgent {
  id: string
  name: string
  model?: string
  step?: string
  done: number
  total: number
  status?: 'running' | 'done' | 'failed' | 'idle'
}
export interface Finding {
  id: string
  agentId: string
  title: string
  severity: FindingSeverity
  location?: string
  at: number
}

export interface AgentFindingsProps {
  agents: FindingAgent[]
  findings: Finding[]
  title?: string
  rows?: number
  now?: number
  onOpen?: (finding: Finding) => void
  className?: string
}

const severityTone: Record<FindingSeverity, AffectTone> = {
  critical: 'danger', warning: 'warning', note: 'info'
}
const severityLabel: Record<FindingSeverity, string> = {
  critical: 'Critical', warning: 'Warning', note: 'Note'
}

/** Parallel checkers with progress rows and a feed of their findings. */
export function AgentFindings({
  agents, findings, title = 'Verification', rows = 4, now, onOpen, className
}: AgentFindingsProps) {
  const [filter, setFilter] = useState<string | null>(null)
  const visible = findings
    .filter((finding) => !filter || finding.agentId === filter)
    .slice(0, rows)
  const nameOf = (id: string) => agents.find((agent) => agent.id === id)?.name ?? id

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-findings">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={`${agents.length} agents · ${findings.length} findings`} />
        <ul role="list" aria-label={`${title} agents`} className="space-y-2">
          {agents.map((agent) => {
            const status = agent.status ?? (agent.done >= agent.total ? 'done' : 'running')
            return (
              <li key={agent.id}>
                <button type="button" aria-pressed={filter === agent.id}
                  aria-label={`${agent.name}, ${agent.done} of ${agent.total} checks, ${status}. Filter findings`}
                  onClick={() => setFilter(filter === agent.id ? null : agent.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFilter(filter === agent.id ? null : agent.id) }
                  }}
                  className={cn('w-full space-y-1 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    filter === agent.id && 'bg-accent')}>
                  <span className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-foreground">{agent.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{agent.done}/{agent.total}</span>
                  </span>
                  {agent.step ? <span className="block truncate text-[11px] text-muted-foreground">{agent.step}</span> : null}
                  <AffectMeter value={agent.done} max={agent.total || 1} tone={status === 'failed' ? 'danger' : status === 'done' ? 'success' : 'primary'}
                    label={`${agent.name} progress`} />
                </button>
              </li>
            )
          })}
        </ul>

        <div className="space-y-1" role="log" aria-live="polite" aria-label="Findings">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Findings</p>
          {visible.length ? visible.map((finding) => (
            <button key={finding.id} type="button" onClick={() => onOpen?.(finding)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen?.(finding) } }}
              aria-label={`${severityLabel[finding.severity]} by ${nameOf(finding.agentId)}: ${finding.title}`}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <AffectToneBadge tone={severityTone[finding.severity]}>{severityLabel[finding.severity]}</AffectToneBadge>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">{finding.title}</span>
              {finding.location ? <span className="shrink-0 truncate text-[10px] text-muted-foreground">{finding.location}</span> : null}
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatRelativeTime(finding.at, now)}</span>
            </button>
          )) : <AffectEmpty>No findings{filter ? ' from this agent' : ''} yet.</AffectEmpty>}
        </div>
      </div>
    </AffectSurface>
  )
}
