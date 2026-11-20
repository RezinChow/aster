import { Check, FileDiff, MessageSquare, Send, Shield, X } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export type GateStatus = 'open' | 'approved' | 'edited' | 'rejected'
export type GateKind = 'tool' | 'file' | 'agent' | 'message'
export interface ApprovalGate {
  id: string
  agent: string
  kind: GateKind
  action: string
  reason: string
  status: GateStatus
  avatar?: ReactNode
  at?: string
  input?: string
  diff?: { file: string; lines: { type: 'add' | 'del' | 'ctx'; text: string }[] }[]
  files?: string[]
  context?: string[]
  holds?: string[]
  note?: string
}
export interface ApprovalGatesProps {
  gates: ApprovalGate[]
  task?: string
  live?: boolean
  onDecide?: (id: string, decision: 'approved' | 'edited' | 'rejected', value?: string) => void
  title?: string
  className?: string
}

const statusTone: Record<GateStatus, AffectTone> = {
  open: 'warning', approved: 'success', edited: 'info', rejected: 'danger'
}
const statusLabel: Record<GateStatus, string> = {
  open: 'Blocking', approved: 'Approved', edited: 'Edited', rejected: 'Stopped the run'
}
const kindIcon: Record<GateKind, ReactNode> = {
  tool: <Shield className="size-3" />, file: <FileDiff className="size-3" />,
  agent: <Send className="size-3" />, message: <MessageSquare className="size-3" />
}

/** The approval requests of a run as a stack, decided one at a time. */
export function ApprovalGates({
  gates, task, live = false, onDecide, title = 'Approvals', className
}: ApprovalGatesProps) {
  const [openIds, setOpenIds] = useState<string[]>(() => gates.filter((gate) => gate.status === 'open').map((gate) => gate.id))
  const [top, setTop] = useState(0)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const pending = gates.filter((gate) => openIds.includes(gate.id))
  const decided = gates.filter((gate) => !openIds.includes(gate.id))
  const current = pending[Math.min(top, Math.max(0, pending.length - 1))]

  const decide = (decision: 'approved' | 'edited' | 'rejected') => {
    if (!current) return
    onDecide?.(current.id, decision, decision === 'edited' ? value : undefined)
    setOpenIds((ids) => ids.filter((id) => id !== current.id))
    setTop(0)
    setEditing(false)
    setValue('')
    setAnnounce(`${decision}: ${current.action}. ${Math.max(0, pending.length - 1)} requests left`)
  }

  return (
    <AffectSurface className={cn('w-full max-w-[560px]', className)} data-slot="approval-gates">
      <div className="space-y-2 p-3">
        <AffectHeader title={title} description={task}
          actions={<span className="text-[10px] text-muted-foreground">{live ? (pending.length ? `${pending.length} waiting` : 'Running') : 'Paused'}</span>} />

        {current ? (
          <div role="group" aria-label={`${pending.length} approval requests waiting, ${current.action} on top`} tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') { event.preventDefault(); setTop((top + 1) % pending.length); setEditing(false) }
              if (event.key === 'ArrowLeft') { event.preventDefault(); setTop((top - 1 + pending.length) % pending.length); setEditing(false) }
            }}
            className="rounded-md border border-border bg-muted/30 p-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <div className="flex flex-wrap items-center gap-1">
              {pending.map((gate, index) => (
                <button key={gate.id} type="button" aria-current={index === top ? 'true' : undefined}
                  onClick={() => { setTop(index); setEditing(false) }}
                  className={cn('size-2 rounded-full', index === top ? 'bg-primary' : 'bg-muted-foreground/40')}
                  aria-label={`Go to request ${index + 1}: ${gate.action}`} />
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground">{top + 1} / {pending.length}</span>
            </div>
            <div className="mt-2 rounded-md border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-foreground">
                  {kindIcon[current.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{current.action}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{current.agent}{current.at ? ` · ${current.at}` : ''}</p>
                </div>
                <AffectToneBadge tone="warning">Blocking</AffectToneBadge>
              </div>
              <p className="mt-2 text-[11px] text-foreground">{current.reason}</p>
              {current.context?.length ? (
                <p className="mt-1 truncate text-[10px] text-muted-foreground">After: {current.context.join(' → ')}</p>
              ) : null}
              {current.diff?.length ? (
                <div className="mt-2 space-y-1">
                  {current.diff.map((file) => (
                    <div key={file.file} className="rounded border border-border bg-background">
                      <p className="border-b border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">{file.file}</p>
                      <pre className="overflow-x-auto p-2 font-mono text-[10px]">
                        {file.lines.map((line, index) => (
                          <code key={index} className={cn('block whitespace-pre',
                            line.type === 'add' ? 'text-success-subtle-foreground' : line.type === 'del' ? 'text-destructive' : 'text-muted-foreground')}>
                            {line.type === 'add' ? '+ ' : line.type === 'del' ? '− ' : '  '}{line.text}
                          </code>
                        ))}
                      </pre>
                    </div>
                  ))}
                </div>
              ) : current.input ? (
                <pre className="mt-2 overflow-x-auto rounded border border-border bg-background p-2 font-mono text-[10px] text-foreground"><code>{current.input}</code></pre>
              ) : null}
              {current.holds?.length ? (
                <p className="mt-2 text-[10px] text-warning-subtle-foreground">Holds: {current.holds.join(', ')}</p>
              ) : null}

              {editing ? (
                <div className="mt-2 space-y-1">
                  <textarea aria-label={`Edit ${current.action}`} autoFocus rows={2} value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); decide('edited') }
                      if (event.key === 'Escape') { event.preventDefault(); setEditing(false) }
                    }}
                    className="w-full resize-none rounded-md border border-border bg-background p-2 text-[11px] text-foreground outline-none focus:border-primary" />
                  <p className="text-[10px] text-muted-foreground">⌘/Ctrl+Enter approves with your changes · Esc goes back</p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {onDecide ? (
                  <>
                    <button type="button" onClick={() => decide('approved')} className="inline-flex items-center gap-1 rounded-md bg-success-subtle px-2 py-1 text-[11px] text-success-subtle-foreground"><Check aria-hidden="true" className="size-3" /> Approve</button>
                    <button type="button" onClick={() => { setValue(current.input ?? ''); setEditing(true) }} className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground">Edit</button>
                    <button type="button" onClick={() => decide('rejected')} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"><X aria-hidden="true" className="size-3" /> Reject</button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
            {live ? 'Running — nothing to approve right now.' : 'No open requests.'}
          </p>
        )}

        {decided.length ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Decided</p>
            <ul role="list" className="space-y-1">
              {decided.map((gate) => (
                <li key={gate.id}>
                  <button type="button" aria-expanded={expanded === gate.id}
                    onClick={() => setExpanded(expanded === gate.id ? null : gate.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-muted/60">
                    <span className="min-w-0 flex-1 truncate text-foreground">{gate.action}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{gate.agent}</span>
                    <AffectToneBadge tone={statusTone[gate.status]}>{statusLabel[gate.status]}</AffectToneBadge>
                  </button>
                  {expanded === gate.id ? (
                    <p className="px-2 pb-1 text-[10px] text-muted-foreground">{gate.note ?? gate.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {gates.length === 0 ? <AffectEmpty>No approvals in this run.</AffectEmpty> : null}
        <p className="sr-only" aria-live="polite">{announce}</p>
      </div>
    </AffectSurface>
  )
}
