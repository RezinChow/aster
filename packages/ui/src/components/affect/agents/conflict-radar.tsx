import { Check, GitMerge, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge } from '../shared/ui'

export interface RadarAgent { id: string; name: string; model?: string; avatar?: ReactNode; status?: 'running' | 'done' }
export interface RadarEdit { agentId: string; lines: [number, number]; summary?: string; active?: boolean }
export interface RadarFile { path: string; edits: RadarEdit[] }
export interface ConflictRadarProps {
  agents: RadarAgent[]
  files: RadarFile[]
  title?: string
  resolved?: Record<string, string>
  onResolve?: (path: string, agentId: string) => void
  onMerge?: () => void
  className?: string
}

/** A grid of files by agents, showing where parallel work overlaps. */
export function ConflictRadar({
  agents, files, title = 'Parallel work', resolved, onResolve, onMerge, className
}: ConflictRadarProps) {
  const [localResolved, setLocalResolved] = useState<Record<string, string>>({})
  const [openFile, setOpenFile] = useState<string | null>(null)
  const picks = resolved ?? localResolved
  const conflicts = files.filter((file) => new Set(file.edits.map((edit) => edit.agentId)).size > 1)
  const allDone = agents.every((agent) => agent.status === 'done')
  const canMerge = allDone && conflicts.every((file) => Boolean(picks[file.path]))
  const pick = (path: string, agentId: string) => {
    if (resolved === undefined) setLocalResolved((current) => ({ ...current, [path]: agentId }))
    onResolve?.(path, agentId)
  }
  const nameOf = (id: string) => agents.find((agent) => agent.id === id)?.name ?? id

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="conflict-radar">
      <div className="space-y-3 p-3">
        <AffectHeader title={title}
          description={`${conflicts.length} conflicts · ${agents.length} agents`}
          actions={
            <button type="button" disabled={!canMerge} onClick={onMerge}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-40">
              <GitMerge aria-hidden="true" className="size-3" /> Merge
            </button>
          } />
        <p className="text-[10px] text-muted-foreground" aria-live="polite">
          Merge is enabled once every conflict is settled and every agent is done.
        </p>

        {files.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-border px-2 py-1 font-medium text-muted-foreground">File</th>
                  {agents.map((agent) => (
                    <th key={agent.id} scope="col" className="border-b border-border px-2 py-1 text-center font-medium text-foreground">
                      <span className="block truncate">{agent.avatar}{agent.name}</span>
                      <span className="block truncate text-[10px] font-normal text-muted-foreground">
                        {agent.model ?? agent.id}{agent.status === 'running' ? ' · running' : ' · done'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file) => {
                  const conflicted = file.edits.length > 1
                  const chosen = picks[file.path]
                  const isOpen = openFile === file.path
                  return (
                    <tr key={file.path} className="border-b border-border/60">
                      <th scope="row" className="px-2 py-1 text-left font-normal">
                        <button type="button" aria-expanded={isOpen}
                          onClick={() => setOpenFile(isOpen ? null : file.path)}
                          className="flex items-center gap-1 text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                          <span className="max-w-40 truncate text-foreground" title={file.path}>{file.path}</span>
                          {conflicted ? (
                            chosen ? <AffectToneBadge tone="success">Settled</AffectToneBadge> : <AffectToneBadge tone="warning">Conflict</AffectToneBadge>
                          ) : <AffectToneBadge tone="neutral">Single</AffectToneBadge>}
                        </button>
                      </th>
                      {agents.map((agent) => {
                        const edit = file.edits.find((item) => item.agentId === agent.id)
                        return (
                          <td key={agent.id} className="px-2 py-1 text-center">
                            {edit ? (
                              <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
                                chosen === agent.id ? 'bg-success-subtle text-success-subtle-foreground' : 'bg-info-subtle text-info')}>
                                {edit.active ? <LoaderCircle aria-hidden="true" className="size-3 animate-spin" /> : chosen === agent.id ? <Check aria-hidden="true" className="size-3" /> : null}
                                L{edit.lines[0]}–{edit.lines[1]}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <AffectEmpty>No files changed yet.</AffectEmpty>}

        {conflicts.map((file) => openFile === file.path ? (
          <div key={file.path} role="group" aria-label={`Ways to settle ${file.path}`}
            className="space-y-1 rounded-md border border-warning bg-warning-subtle p-2">
            <p className="text-[11px] font-medium text-warning-subtle-foreground">{file.path}</p>
            <div role="radiogroup" aria-label={`Ways to settle ${file.path}`} className="flex flex-wrap gap-1">
              {file.edits.map((edit) => (
                <button key={edit.agentId} type="button" role="radio" aria-checked={picks[file.path] === edit.agentId}
                  onClick={() => pick(file.path, edit.agentId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(file.path, edit.agentId) }
                  }}
                  className={cn('rounded-md border px-2 py-1 text-left text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    picks[file.path] === edit.agentId ? 'border-primary bg-card text-foreground' : 'border-border text-muted-foreground hover:bg-card')}>
                  <span className="block font-medium">{nameOf(edit.agentId)}</span>
                  {edit.summary ? <span className="block max-w-52 truncate">{edit.summary}</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null)}
      </div>
    </AffectSurface>
  )
}
