import { Check, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatCost as defaultCost } from '../shared/format'
import { AffectSurface, AffectToolbar } from '../shared/ui'

export interface CursorAgent { id: string; name: string; avatar?: ReactNode; cost?: number }
export interface DocBlock { id: string; kind?: 'title' | 'heading' | 'paragraph' | 'item' | 'code' | 'image'; text?: string }
export interface AgentCursor { block: string; at?: number; select?: number; doing?: string; typing?: boolean }
export interface DocSuggestion { id: string; agent: string; block: string; at?: number; remove?: string; insert?: string; note?: string }
export interface DocComment { id: string; agent: string; block: string; text: string; at?: number; open?: boolean }

export interface AgentCursorsProps {
  agents: CursorAgent[]
  blocks: DocBlock[]
  cursors: Record<string, AgentCursor | null>
  suggestions?: DocSuggestion[]
  comments?: DocComment[]
  onAccept?: (suggestion: DocSuggestion) => void
  onReject?: (suggestion: DocSuggestion) => void
  onAcceptAll?: () => void
  onResolveComment?: (comment: DocComment) => void
  onReply?: (comment: DocComment, text: string) => void
  following?: string | null
  onFollowingChange?: (id: string | null) => void
  title?: string
  formatCost?: (amount: number) => string
  className?: string
}

/** Writes a suggestion into the document text and drops it from the pending list. */
export function acceptSuggestion(blocks: DocBlock[], suggestions: DocSuggestion[], id: string) {
  const suggestion = suggestions.find((item) => item.id === id)
  if (!suggestion) return { blocks, suggestions }
  const next = blocks.map((block) => {
    if (block.id !== suggestion.block) return block
    let text = block.text ?? ''
    if (suggestion.remove) text = text.replace(suggestion.remove, '')
    if (suggestion.insert) text = `${text}${suggestion.insert}`
    return { ...block, text }
  })
  return { blocks: next, suggestions: suggestions.filter((item) => item.id !== id) }
}

/** A document with live agent pointers, suggestions and comments. */
export function AgentCursors({
  agents, blocks, cursors, suggestions = [], comments = [], onAccept, onReject,
  onAcceptAll, onResolveComment, onReply, following, onFollowingChange,
  title = 'Untitled', formatCost = defaultCost, className
}: AgentCursorsProps) {
  const [internalFollowing, setInternalFollowing] = useState<string | null>(null)
  const [openSuggestion, setOpenSuggestion] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const followed = following === undefined ? internalFollowing : following
  const setFollowed = (id: string | null) => {
    if (following === undefined) setInternalFollowing(id)
    onFollowingChange?.(id)
  }
  const total = agents.reduce((sum, agent) => sum + (agent.cost ?? 0), 0)

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-cursors">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="truncate text-xs font-medium text-foreground">{title}</span>
        <AffectToolbar>
          {suggestions.length > 1 && onAcceptAll ? (
            <button type="button" onClick={onAcceptAll} className="rounded px-1.5 py-0.5 text-[11px] text-info hover:bg-muted">
              Accept all ({suggestions.length})
            </button>
          ) : null}
          <span className="text-[10px] tabular-nums text-muted-foreground">{formatCost(total)}</span>
          {agents.map((agent) => {
            const cursor = cursors[agent.id]
            if (!cursor) return null
            const pressed = followed === agent.id
            return (
              <button key={agent.id} type="button" aria-pressed={pressed}
                aria-label={`${agent.name}${cursor.doing ? `: ${cursor.doing}` : ''}. ${pressed ? 'Stop following' : 'Follow'}`}
                onClick={() => setFollowed(pressed ? null : agent.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFollowed(pressed ? null : agent.id) } }}
                className={cn('inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  pressed && 'bg-accent text-accent-foreground')}>
                {agent.avatar ?? <span className="size-3 rounded-full bg-foreground" aria-hidden="true" />}
                <span className="max-w-20 truncate">{agent.name}</span>
                {agent.cost !== undefined ? <span className="tabular-nums text-muted-foreground">{formatCost(agent.cost)}</span> : null}
              </button>
            )
          })}
        </AffectToolbar>
      </div>

      <div role="article" aria-label={title} className="space-y-3 p-4">
        {blocks.map((block) => {
          const heading = block.kind === 'title' || block.kind === 'heading'
          const here = agents.filter((agent) => cursors[agent.id]?.block === block.id)
          return (
            <div key={block.id} className="relative">
              <p className={cn('text-sm text-foreground', heading ? 'font-semibold' : block.kind === 'code' ? 'rounded bg-muted p-2 font-mono text-xs' : block.kind === 'item' ? 'ml-4 list-disc' : '')}>
                {block.text}
              </p>
              {here.map((agent) => {
                const cursor = cursors[agent.id]
                if (!cursor) return null
                const dimmed = followed !== null && followed !== agent.id
                return (
                  <span key={agent.id} aria-hidden="true"
                    className={cn('ml-1 inline-flex items-center gap-1 rounded bg-info-subtle px-1 py-px align-middle text-[10px] text-info', dimmed && 'opacity-40')}>
                    <span className="size-1.5 rounded-full bg-foreground" />
                    <span className="max-w-32 truncate">{cursor.doing ?? (cursor.typing ? 'Typing…' : agent.name)}</span>
                  </span>
                )
              })}
              {suggestions.filter((item) => item.block === block.id).map((suggestion) => (
                <span key={suggestion.id} className="relative">
                  <button type="button" aria-label={`${agents.find((a) => a.id === suggestion.agent)?.name ?? 'Agent'} suggests ${suggestion.insert ?? suggestion.remove}`}
                    aria-expanded={openSuggestion === suggestion.id}
                    onClick={() => setOpenSuggestion(openSuggestion === suggestion.id ? null : suggestion.id)}
                    onKeyDown={(event) => { if (event.key === 'Escape') setOpenSuggestion(null) }}
                    className="mx-0.5 rounded border-b-2 border-info bg-info-subtle px-0.5 text-sm text-foreground underline decoration-info underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    {suggestion.insert ?? suggestion.remove}
                  </button>
                  {openSuggestion === suggestion.id ? (
                    <span role="dialog" aria-label="Suggestion" className="absolute left-0 top-full z-10 mt-1 w-48 space-y-1 rounded-md border border-border bg-card p-2 shadow-md">
                      {suggestion.note ? <span className="block text-[11px] text-muted-foreground">{suggestion.note}</span> : null}
                      <span className="flex gap-1">
                        <button type="button" onClick={() => { onAccept?.(suggestion); setOpenSuggestion(null) }}
                          className="inline-flex items-center gap-1 rounded bg-success-subtle px-1.5 py-0.5 text-[11px] text-success-subtle-foreground"><Check aria-hidden="true" className="size-3" /> Accept</button>
                        <button type="button" onClick={() => { onReject?.(suggestion); setOpenSuggestion(null) }}
                          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"><X aria-hidden="true" className="size-3" /> Reject</button>
                      </span>
                    </span>
                  ) : null}
                </span>
              ))}
              {comments.filter((item) => item.block === block.id).map((comment) => (
                <span key={comment.id} className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning-subtle px-1.5 py-0.5 text-[10px] text-warning-subtle-foreground">
                  <MessageSquare aria-hidden="true" className="size-3" />
                  <span className="max-w-40 truncate">{comment.text}</span>
                  {onResolveComment ? (
                    <button type="button" aria-label="Resolve comment" onClick={() => onResolveComment(comment)}
                      className="rounded hover:bg-muted"><Check aria-hidden="true" className="size-3" /></button>
                  ) : null}
                  {onReply ? (
                    <button type="button" aria-label="Reply to comment" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                      className="rounded hover:bg-muted"><MessageSquare aria-hidden="true" className="size-3" /></button>
                  ) : null}
                  {replyTo === comment.id ? (
                    <input aria-label="Reply" value={replyText} onChange={(event) => setReplyText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && replyText.trim()) { onReply?.(comment, replyText.trim()); setReplyText(''); setReplyTo(null) }
                        if (event.key === 'Escape') setReplyTo(null)
                      }} className="w-32 rounded border border-border bg-background px-1 text-[10px] outline-none" />
                  ) : null}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </AffectSurface>
  )
}
