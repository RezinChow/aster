import { ArrowRight, UserRound } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type RequestStatus = 'new' | 'routing' | 'routed' | 'escalated' | 'done'
export interface RouterAgent {
  id: string
  name: string
  model?: string
  status?: 'active' | 'idle' | 'paused' | 'waiting' | 'done' | 'failed'
  activity?: string
  load?: number
  queue?: number
  human?: boolean
  color?: string
  logo?: ReactNode
}
export interface RouterRequest {
  id: string
  title: string
  status: RequestStatus
  from?: string
  channel?: 'email' | 'chat' | 'ticket' | 'call' | 'slack'
  icon?: ReactNode
  preview?: string
  to?: string
  confidence?: number
  scores?: Record<string, number>
  reason?: string
  tags?: (string | { label: string; color?: string })[]
}

export interface AgentRouterProps {
  router: RouterAgent
  agents: RouterAgent[]
  requests: RouterRequest[]
  layout?: 'lanes' | 'columns'
  modelLogo?: ReactNode
  max?: number
  onReroute?: (request: RouterRequest, agentId: string) => void
  onSelect?: (request: RouterRequest) => void
  title?: string
  className?: string
}

const statusTone: Record<RequestStatus, AffectTone> = {
  new: 'neutral', routing: 'info', routed: 'success', escalated: 'warning', done: 'neutral'
}
const statusLabel: Record<RequestStatus, string> = {
  new: 'New', routing: 'Routing', routed: 'Routed', escalated: 'Escalated to a person', done: 'Done'
}

/** A router agent sorting incoming requests, with each decision one click away. */
export function AgentRouter({
  router, agents, requests, layout = 'lanes', modelLogo, max = 4, onReroute, onSelect, title, className
}: AgentRouterProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusAgent, setFocusAgent] = useState<string | null>(null)
  const selected = requests.find((request) => request.id === selectedId) ?? null
  const visible = requests.slice(0, max)
  const shown = focusAgent ? visible.filter((request) => request.to === focusAgent) : visible
  const open = (request: RouterRequest) => { setSelectedId(request.id); onSelect?.(request) }
  const nameOf = (id?: string) => agents.find((agent) => agent.id === id)?.name ?? id ?? '—'

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-router">
      <div className="space-y-3 p-3">
        <AffectHeader title={title} description={`${requests.filter((request) => request.status === 'routing').length} routing · ${requests.filter((request) => request.status === 'escalated').length} need you · ${requests.filter((request) => request.status === 'routed').length} routed`} />

        <div className={cn('grid gap-2', layout === 'columns' ? 'sm:grid-cols-3' : 'sm:grid-cols-1')}>
          <section aria-label="Incoming requests" className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Incoming</p>
            {shown.length ? shown.map((request) => (
              <button key={request.id} type="button" aria-haspopup="dialog" aria-expanded={selectedId === request.id}
                aria-label={`${request.title}, from ${request.from ?? 'unknown'}: ${statusLabel[request.status]}${request.to ? `, to ${nameOf(request.to)}` : ''}`}
                onClick={() => open(request)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(request) } }}
                className={cn('w-full rounded-md border border-border bg-card p-2 text-left shadow-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  selectedId === request.id && 'border-primary')}>
                <span className="flex items-center gap-1.5">
                  {request.icon ?? <span className="text-[10px] text-muted-foreground">{request.channel ?? 'in'}</span>}
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{request.title}</span>
                  <AffectToneBadge tone={statusTone[request.status]}>{statusLabel[request.status]}</AffectToneBadge>
                </span>
                {request.preview ? <span className="mt-1 block truncate text-[10px] text-muted-foreground">{request.preview}</span> : null}
                <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="truncate">{request.from ?? 'Unknown sender'}</span>
                  {request.to ? <><ArrowRight aria-hidden="true" className="size-3 shrink-0" /><span className="truncate">{nameOf(request.to)}</span></> : null}
                  {request.confidence !== undefined ? <span className="ml-auto shrink-0 tabular-nums">{Math.round(request.confidence * 100)}%</span> : null}
                </span>
                {request.tags?.length ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {request.tags.slice(0, 3).map((tag) => (
                      <span key={typeof tag === 'string' ? tag : tag.label} className="rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                        {typeof tag === 'string' ? tag : tag.label}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>
            )) : <p className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">No requests here.</p>}
          </section>

          <section aria-label="Router" className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Router</p>
            <div className="rounded-md border border-border bg-card p-2 shadow-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span aria-hidden="true" className="size-3 rounded-sm bg-foreground" /> {router.name}
              </p>
              {modelLogo || router.model ? <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">{modelLogo}{router.model}</p> : null}
              {router.activity ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{router.activity}</p> : null}
              {selected?.confidence !== undefined ? (
                <p className="mt-2 text-[10px] text-muted-foreground">Confidence on current request: {Math.round(selected.confidence * 100)}%</p>
              ) : null}
            </div>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground" aria-live="polite">
              <UserRound aria-hidden="true" className="size-3" /> Human in the loop
            </p>
          </section>

          <section aria-label="Agents" className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Agents</p>
            {agents.map((agent) => (
              <div key={agent.id} className={cn('space-y-1 rounded-md border border-border bg-card p-2 shadow-sm',
                agent.human && 'border-dashed', focusAgent === agent.id && 'border-primary bg-accent')}>
                <button type="button" aria-pressed={focusAgent === agent.id}
                  onClick={() => setFocusAgent(focusAgent === agent.id ? null : agent.id)}
                  className="flex w-full items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {agent.human ? <UserRound aria-hidden="true" className="size-3" /> : agent.logo ?? <span aria-hidden="true" className="size-3 rounded-sm bg-info" />}
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{agent.name}</span>
                  {agent.model ? <span className="max-w-16 truncate text-[10px] text-muted-foreground">{agent.model}</span> : null}
                </button>
                {agent.activity ? <p className="truncate text-[10px] text-muted-foreground">{agent.activity}</p> : null}
                {agent.load !== undefined ? (
                  <p className="text-[10px] text-muted-foreground">Load {Math.round(agent.load * 100)}%{agent.queue ? ` · ${agent.queue} queued` : ''}</p>
                ) : null}
              </div>
            ))}
          </section>
        </div>

        {selected ? (
          <div role="dialog" aria-label={`${selected.title} routing details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') setSelectedId(null) }}
            className="space-y-2 rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-foreground">{selected.title}</span>
              <button type="button" aria-label="Close routing details" onClick={() => setSelectedId(null)} className="rounded px-1 text-muted-foreground hover:bg-muted">×</button>
            </div>
            {selected.reason ? <p className="text-[11px] text-muted-foreground">{selected.reason}</p> : null}
            {selected.scores ? (
              <ul role="list" className="space-y-1">
                {Object.entries(selected.scores).map(([id, score]) => (
                  <li key={id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-foreground">{nameOf(id)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{Math.round(score * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {onReroute ? (
              <div className="flex flex-wrap gap-1" aria-label="Send to another agent">
                {agents.filter((agent) => !agent.human).map((agent) => (
                  <button key={agent.id} type="button" onClick={() => onReroute(selected, agent.id)}
                    className="rounded border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted">Send to {agent.name}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">{selected ? `${selected.title} sent to ${nameOf(selected.to)}` : ''}</p>
      </div>
    </AffectSurface>
  )
}
