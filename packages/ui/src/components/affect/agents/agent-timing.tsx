import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type TimingState = 'idle' | 'thinking' | 'tool' | 'waiting'
export interface TimingParticipant { id: string; name: string; kind?: 'person' | 'agent'; color?: string }
export interface TimingSegment {
  id?: string
  who: string
  state: TimingState
  start: number
  end?: number
  label?: string
}
export interface TimingHandoff { id?: string; from: string; to: string; at: number; label?: string }
export interface AgentTimingProps {
  participants: TimingParticipant[]
  segments: TimingSegment[]
  handoffs?: TimingHandoff[]
  now?: number
  duration?: number
  title?: string
  className?: string
}

const stateTone: Record<TimingState, AffectTone> = {
  idle: 'neutral', thinking: 'info', tool: 'primary', waiting: 'warning'
}
const stateLabel: Record<TimingState, string> = {
  idle: 'Idle', thinking: 'Thinking', tool: 'Tool call', waiting: 'Waiting on you'
}
const stateClass: Record<TimingState, string> = {
  idle: 'bg-muted text-muted-foreground',
  thinking: 'bg-info-subtle text-info',
  tool: 'bg-primary text-primary-foreground',
  waiting: 'border border-dashed border-warning bg-warning-subtle text-warning-subtle-foreground'
}

function seconds(value: number): string {
  return value < 60 ? `${value.toFixed(value % 1 ? 1 : 0)}s` : `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`
}

/** A timing diagram: one signal line per participant, with steps and hand-offs. */
export function AgentTiming({
  participants, segments, handoffs = [], now, duration, title, className
}: AgentTimingProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const flat = segments.map((segment, index) => ({ ...segment, key: segment.id ?? `seg-${index}` }))
  const end = duration ?? Math.max(1, ...flat.map((segment) => segment.end ?? now ?? segment.start + 1)) * 1.05
  const percent = (value: number) => Math.min(100, Math.max(0, (value / end) * 100))
  const chosen = flat.find((segment) => segment.key === selected) ?? null
  const ticks = Array.from({ length: 5 }, (_, index) => (end * index) / 4)

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-timing">
      <div className="space-y-2 p-3">
        <AffectHeader title={title} description={`${flat.length} steps · ${handoffs.length} hand-offs`} />
        <div className="flex gap-2 pl-20 text-[10px] tabular-nums text-muted-foreground">
          {ticks.map((tick) => <span key={tick} className="flex-1">{seconds(tick)}</span>)}
        </div>
        <div className="space-y-1">
          {participants.map((participant) => {
            const mine = flat.filter((segment) => segment.who === participant.id)
            const incoming = handoffs.filter((item) => item.to === participant.id)
            return (
              <div key={participant.id} className="flex items-center gap-2">
                <div className="flex w-20 shrink-0 items-center gap-1.5">
                  {participant.kind === 'person' ? <span aria-hidden="true" className="size-4 rounded-sm bg-foreground" /> : <span aria-hidden="true" className="size-3 rounded-sm bg-info" />}
                  <span className="truncate text-[11px] font-medium text-foreground">{participant.name}</span>
                </div>
                <div role="list" aria-label={`${participant.name} signal line`}
                  className="relative h-9 flex-1 rounded-md border border-border bg-muted/20">
                  <span aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
                  {now !== undefined ? <span aria-hidden="true" className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${percent(now)}%` }} /> : null}
                  {mine.map((segment) => {
                    const left = percent(segment.start)
                    const width = Math.max(2, percent(segment.end ?? now ?? segment.start) - left)
                    return (
                      <button key={segment.key} type="button" role="listitem"
                        aria-label={`${participant.name}, ${stateLabel[segment.state]}${segment.label ? `, ${segment.label}` : ''}, from ${seconds(segment.start)} for ${seconds((segment.end ?? now ?? segment.start) - segment.start)}`}
                        aria-expanded={selected === segment.key}
                        onClick={() => setSelected(selected === segment.key ? null : segment.key)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(segment.key) }
                          if (event.key === 'Escape') setSelected(null)
                          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                            event.preventDefault()
                            const index = flat.findIndex((item) => item.key === segment.key)
                            setSelected(flat[Math.max(0, Math.min(flat.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))].key)
                          }
                        }}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        className={cn('absolute top-1.5 flex h-6 items-center overflow-hidden rounded px-1 text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', stateClass[segment.state])}>
                        {segment.label ? <span className="truncate">{segment.label}</span> : null}
                      </button>
                    )
                  })}
                  {incoming.map((item) => (
                    <span key={item.id ?? `${item.from}-${item.at}`} title={item.label}
                      className="absolute top-0 flex -translate-x-1/2 items-center text-[9px] text-muted-foreground"
                      style={{ left: `${percent(item.at)}%` }}>
                      {item.from === participant.id ? <ArrowDownRight aria-hidden="true" className="size-3" /> : <ArrowUpRight aria-hidden="true" className="size-3" />}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {flat.length === 0 ? <AffectEmpty>No steps yet.</AffectEmpty> : null}

        {chosen ? (
          <div role="dialog" aria-label={`${chosen.label ?? stateLabel[chosen.state]} details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') setSelected(null) }}
            className="space-y-1 rounded-md border border-border bg-background p-2 text-[11px]">
            <span className="flex items-center justify-between">
              <span className="truncate font-medium text-foreground">{chosen.label ?? stateLabel[chosen.state]}</span>
              <AffectToneBadge tone={stateTone[chosen.state]}>{stateLabel[chosen.state]}</AffectToneBadge>
            </span>
            <p className="text-muted-foreground">
              {participants.find((item) => item.id === chosen.who)?.name ?? chosen.who} · from {seconds(chosen.start)} for {seconds((chosen.end ?? now ?? chosen.start) - chosen.start)}
            </p>
            <button type="button" onClick={() => setSelected(null)} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-foreground">Close</button>
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
