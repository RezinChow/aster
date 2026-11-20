import { Check, ChevronDown, ChevronRight, Copy, GitBranch, GitMerge, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { formatRelativeTime } from '../shared/format'
import { AffectEmpty, AffectSurface } from '../shared/ui'

export interface CommitAuthor { name: string; agent?: boolean; color?: string; avatar?: ReactNode }
export interface TrailCommit {
  id: string
  message: string
  author: CommitAuthor
  coAuthor?: CommitAuthor
  time?: number | Date | string
  tag?: string
  files?: number
  added?: number
  removed?: number
  body?: string
  commits?: TrailCommit[]
  pending?: boolean
}
export interface CommitTrailProps {
  commits: TrailCommit[]
  branches?: string[]
  branch?: string
  defaultBranch?: string
  onBranchChange?: (branch: string) => void
  open?: string | null
  defaultOpen?: string | null
  onOpenChange?: (id: string | null) => void
  expanded?: string[]
  defaultExpanded?: string[]
  onExpandedChange?: (ids: string[]) => void
  hasMore?: boolean
  maxHeight?: number
  title?: string
  className?: string
}

function timeLabel(value: TrailCommit['time']): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  return formatRelativeTime(new Date(value).getTime())
}

/** A branch history where people and agents commit side by side. */
export function CommitTrail({
  commits, branches = [], branch, defaultBranch, onBranchChange, open, defaultOpen = null,
  onOpenChange, expanded, defaultExpanded = [], onExpandedChange, hasMore, maxHeight,
  title, className
}: CommitTrailProps) {
  const [localBranch, setLocalBranch] = useState(defaultBranch ?? branches[0])
  const [localOpen, setLocalOpen] = useState<string | null>(defaultOpen)
  const [localExpanded, setLocalExpanded] = useState<string[]>(defaultExpanded)
  const [branchOpen, setBranchOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const currentBranch = branch ?? localBranch
  const selected = open === undefined ? localOpen : open
  const merged = expanded ?? localExpanded

  const chooseBranch = (value: string) => {
    if (branch === undefined) setLocalBranch(value)
    onBranchChange?.(value)
    setBranchOpen(false)
  }
  const chooseOpen = (id: string | null) => {
    if (open === undefined) setLocalOpen(id)
    onOpenChange?.(id)
  }
  const toggleMerged = (id: string) => {
    const next = merged.includes(id) ? merged.filter((value) => value !== id) : [...merged, id]
    if (expanded === undefined) setLocalExpanded(next)
    onExpandedChange?.(next)
  }
  const copy = (id: string) => {
    void navigator.clipboard?.writeText(id)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 1500)
  }
  const authorLabel = (commit: TrailCommit) =>
    `${commit.author.name}${commit.coAuthor ? ` with ${commit.coAuthor.name}` : ''}: ${commit.message}`

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="commit-trail">
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          {branches.length > 1 ? (
            <div className="relative">
              <button type="button" aria-haspopup="menu" aria-expanded={branchOpen} onClick={() => setBranchOpen(!branchOpen)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted">
                <GitBranch aria-hidden="true" className="size-3" /> {currentBranch ?? title ?? 'Branch'} <ChevronDown aria-hidden="true" className="size-3" />
              </button>
              {branchOpen ? (
                <ul role="menu" className="absolute z-10 mt-1 w-40 rounded-md border border-border bg-card p-1 shadow-md">
                  {branches.map((value) => (
                    <li key={value} role="menuitemradio" aria-checked={value === currentBranch}>
                      <button type="button" onClick={() => chooseBranch(value)} className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-muted">{value}</button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : <h3 className="truncate text-xs font-medium text-foreground">{currentBranch ?? title ?? 'Commits'}</h3>}
          <span className="text-[10px] text-muted-foreground">{commits.length} commits</span>
        </div>

        {commits.length ? (
          <ol role="list" aria-label={currentBranch ?? 'Commits'} className="space-y-0.5 overflow-y-auto" style={maxHeight ? { maxHeight } : undefined}>
            {commits.map((commit) => {
              const isOpen = selected === commit.id
              const isMerge = !!commit.commits?.length
              const isMergedOpen = merged.includes(commit.id)
              return (
                <li key={commit.id}>
                  <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
                    <span className="relative flex size-4 shrink-0 flex-col items-center">
                      <span className={cn('flex size-4 items-center justify-center rounded-full',
                        commit.pending ? 'bg-warning-subtle text-warning-subtle-foreground' : 'bg-success-subtle text-success-subtle-foreground')}>
                        {commit.pending ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : <Check aria-hidden="true" className="size-3" />}
                      </span>
                    </span>
                    {isMerge ? (
                      <button type="button" aria-expanded={isMergedOpen}
                        aria-label={`${commit.message}, brought in ${(commit.commits ?? []).length} commits`}
                        onClick={() => toggleMerged(commit.id)}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <ChevronRight aria-hidden="true" className={cn('size-3 shrink-0 transition-transform', isMergedOpen && 'rotate-90')} />
                        <GitMerge aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{commit.message}</span>
                      </button>
                    ) : (
                      <button type="button" aria-expanded={isOpen} aria-label={authorLabel(commit)}
                        onClick={() => chooseOpen(isOpen ? null : commit.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseOpen(isOpen ? null : commit.id) }
                          if (event.key === 'Escape') chooseOpen(null)
                        }}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">{commit.message}</span>
                        {commit.tag ? <span className="shrink-0 rounded bg-muted px-1 py-px text-[9px] text-muted-foreground">{commit.tag}</span> : null}
                        {commit.added !== undefined ? <span className="shrink-0 text-[9px] text-success-subtle-foreground">+{commit.added}</span> : null}
                        {commit.removed !== undefined ? <span className="shrink-0 text-[9px] text-destructive">−{commit.removed}</span> : null}
                        <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">{timeLabel(commit.time)}</span>
                      </button>
                    )}
                  </div>

                  {isMerge && isMergedOpen ? (
                    <ul role="list" className="ml-4 space-y-0.5 border-l border-border pl-2">
                      {(commit.commits ?? []).map((child) => (
                        <li key={child.id}>
                          <button type="button" onClick={() => chooseOpen(child.id)}
                            className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-[10px] hover:bg-muted/60">
                            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate text-foreground">{child.message}</span>
                            <span className="shrink-0 text-muted-foreground">{child.author.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {isOpen && !isMerge ? (
                    <div role="dialog" aria-label={`${commit.message} details`} tabIndex={-1}
                      onKeyDown={(event) => { if (event.key === 'Escape') chooseOpen(null) }}
                      className="ml-4 space-y-1 rounded-md border border-border bg-background p-2 text-[11px]">
                      <p className="text-foreground">{commit.author.name}{commit.coAuthor ? ` with ${commit.coAuthor.name}` : ''}</p>
                      <p className="text-muted-foreground">{new Date(commit.time ?? Date.now()).toLocaleString()}</p>
                      <button type="button" onClick={() => copy(commit.id)} className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-muted">
                        <Copy aria-hidden="true" className="size-3" /> {commit.id}{copied === commit.id ? ' copied' : ''}
                      </button>
                      {commit.files || commit.added || commit.removed ? (
                        <p className="text-muted-foreground">{commit.files ?? 0} files · +{commit.added ?? 0} −{commit.removed ?? 0}</p>
                      ) : null}
                      {commit.body ? <p className="text-foreground">{commit.body}</p> : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : <AffectEmpty>No commits yet.</AffectEmpty>}
        {hasMore ? <p className="pl-2 text-[10px] text-muted-foreground">Older commits…</p> : null}
        <p className="sr-only" aria-live="polite">{commitlanded(commits)}</p>
      </div>
    </AffectSurface>
  )
}

function commitlanded(commits: TrailCommit[]): string {
  const pending = commits.find((commit) => commit.pending)
  return pending ? `${pending.author.name}: Committing – ${pending.message}` : ''
}
