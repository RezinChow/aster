import { AlertTriangle, Check, Clock, Pencil, RotateCcw, SkipForward, X } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, formatRelativeTime } from '../shared'

export type ReviewFlag = { text: string; note?: string; source?: string }
export type ReviewText = string | Array<string | ReviewFlag>
export interface ReviewFile { path: string; added?: number; removed?: number; diff?: string[]; start?: number }
export interface ReviewStep { title: string; tool?: string; icon?: ReactNode; detail?: string }
export interface ReviewItem {
  id: string
  title: string
  agent: string
  model?: string
  icon?: ReactNode
  type: string
  risk: 'high' | 'medium' | 'low'
  confidence: number
  createdAt: number
  reasoning?: string
  fields?: { label: string; value: ReviewText }[]
  body?: ReviewText
  bodyLabel?: string
  files?: ReviewFile[]
  steps?: ReviewStep[]
}
export interface ReviewResult { decision: 'approve' | 'reject'; reason?: string; text?: string }
export interface ReviewCenterProps {
  items: ReviewItem[]
  reviewed?: number
  onDecide?: (item: ReviewItem, result: ReviewResult) => void
  onUndo?: (item: ReviewItem, result: ReviewResult) => void
  onSkip?: (item: ReviewItem) => void
  total?: number
  sla?: number
  now?: number
  lowConfidence?: number
  reasons?: string[]
  order?: 'risk' | 'oldest' | 'given'
  filter?: 'all' | 'high' | 'unsure'
  defaultFilter?: 'all' | 'high' | 'unsure'
  onFilterChange?: (filter: 'all' | 'high' | 'unsure') => void
  title?: string
  className?: string
}

const riskRank: Record<ReviewItem['risk'], number> = { high: 0, medium: 1, low: 2 }

function firstFlagNote(item: ReviewItem): string {
  const values: ReviewText[] = [...(item.fields ?? []).map((field) => field.value), ...(item.body !== undefined ? [item.body] : [])]
  for (const value of values) {
    if (typeof value === 'string') continue
    const flag = value.find((part) => typeof part !== 'string' && Boolean((part as ReviewFlag).note)) as ReviewFlag | undefined
    if (flag?.note) return flag.note
  }
  return 'Check the flagged spans in this item.'
}

function reviewText(text: ReviewText | undefined, onFlag: (note: string) => void): ReactNode {
  if (text === undefined) return null
  if (typeof text === 'string') return text
  return text.map((part, index) => typeof part === 'string' || !part.note ? <span key={index}>{typeof part === 'string' ? part : part.text}</span> : (
    <button key={index} type="button" aria-label={`Flag: ${part.text}. ${part.note}`} onFocus={() => onFlag(part.note ?? '')} onMouseEnter={() => onFlag(part.note ?? '')} className="rounded-sm border-b border-dashed border-warning text-warning">{part.text}</button>
  ))
}

/** A focused queue where a person signs off what agents produced. */
export function ReviewCenter({
  items,
  reviewed = 0,
  onDecide,
  onUndo,
  onSkip,
  total,
  sla = 1_800_000,
  now = Date.now(),
  lowConfidence = 0.7,
  reasons = ['Wrong info', 'Tone', 'Not allowed', 'Other'],
  order = 'risk',
  filter,
  defaultFilter = 'all',
  onFilterChange,
  title = 'Review center',
  className
}: ReviewCenterProps) {
  const [filterState, setFilterState] = useState(defaultFilter)
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<'view' | 'edit' | 'reject'>('view')
  const [draft, setDraft] = useState('')
  const reasonIndex = 0
  const [note, setNote] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [last, setLast] = useState<{ item: ReviewItem; result: ReviewResult } | null>(null)
  const currentFilter = filter ?? filterState
  const sorted = [...items].sort((a, b) => order === 'given' ? 0 : order === 'oldest' ? a.createdAt - b.createdAt : riskRank[a.risk] - riskRank[b.risk] || a.createdAt - b.createdAt)
  const visible = sorted.filter((item) => currentFilter === 'all' || (currentFilter === 'high' && item.risk === 'high') || (currentFilter === 'unsure' && item.confidence < lowConfidence))
  const item = visible[Math.min(index, Math.max(0, visible.length - 1))]

  const decide = (result: ReviewResult) => {
    if (!item) return
    setLast({ item, result }); onDecide?.(item, result)
    setAnnounce(`${result.decision === 'approve' ? 'Approved' : 'Rejected'} ${item.title}. ${Math.max(0, visible.length - 1)} waiting.`)
    setMode('view'); setDraft(''); setNote(null)
    setIndex((current) => Math.min(current, Math.max(0, visible.length - 2)))
  }
  const undo = () => { if (!last) return; onUndo?.(last.item, last.result); setAnnounce(`Undid decision on ${last.item.title}`); setLast(null) }
  const skip = () => { if (!item) return; onSkip?.(item); setAnnounce(`Skipped ${item.title}`); setIndex((current) => Math.min(current, Math.max(0, visible.length - 2))) }
  const chooseFilter = (next: typeof currentFilter) => { setFilterState(next); onFilterChange?.(next); setIndex(0) }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tag = (event.target as HTMLElement).tagName
    if (event.key === 'Escape') { event.preventDefault(); setMode('view'); setNote(null); return }
    if (tag === 'TEXTAREA' || tag === 'INPUT') return
    if (mode === 'reject') {
      if (/^[1-4]$/.test(event.key)) { event.preventDefault(); decide({ decision: 'reject', reason: reasons[Number(event.key) - 1] }); return }
    }
    switch (event.key.toLowerCase()) {
      case 'a': event.preventDefault(); decide({ decision: 'approve' }); break
      case 'e': event.preventDefault(); setMode('edit'); setDraft(typeof item?.body === 'string' ? item.body : ''); break
      case 'r': event.preventDefault(); setMode('reject'); break
      case 's': event.preventDefault(); skip(); break
      case 'j': case 'arrowdown': event.preventDefault(); setIndex((i) => Math.min(visible.length - 1, i + 1)); break
      case 'k': case 'arrowup': event.preventDefault(); setIndex((i) => Math.max(0, i - 1)); break
      case 'z': event.preventDefault(); undo(); break
      case 'f': event.preventDefault(); if (item) setNote(firstFlagNote(item)); break
      default: break
    }
  }

  return (
    <div data-slot="review-center" onKeyDown={onKeyDown} className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={`${reviewed} reviewed · ${visible.length} waiting`} actions={<span className="text-[11px] tabular-nums text-muted-foreground">{reviewed}/{total ?? reviewed + items.length}</span>} />
        <div className="mt-2 flex gap-1">
          {(['all', 'high', 'unsure'] as const).map((option) => <button key={option} type="button" aria-pressed={currentFilter === option} onClick={() => chooseFilter(option)} className={cn('rounded-full px-2 py-0.5 text-[11px]', currentFilter === option ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground')}>{option === 'all' ? 'All' : option === 'high' ? 'High risk' : 'Unsure'}</button>)}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
          <ul role="list" aria-label="Review queue" className="max-h-52 space-y-0.5 overflow-y-auto border-r border-border pr-1">
            {visible.map((entry, position) => {
              return (
                <li key={entry.id}>
                  <button type="button" aria-current={position === index ? 'true' : undefined} aria-label={`${entry.title}. ${entry.type}. ${entry.risk} risk. Confidence ${Math.round(entry.confidence * 100)}%. Waiting ${formatRelativeTime(entry.createdAt, now)}.`} onClick={() => { setIndex(position); setMode('view'); setNote(null) }} className={cn('w-full rounded-md px-2 py-1.5 text-left', position === index ? 'bg-accent' : 'hover:bg-muted/60')}>
                    <span className="block truncate text-[11px] font-medium text-foreground">{entry.title}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span>{entry.type}</span>{entry.risk === 'high' ? <AlertTriangle aria-hidden="true" className="size-2.5 text-destructive" /> : null}<span className="ml-auto tabular-nums">{formatRelativeTime(entry.createdAt, now)}</span></span>
                  </button>
                </li>
              )
            })}
            {!visible.length ? <li className="px-2 py-4 text-center text-[11px] text-muted-foreground">Queue is empty.</li> : null}
          </ul>

          {item ? (
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                {item.risk !== 'low' ? <AffectToneBadge tone={item.risk === 'high' ? 'danger' : 'warning'}>{item.risk} risk</AffectToneBadge> : null}
                {item.confidence < lowConfidence ? <AffectToneBadge tone="warning">Unsure</AffectToneBadge> : null}
                {now - item.createdAt > sla ? <AffectToneBadge tone="danger">Overdue</AffectToneBadge> : null}
              </div>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">{item.icon}{item.agent}{item.model ? ` · ${item.model}` : ''}<Clock aria-hidden="true" className="ml-1 size-3" />{formatRelativeTime(item.createdAt, now)}</p>
              {item.reasoning ? <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">{item.reasoning}</p> : null}

              {item.fields?.length ? <div className="space-y-1 rounded-md border border-border p-2 text-[11px]">{item.fields.map((field) => <div key={field.label} className="flex flex-wrap items-baseline gap-2"><span className="w-20 shrink-0 text-muted-foreground">{field.label}</span><span className="min-w-0 flex-1 text-foreground">{reviewText(field.value, setNote)}</span></div>)}</div> : null}
              {item.body !== undefined ? (
                <div className="rounded-md border border-border p-2 text-[11px]">
                  <h3 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.bodyLabel ?? 'Proposal'}</h3>
                  {mode === 'edit' ? (
                    <>
                      <textarea autoFocus aria-label="Edit proposal" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); decide({ decision: 'approve', text: draft }) } }} rows={4} className="w-full resize-none rounded border border-border bg-background p-2 text-foreground outline-none" />
                      <p className="mt-1 text-[10px] text-muted-foreground">⌘Enter approves · Esc cancels</p>
                    </>
                  ) : <p className="whitespace-pre-wrap text-foreground">{reviewText(item.body, setNote)}</p>}
                </div>
              ) : null}
              {item.files?.length ? <div className="space-y-0.5 rounded-md border border-border p-2 text-[11px]">{item.files.map((file) => <div key={file.path} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-foreground">{file.path}</span><span className="tabular-nums text-success">+{file.added ?? 0}</span><span className="tabular-nums text-destructive">−{file.removed ?? 0}</span></div>)}</div> : null}
              {item.steps?.length ? <ol className="space-y-0.5 rounded-md border border-border p-2 text-[11px]">{item.steps.map((step, position) => <li key={position} className="flex items-center gap-2"><span className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">{position + 1}</span><span className="min-w-0 flex-1 truncate text-foreground">{step.title}</span>{step.detail ? <span className="truncate text-muted-foreground">{step.detail}</span> : null}</li>)}</ol> : null}

              {note ? <div role="tooltip" className="rounded-md border border-warning bg-warning-subtle p-2 text-[11px] text-warning-subtle-foreground">{note}</div> : null}
              {mode === 'reject' ? (
                <div role="group" aria-label="Reason for rejection" className="flex flex-wrap gap-1 rounded-md border border-border p-2">{reasons.map((reason, position) => <button key={reason} type="button" aria-keyshortcuts={String(position + 1)} onClick={() => decide({ decision: 'reject', reason })} className={cn('rounded-full border border-border px-2 py-0.5 text-[11px]', reasonIndex === position ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>{position + 1}. {reason}</button>)}</div>
              ) : null}

              <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                <button type="button" aria-keyshortcuts="A" disabled={mode !== 'view'} onClick={() => decide({ decision: 'approve' })} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-40"><Check aria-hidden="true" className="size-3" />Approve <span className="opacity-60">A</span></button>
                <button type="button" aria-keyshortcuts="E" onClick={() => { setMode('edit'); setDraft(typeof item.body === 'string' ? item.body : '') }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><Pencil aria-hidden="true" className="size-3" />Edit</button>
                <button type="button" aria-keyshortcuts="R" onClick={() => setMode('reject')} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"><X aria-hidden="true" className="size-3" />Reject</button>
                <button type="button" aria-keyshortcuts="S" onClick={skip} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"><SkipForward aria-hidden="true" className="size-3" />Skip</button>
                <button type="button" aria-keyshortcuts="Z" disabled={!last} onClick={undo} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted disabled:opacity-40"><RotateCcw aria-hidden="true" className="size-3" />Undo</button>
              </div>
            </div>
          ) : <p className="py-8 text-center text-xs text-muted-foreground">Nothing to review.</p>}
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
