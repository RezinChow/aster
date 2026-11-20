import { AlertTriangle, Clock3 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost as defaultCost } from '../shared/format'
import type { AffectTone } from '../shared/types'
import { AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type GraphStatus = 'idle' | 'working' | 'waiting' | 'error' | 'done'
export interface GraphNode {
  id: string
  name: string
  kind: 'agent' | 'tool' | 'user'
  short?: string
  icon?: ReactNode
  detail?: string
  status?: GraphStatus
  doing?: string
  cost?: number
  lead?: boolean
}
export interface GraphCall {
  id: string
  from: string
  to: string
  at: number
  status?: 'pending' | 'ok' | 'error'
  label?: string
  ms?: number
}

export interface AgentGraphProps {
  nodes: GraphNode[]
  calls?: GraphCall[]
  edges?: [string, string][]
  now?: number
  heatWindow?: number
  onSelect?: (node: GraphNode | null) => void
  height?: number
  formatCost?: (amount: number) => string
  title?: string
  className?: string
}

const tone: Record<GraphStatus, AffectTone> = {
  idle: 'neutral', working: 'info', waiting: 'warning', error: 'danger', done: 'success'
}
const statusText: Record<GraphStatus, string> = {
  idle: 'Idle', working: 'Working', waiting: 'Needs you', error: 'Failed', done: 'Done'
}

function place(nodes: GraphNode[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const lead = nodes.find((node) => node.lead) ?? nodes.find((node) => node.kind === 'agent')
  const agents = nodes.filter((node) => node.kind === 'agent' && node.id !== lead?.id)
  const outer = nodes.filter((node) => node.kind !== 'agent' || node.id === lead?.id)
  const ring = (list: GraphNode[], radius: number, offset: number) => list.forEach((node, index) => {
    const angle = (-90 + offset + (index * 360) / Math.max(1, list.length)) * (Math.PI / 180)
    positions.set(node.id, { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) })
  })
  if (lead) positions.set(lead.id, { x: 50, y: 50 })
  ring(agents, 26, 0)
  ring(outer, 42, 180 / Math.max(1, outer.length))
  return positions
}

/** Agents and tools as a living network with pulsing calls and a node detail card. */
export function AgentGraph({
  nodes, calls = [], edges = [], now = Date.now(), heatWindow = 20000,
  onSelect, height, formatCost = defaultCost, title = 'Agent graph', className
}: AgentGraphProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const positions = useMemo(() => place(nodes), [nodes])
  const links = useMemo(() => {
    const map = new Map<string, { from: string; to: string; heat: number; error: boolean }>()
    const add = (from: string, to: string) => {
      const key = `${from}->${to}`
      const existing = map.get(key)
      if (existing) return existing
      const link = { from, to, heat: 0, error: false }
      map.set(key, link)
      return link
    }
    edges.forEach(([from, to]) => add(from, to))
    calls.forEach((call) => {
      const link = add(call.from, call.to)
      if (now - call.at <= heatWindow) link.heat += 1
      if (call.status === 'error') link.error = true
    })
    return [...map.values()]
  }, [edges, calls, now, heatWindow])
  const maxHeat = Math.max(1, ...links.map((link) => link.heat))
  const selected = nodes.find((node) => node.id === selectedId) ?? null
  const total = nodes.reduce((sum, node) => sum + (node.cost ?? 0), 0)
  const attention = nodes.filter((node) => node.status === 'waiting' || node.status === 'error')
  const open = (node: GraphNode | null) => {
    setSelectedId(node?.id ?? null)
    onSelect?.(node)
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-graph">
      <div className="space-y-2 p-3">
        <AffectHeader title={title} description={`${nodes.length} nodes · ${formatCost(total)}`}
          actions={attention.length ? (
            <span className="flex items-center gap-1 text-[11px] text-warning-subtle-foreground" aria-live="polite">
              <AlertTriangle aria-hidden="true" className="size-3" /> {attention.length} need attention
            </span>
          ) : undefined} />
        <div role="img" aria-label={`${title}: ${nodes.map((node) => `${node.name} ${statusText[node.status ?? 'idle']}`).join(', ')}`}
          className="relative w-full overflow-hidden rounded-md border border-border bg-muted/20"
          style={{ height: height ?? 420 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
            className="absolute inset-0 size-full text-muted-foreground">
            {links.map((link) => {
              const a = positions.get(link.from)
              const b = positions.get(link.to)
              if (!a || !b) return null
              return <line key={`${link.from}-${link.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="currentColor" strokeWidth={1.25 + (link.heat / maxHeat) * 2.75} opacity={link.error ? 0.9 : 0.35} />
            })}
          </svg>
          {nodes.map((node) => {
            const point = positions.get(node.id)
            if (!point) return null
            const status = node.status ?? 'idle'
            return (
              <button key={node.id} type="button" aria-haspopup="dialog" aria-expanded={selectedId === node.id}
                aria-label={`${node.name}, ${node.kind}, ${statusText[status]}${node.doing ? `, ${node.doing}` : ''}`}
                onClick={() => open(selectedId === node.id ? null : node)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(node) }
                  if (event.key === 'Escape') open(null)
                }}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                className={cn('absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  node.lead ? 'z-10' : 'z-0', selectedId === node.id && 'z-20')}>
                <span className={cn('flex size-9 items-center justify-center rounded-full border border-border bg-card text-[10px] font-medium shadow-sm text-foreground',
                  status === 'working' && 'border-info', status === 'waiting' && 'border-warning', status === 'error' && 'border-destructive')}>
                  {node.icon ?? (node.kind === 'user' ? 'You' : (node.short ?? node.name).slice(0, 2))}
                </span>
                <span className="max-w-20 truncate rounded bg-background/80 px-1 text-[10px] text-foreground">{node.short ?? node.name}</span>
              </button>
            )
          })}
        </div>
        {attention.length ? (
          <p className="flex flex-wrap gap-1" aria-live="polite">
            {attention.map((node) => (
              <AffectToneBadge key={node.id} tone={tone[node.status ?? 'idle']}>
                {node.status === 'waiting' ? <Clock3 aria-hidden="true" className="size-3" /> : <AlertTriangle aria-hidden="true" className="size-3" />}
                {node.name}: {statusText[node.status ?? 'idle']}
              </AffectToneBadge>
            ))}
          </p>
        ) : null}
        {selected ? (
          <div role="dialog" aria-label={`${selected.name} details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') open(null) }}
            className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{selected.name}</span>
              <AffectToneBadge tone={tone[selected.status ?? 'idle']}>{statusText[selected.status ?? 'idle']}</AffectToneBadge>
            </div>
            {selected.detail ? <p className="mt-1 text-[11px] text-muted-foreground">{selected.detail}</p> : null}
            {selected.doing ? <p className="mt-1 text-[11px] text-foreground">{selected.doing}</p> : null}
            {selected.cost !== undefined ? <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{formatCost(selected.cost)} spent</p> : null}
            <button type="button" onClick={() => open(null)} className="mt-2 rounded border border-border px-2 py-0.5 text-[11px] text-foreground">Close</button>
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
