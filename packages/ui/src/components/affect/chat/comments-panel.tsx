import { Check, ChevronDown, Send, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatRelativeTime } from '../shared'

export interface CommentAuthor {
  name: string
  avatar?: ReactNode
}

export interface PanelComment {
  id: string
  author: CommentAuthor
  createdAt?: number | string
  text: string
  resolved?: boolean
}

export interface CommentsPanelProps {
  comments: PanelComment[]
  currentUser: CommentAuthor
  onRunEdit?: (comment: PanelComment) => Promise<void> | void
  onAdd?: (comment: PanelComment) => void
  onClose?: () => void
  title?: string
}

type Filter = 'all' | 'open' | 'resolved'

/** Comment sidebar with filters, runnable /edit commands, resolve and a composer. */
export function CommentsPanel({
  comments,
  currentUser,
  onRunEdit,
  onAdd,
  onClose,
  title = 'Comments'
}: CommentsPanelProps) {
  const [items, setItems] = useState(comments)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [oldest, setOldest] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [running, setRunning] = useState<Set<string>>(() => new Set())

  const visible = items
    .filter((item) => (filter === 'all' ? true : filter === 'resolved' ? item.resolved : !item.resolved))
    .slice()
    .sort((a, b) => (oldest ? 1 : -1) * String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')))

  const toggleResolved = (id: string) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, resolved: !item.resolved } : item)))

  const add = () => {
    const text = draft.trim()
    if (!text) return
    const comment: PanelComment = { id: `own-${Date.now()}`, author: currentUser, text, createdAt: Date.now() }
    setItems((current) => [...current, comment])
    onAdd?.(comment)
    setDraft('')
  }

  const runEdit = async (comment: PanelComment) => {
    if (!onRunEdit) return
    setRunning((current) => new Set(current).add(comment.id))
    try {
      await onRunEdit(comment)
    } finally {
      setRunning((current) => {
        const next = new Set(current)
        next.delete(comment.id)
        return next
      })
    }
  }

  const timeLabel = (value: number | string | undefined) =>
    value === undefined ? '' : typeof value === 'number' ? formatRelativeTime(value) : value

  return (
    <div data-slot="comments-panel" className="flex w-full max-w-sm flex-col rounded-lg bg-muted p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              aria-label="Sort comments"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((value) => !value)}
              className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown aria-hidden="true" className="size-3" />{oldest ? 'Oldest' : 'Newest'}
            </button>
            {sortOpen ? (
              <div role="radiogroup" aria-label="Sort comments" className="absolute right-0 top-full z-20 mt-1 w-24 rounded-md border border-border bg-card p-1 shadow-lg">
                {([['Newest', false], ['Oldest', true]] as const).map(([label, value]) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={oldest === value}
                    onClick={() => { setOldest(value); setSortOpen(false) }}
                    className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[11px] text-foreground hover:bg-muted"
                  >
                    {oldest === value ? <Check aria-hidden="true" className="size-3" /> : <span className="size-3" />}{label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {onClose ? (
            <button type="button" aria-label="Close comments" onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div role="tablist" aria-label="Filter comments" className="mb-2 flex gap-1 border-b border-border px-1">
        {([['all', 'All'], ['open', 'Open'], ['resolved', 'Resolved']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn('-mb-px border-b-2 px-2 py-1 text-[11px]', filter === value ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>
      <ul aria-live="polite" className="max-h-96 flex-1 space-y-2 overflow-auto">
        {visible.map((comment) => {
          const isEdit = comment.text.trimStart().startsWith('/edit')
          return (
            <li key={comment.id} className={cn('rounded-lg border border-border bg-card p-2.5', comment.resolved && 'opacity-60')}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  {comment.author.avatar ?? <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">{comment.author.name.slice(0, 1)}</span>}
                  <span className="text-xs font-medium text-foreground">{comment.author.name}</span>
                  {comment.createdAt !== undefined ? <time className="text-[10px] text-muted-foreground">{timeLabel(comment.createdAt)}</time> : null}
                </span>
                <button
                  type="button"
                  aria-pressed={comment.resolved === true}
                  aria-label={comment.resolved ? 'Reopen' : 'Resolve'}
                  onClick={() => toggleResolved(comment.id)}
                  className={cn('inline-flex size-6 items-center justify-center rounded border border-transparent text-muted-foreground hover:bg-muted', comment.resolved && 'border-border bg-accent text-accent-foreground')}
                >
                  <Check aria-hidden="true" className="size-3.5" />
                </button>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground">{comment.text}</p>
              {isEdit && onRunEdit ? (
                <button
                  type="button"
                  disabled={running.has(comment.id)}
                  onClick={() => void runEdit(comment)}
                  className="mt-1.5 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
                >
                  {running.has(comment.id) ? 'Running…' : 'Run edit'}
                </button>
              ) : null}
            </li>
          )
        })}
        {!visible.length ? <li className="py-6 text-center text-[11px] text-muted-foreground">No comments here yet.</li> : null}
      </ul>
      <div className="mt-2 flex items-end gap-1.5 rounded-lg border border-border bg-card p-1.5">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              add()
            }
          }}
          rows={2}
          aria-label="New comment"
          placeholder="Add a comment… use /edit to ask for a change"
          className="max-h-24 min-h-8 flex-1 resize-none bg-transparent px-1 text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button type="button" aria-label="Add comment" disabled={!draft.trim()} onClick={add} className="inline-flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40">
          <Send aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <span className="sr-only" role="status">{visible.length} comments</span>
    </div>
  )
}
