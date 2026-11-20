import { AtSign, File, Folder, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectSurface, AffectToneBadge } from '../shared/ui'

export type StreamKind = 'ask' | 'reply' | 'handoff' | 'share' | 'question' | 'spawn'
export interface StreamAgent { id: string; name: string; model?: string; avatar?: ReactNode }
export interface StreamAttachment { label: string; kind?: string; preview?: ReactNode; meta?: string }
export interface StreamDetails { facts?: string[]; items?: string[] }
export interface StreamMessage {
  id: string
  from: string
  to: string
  kind: StreamKind
  text: string
  at?: string
  replyTo?: string
  typing?: boolean
  attachments?: StreamAttachment[]
  details?: StreamDetails
}
export interface CollaborationStreamProps {
  agents: StreamAgent[]
  messages: StreamMessage[]
  task?: string
  live?: boolean
  selected?: string | null
  onSelectedChange?: (id: string | null) => void
  focusAgent?: string | null
  onFocusAgentChange?: (id: string | null) => void
  onSend?: (value: { text: string; to: string[]; replyTo?: string }) => void
  placeholder?: string
  logos?: Record<string, ReactNode>
  maxHeight?: number
  title?: string
  className?: string
}

const kindTone: Record<StreamKind, AffectTone> = {
  ask: 'info', reply: 'neutral', handoff: 'warning', share: 'success', question: 'warning', spawn: 'neutral'
}
const kindLabel: Record<StreamKind, string> = {
  ask: 'Ask', reply: 'Reply', handoff: 'Handoff', share: 'Shared', question: 'Needs you', spawn: 'Spawned'
}

/** What agents say to each other, with tagged handoffs, files and a composer. */
export function CollaborationStream({
  agents, messages, task, live = false, selected, onSelectedChange, focusAgent,
  onFocusAgentChange,   onSend, placeholder = 'Message the agents – @ to name one',
  maxHeight = 520, title = 'Agent chat', className
}: CollaborationStreamProps) {
  const [localSelected, setLocalSelected] = useState<string | null>(null)
  const [localFocus, setLocalFocus] = useState<string | null>(null)
  const [preview, setPreview] = useState<StreamAttachment | null>(null)
  const [draft, setDraft] = useState('')
  const [mentions, setMentions] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  const picked = selected === undefined ? localSelected : selected
  const focused = focusAgent === undefined ? localFocus : focusAgent
  const visible = focused ? messages.filter((message) => message.from === focused || message.to === focused) : messages
  const setPicked = (id: string | null) => {
    if (selected === undefined) setLocalSelected(id)
    onSelectedChange?.(id)
  }
  const setFocused = (id: string | null) => {
    if (focusAgent === undefined) setLocalFocus(id)
    onFocusAgentChange?.(id)
  }
  const nameOf = (id: string) => id === 'you' ? 'You' : id === 'all' ? 'Everyone' : agents.find((agent) => agent.id === id)?.name ?? id
  const send = () => {
    if (!draft.trim() || !onSend) return
    const to = [...draft.matchAll(/@([a-zA-Z0-9_-]+)/g)].map((match) => match[1])
    onSend({ text: draft.trim(), to: to.length ? to : ['all'], replyTo: replyTo ?? undefined })
    setDraft('')
    setReplyTo(null)
    setMentions(false)
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="collaboration-stream">
      <section aria-label={title} className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{title}</p>
            {task ? <p className="truncate text-[10px] text-muted-foreground">{task}</p> : null}
          </div>
          {live ? <span className="flex shrink-0 items-center gap-1 text-[10px] text-success-subtle-foreground"><span className="size-1.5 rounded-full bg-success" /> Live</span> : null}
        </div>

        <div role="toolbar" aria-label="Agents" className="flex gap-1 overflow-x-auto border-b border-border pb-1">
          <button type="button" aria-pressed={focused === null} onClick={() => setFocused(null)}
            className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px]', focused === null ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>All</button>
          {agents.map((agent) => (
            <button key={agent.id} type="button" aria-pressed={focused === agent.id}
              onClick={() => setFocused(focused === agent.id ? null : agent.id)}
              className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px]',
                focused === agent.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted')}>
              {agent.avatar ?? <span aria-hidden="true" className="size-2 rounded-sm bg-info" />}
              {agent.name}
            </button>
          ))}
        </div>

        <div role="log" aria-live={live ? 'polite' : 'off'} aria-label={title}
          className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight }}>
          {visible.map((message) => {
            const isYou = message.from === 'you'
            const detailOpen = picked === message.id
            const attachment = message.attachments?.[0]
            return (
              <div key={message.id} className={cn('flex flex-col gap-0.5', isYou ? 'items-end' : 'items-start')}>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="font-medium">{nameOf(message.from)}</span>
                  <span aria-hidden="true">→</span>
                  <span>{nameOf(message.to)}</span>
                  {message.at ? <span>{message.at}</span> : null}
                  {message.kind === 'handoff' || message.kind === 'question' ? (
                    <AffectToneBadge tone={kindTone[message.kind]}>{kindLabel[message.kind]}</AffectToneBadge>
                  ) : null}
                </span>
                {message.kind === 'spawn' ? (
                  <p className="text-[10px] italic text-muted-foreground">{nameOf(message.from)} started {nameOf(message.to)}</p>
                ) : (
                  <button type="button" aria-expanded={detailOpen}
                    onClick={() => setPicked(detailOpen ? null : message.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPicked(detailOpen ? null : message.id) }
                      if (event.key === 'Escape') setPicked(null)
                    }}
                    className={cn('max-w-[85%] rounded-lg border px-2.5 py-1.5 text-left text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      isYou ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground',
                      message.typing && 'animate-pulse')}>
                    {message.replyTo ? <span className="mb-0.5 block truncate text-[9px] text-muted-foreground">↳ {agents.find((agent) => agent.id === message.replyTo)?.name ?? 'previous'}</span> : null}
                    <span className="whitespace-pre-wrap">{message.text}{message.typing ? '…' : ''}</span>
                  </button>
                )}
                {attachment ? (
                  <button type="button" onClick={() => setPreview(attachment)}
                    className="inline-flex max-w-[85%] items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground hover:bg-muted">
                    {attachment.kind?.includes('/') ? <Folder aria-hidden="true" className="size-3" /> : <File aria-hidden="true" className="size-3" />}
                    <span className="truncate">{attachment.label}</span>
                    {attachment.meta ? <span className="text-muted-foreground">{attachment.meta}</span> : null}
                  </button>
                ) : null}
                {detailOpen && message.details ? (
                  <div role="dialog" aria-label={`${message.text} details`} tabIndex={-1}
                    onKeyDown={(event) => { if (event.key === 'Escape') setPicked(null) }}
                    className="w-full max-w-[85%] space-y-1 rounded-md border border-border bg-muted/30 p-2 text-[10px]">
                    {message.details.facts?.map((fact) => <p key={fact} className="text-foreground">• {fact}</p>)}
                    {message.details.items?.map((item) => <p key={item} className="text-muted-foreground">· {item}</p>)}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {onSend ? (
          <div className="space-y-1">
            {replyTo ? (
              <p className="flex items-center justify-between text-[10px] text-muted-foreground">
                Replying to {nameOf(replyTo)}
                <button type="button" aria-label="Drop reply" onClick={() => setReplyTo(null)}><X aria-hidden="true" className="size-3" /></button>
              </p>
            ) : null}
            {mentions ? (
              <ul role="listbox" aria-label="Agents" className="flex flex-wrap gap-1 rounded-md border border-border p-1">
                {agents.map((agent) => (
                  <li key={agent.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => { setDraft((value) => `${value}@${agent.id} `); setMentions(false); field.current?.focus() }}
                      className="rounded px-1.5 py-0.5 text-[10px] text-foreground hover:bg-muted">{agent.name}</button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-end gap-1">
              <button type="button" aria-label="Mention an agent" aria-expanded={mentions}
                onClick={() => setMentions(!mentions)}
                className={cn('rounded-md border border-border p-2 text-muted-foreground hover:bg-muted', mentions && 'bg-accent')}>
                <AtSign aria-hidden="true" className="size-3" />
              </button>
              <textarea ref={field} aria-label={title} rows={2} value={draft}
                onChange={(event) => setDraft(event.target.value)} placeholder={placeholder}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
                  if (event.key === 'Escape') { setMentions(false); setReplyTo(null) }
                }}
                className="min-h-10 min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary" />
              <button type="button" aria-label="Send message" disabled={!draft.trim()} onClick={send}
                className="mb-0.5 rounded-md bg-primary p-2 text-primary-foreground disabled:opacity-40"><Send aria-hidden="true" className="size-3" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground">Enter sends · Shift+Enter adds a line · @ names an agent</p>
          </div>
        ) : null}

        {preview ? (
          <div role="dialog" aria-modal="true" aria-label={preview.label} tabIndex={-1}
            onKeyDown={(event) => { if (event.key === 'Escape') setPreview(null) }}
            className="rounded-md border border-border bg-card p-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="truncate text-[11px] font-medium text-foreground">{preview.label}</span>
              <button type="button" aria-label="Close preview" onClick={() => setPreview(null)} className="rounded p-0.5 hover:bg-muted"><X aria-hidden="true" className="size-3" /></button>
            </div>
            <div className="mt-2 max-h-48 overflow-auto text-[11px] text-muted-foreground">{preview.preview ?? 'No preview available.'}</div>
          </div>
        ) : null}
      </section>
    </AffectSurface>
  )
}
