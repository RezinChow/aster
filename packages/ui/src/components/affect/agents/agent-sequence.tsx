import { X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty, AffectHeader, AffectIconButton, AffectSurface, AffectToneBadge } from '../shared/ui'

export interface SeqParticipant {
  id: string
  name: string
  kind?: 'person' | 'agent' | 'tool'
  logo?: ReactNode
  color?: string
  model?: string
  description?: string
}
export interface SeqMessage {
  id: string
  from: string
  to: string
  label: string
  at?: number
  kind?: 'call' | 'reply'
  replyTo?: string
  status?: 'failed' | 'waiting'
  frame?: string
  detail?: string
}
export interface AgentSequenceProps {
  participants: SeqParticipant[]
  messages: SeqMessage[]
  title?: string
  running?: boolean
  times?: boolean
  onSelect?: (message: SeqMessage | null) => void
  formatTime?: (ms: number) => string
  className?: string
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** One run as a sequence diagram: lifelines, messages and their detail cards. */
export function AgentSequence({
  participants, messages, title, running = false, times, onSelect,
  formatTime = clock, className
}: AgentSequenceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const selected = messages.find((message) => message.id === selectedId) ?? null
  const participant = participants.find((item) => item.id === participantId) ?? null
  const colWidth = 100 / Math.max(1, participants.length)
  const center = (id: string) => {
    const index = participants.findIndex((item) => item.id === id)
    return (index + 0.5) * colWidth
  }
  const showTimes = times ?? messages.some((message) => message.at !== undefined)
  const open = (message: SeqMessage | null) => {
    setSelectedId(message?.id ?? null)
    onSelect?.(message)
  }
  const nameOf = (id: string) => participants.find((item) => item.id === id)?.name ?? id

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-sequence">
      <div className="space-y-2 p-3">
        <AffectHeader title={title} description={`${messages.length} messages${running ? ' · live' : ''}`} />
        <div className="flex gap-2 overflow-x-auto rounded-md border border-border bg-card p-2">
          <span className={cn('shrink-0', showTimes ? 'w-12' : 'w-0')} />
          {participants.map((item) => (
            <button key={item.id} type="button" aria-haspopup="dialog"
              onClick={() => setParticipantId(item.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setParticipantId(item.id) } }}
              className="flex min-w-20 flex-1 flex-col items-center gap-1 rounded-md border border-border px-1 py-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">
                {item.logo ?? item.name.slice(0, 2)}
              </span>
              <span className="w-full truncate text-center text-[10px] font-medium text-foreground">{item.name}</span>
              {item.model ? <span className="w-full truncate text-center text-[9px] text-muted-foreground">{item.model}</span> : null}
            </button>
          ))}
        </div>

        {messages.length ? (
          <ol role="list" aria-label={title ?? 'Sequence'} className="space-y-0.5">
            {messages.map((message, index) => {
              const from = center(message.from)
              const to = center(message.to)
              const loop = message.from === message.to
              const left = loop ? from - colWidth / 3 : Math.min(from, to)
              const width = loop ? (colWidth * 2) / 3 : Math.max(colWidth / 4, Math.abs(to - from))
              const dashed = message.kind === 'reply'
              return (
                <li key={message.id}>
                  {message.frame && messages[index - 1]?.frame === message.frame ? null : message.frame ? (
                    <p className="ml-1 w-fit rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{message.frame}</p>
                  ) : null}
                  <button type="button" aria-haspopup="dialog" aria-expanded={selectedId === message.id}
                    aria-label={`${nameOf(message.from)} to ${nameOf(message.to)}: ${message.label}${message.status ? `, ${message.status}` : ''}${message.at !== undefined ? `, ${formatTime(message.at)}` : ''}`}
                    onClick={() => open(selectedId === message.id ? null : message)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(message) }
                      if (event.key === 'Escape') open(null)
                      if (event.key === 'ArrowDown') { event.preventDefault(); open(messages[Math.min(messages.length - 1, index + 1)]) }
                      if (event.key === 'ArrowUp') { event.preventDefault(); open(messages[Math.max(0, index - 1)]) }
                    }}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <span className={cn('shrink-0 text-right text-[10px] tabular-nums text-muted-foreground', showTimes ? 'w-12' : 'w-0 overflow-hidden')}>
                      {message.at !== undefined ? formatTime(message.at) : ''}
                    </span>
                    <span className="relative h-6 flex-1 rounded-md border border-border/60 bg-background/40"
                      aria-hidden="true">
                      <span className="pointer-events-none absolute inset-0 grid"
                        style={{ gridTemplateColumns: `repeat(${participants.length}, minmax(0, 1fr))` }}>
                        {participants.map((item) => <span key={item.id} className="border-r border-border/50" />)}
                      </span>
                      <span className={cn('absolute top-1/2 h-0 -translate-y-1/2 border-t-2',
                        dashed ? 'border-dashed' : 'border-solid',
                        message.status === 'failed' ? 'border-destructive' : message.status === 'waiting' ? 'border-warning' : 'border-foreground/50')}
                        style={{ left: `${left}%`, width: `${width}%` }}>
                        {!loop ? (
                          <span aria-hidden="true" className={cn('absolute -right-1 -top-[3px] size-0 border-y-[4px] border-l-[6px] border-y-transparent',
                            message.status === 'failed' ? 'border-l-destructive' : message.status === 'waiting' ? 'border-l-warning' : 'border-l-foreground/50')} />
                        ) : null}
                      </span>
                      <span className={cn('absolute top-1/2 max-w-[60%] -translate-x-1/2 -translate-y-1/2 truncate rounded-full bg-card px-1.5 py-0.5 text-[10px] font-medium shadow-sm',
                        message.status === 'failed' ? 'text-destructive' : message.status === 'waiting' ? 'text-warning-subtle-foreground' : 'text-foreground')}
                        style={{ left: `${left + width / 2}%` }}>
                        {message.label}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        ) : <AffectEmpty>No messages yet.</AffectEmpty>}

        {selected ? (
          <div role="dialog" aria-label={`${selected.label} details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') open(null) }}
            className="space-y-1 rounded-md border border-border bg-background p-3 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">{selected.label}</span>
              <div className="flex items-center gap-1">
                {selected.status ? <AffectToneBadge tone={selected.status === 'failed' ? 'danger' : 'warning'}>{selected.status === 'failed' ? 'Failed' : 'Needs you'}</AffectToneBadge> : null}
                <AffectIconButton label="Close message details" onClick={() => open(null)}><X aria-hidden="true" className="size-3" /></AffectIconButton>
              </div>
            </div>
            <p className="text-muted-foreground">{nameOf(selected.from)} → {nameOf(selected.to)}{selected.at !== undefined ? ` · ${formatTime(selected.at)}` : ''}</p>
            {selected.detail ? <p className="text-foreground">{selected.detail}</p> : null}
          </div>
        ) : null}
        {participant ? (
          <div role="dialog" aria-label={`${participant.name} details`} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') setParticipantId(null) }}
            className="space-y-1 rounded-md border border-border bg-background p-3 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{participant.name}</span>
              <button type="button" aria-label="Close participant details" onClick={() => setParticipantId(null)} className="rounded p-0.5 hover:bg-muted"><X aria-hidden="true" className="size-3" /></button>
            </div>
            {participant.description ? <p className="text-muted-foreground">{participant.description}</p> : null}
            {participant.model ? <p className="text-muted-foreground">{participant.model}</p> : null}
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
