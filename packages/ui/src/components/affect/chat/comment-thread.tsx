import { ChevronDown, Send, Sparkles, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatRelativeTime } from '../shared'

export interface ThreadAuthor {
  name: string
  avatar?: ReactNode
  assistant?: boolean
}

export interface ThreadMessage {
  id: string
  author: ThreadAuthor
  createdAt?: number | string
  text: string
  status?: string
  details?: string | string[]
}

export interface CommentThreadProps {
  messages: ThreadMessage[]
  currentUser: ThreadAuthor
  assistant?: ThreadAuthor
  onReply?: (text: string) => ThreadMessage | Promise<ThreadMessage | void> | void
  onClose?: () => void
  title?: string
}

/** Small mark used as the assistant avatar in comment threads. */
export function AssistantMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground', className)}>
      <Sparkles aria-hidden="true" className="size-3" />
    </span>
  )
}

function timeLabel(value: number | string | undefined): string {
  if (value === undefined) return ''
  return typeof value === 'number' ? formatRelativeTime(value) : value
}

/** One comment with replies, folding status details and an inline reply composer. */
export function CommentThread({
  messages,
  currentUser,
  assistant,
  onReply,
  onClose,
  title = 'Comment'
}: CommentThreadProps) {
  const [items, setItems] = useState(messages)
  const [draft, setDraft] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [thinking, setThinking] = useState(false)

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setItems((current) => [...current, { id: `own-${Date.now()}`, author: currentUser, text, createdAt: Date.now() }])
    setThinking(true)
    try {
      const result = await onReply?.(text)
      if (result && typeof result === 'object' && 'id' in result) {
        setItems((current) => [...current, result])
      }
    } finally {
      setThinking(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <div data-slot="comment-thread" className="w-full max-w-md rounded-lg bg-muted p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {onClose ? (
          <button type="button" aria-label="Close thread" onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <ul aria-live="polite" className="space-y-3">
          {items.map((message) => {
            const isExpanded = expanded[message.id] ?? false
            const detailLines = Array.isArray(message.details) ? message.details : message.details ? [message.details] : []
            return (
              <li key={message.id} className="flex gap-2">
                <span className="shrink-0">
                  {message.author.avatar ?? (message.author.assistant ? <AssistantMark /> : (
                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">{message.author.name.slice(0, 1)}</span>
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-xs font-medium text-foreground">{message.author.name}</span>
                    {message.createdAt !== undefined ? <time className="text-[10px] text-muted-foreground">{timeLabel(message.createdAt)}</time> : null}
                  </span>
                  <span className="mt-0.5 block whitespace-pre-wrap text-xs leading-relaxed text-foreground">{message.text}</span>
                  {message.status ? (
                    <span className="mt-1 block">
                      <button
                        type="button"
                        aria-expanded={detailLines.length ? isExpanded : undefined}
                        onClick={() => setExpanded((current) => ({ ...current, [message.id]: !isExpanded }))}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <ChevronDown aria-hidden="true" className={cn('size-3 transition-transform', !isExpanded && '-rotate-90')} />
                        {message.status}
                      </button>
                      {isExpanded ? (
                        <span className="mt-1 block space-y-0.5 rounded border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
                          {detailLines.map((line, index) => <span key={index} className="block">{line}</span>)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </li>
            )
          })}
          {thinking && assistant ? (
            <li className="flex items-center gap-2 text-[11px] text-muted-foreground" role="status">
              {assistant.avatar ?? <AssistantMark />}
              <span className="animate-pulse">{assistant.name} is thinking…</span>
            </li>
          ) : null}
        </ul>
        <div className="flex items-end gap-1.5 border-t border-border pt-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            aria-label="Reply"
            placeholder="Reply…  @mention to ask the assistant"
            className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            aria-label="Send reply"
            disabled={!draft.trim()}
            onClick={() => void send()}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
