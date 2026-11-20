import { useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, affectToneClass, type AffectTone } from '../shared'

export interface RepoEdit { agent: string; added?: number; removed?: number }
export interface RepoFile { path: string; lines: number; edits?: RepoEdit[] }
export interface RepoAgent {
  id: string
  name: string
  color?: string
  file?: string
  action?: 'edit' | 'read'
  task?: string
}
export interface RepoMapProps {
  files: RepoFile[]
  agents: RepoAgent[]
  title?: string
  branch?: string
  depth?: number
  className?: string
}

const palette: AffectTone[] = ['primary', 'info', 'success', 'warning', 'neutral']

/** A codebase as a treemap with coding agents working in it. */
export function RepoMap({ files, agents, title, branch, depth = 2, className }: RepoMapProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [focused, setFocused] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const unique = files.filter((file, index) => files.findIndex((other) => other.path === file.path) === index)
  const agentById = (id: string) => agents.find((agent) => agent.id === id)
  const toneOf = (id: string) => palette[Math.max(0, agents.findIndex((agent) => agent.id === id)) % palette.length]
  const editorsOf = (file: RepoFile) => agents.filter((agent) => agent.file === file.path)
  const folderOf = (path: string) => path.split('/').slice(0, depth).join('/')
  const groups = [...new Set(unique.map((file) => folderOf(file.path)))]
  const detailIndex = hovered ?? focused
  const detail = unique[detailIndex]

  const move = (delta: number) => {
    const next = Math.min(unique.length - 1, Math.max(0, focused + delta))
    setFocused(next)
    refs.current[unique[next]?.path]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); move(1) }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
    else if (event.key === 'Home') { event.preventDefault(); move(-focused) }
    else if (event.key === 'End') { event.preventDefault(); move(unique.length - 1 - focused) }
    else if (event.key === 'Escape') { setSelectedAgent(null); setHovered(null) }
  }

  return (
    <div data-slot="repo-map" onKeyDown={onKeyDown} className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title ?? 'Repository'} description={branch} actions={<span className="text-[10px] text-muted-foreground">{unique.length} files · {agents.length} agents</span>} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agents.map((agent) => (
            <button key={agent.id} type="button" aria-pressed={selectedAgent === agent.id} aria-label={`${agent.name}. ${agent.file ? `At ${agent.file}` : 'Idle'}. ${agents.filter((a) => a.file && a.action === 'edit').length} editing.`} onClick={() => setSelectedAgent((current) => (current === agent.id ? null : agent.id))} className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px]', selectedAgent === agent.id ? 'border-primary bg-accent text-foreground' : 'text-muted-foreground hover:bg-muted/60')}>
              <span aria-hidden="true" className={cn('size-2 rounded-full', affectToneClass[toneOf(agent.id)].split(' ')[0])} />{agent.name}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Repository files" className="mt-3 space-y-2">
          {groups.map((folder) => (
            <section key={folder} aria-label={folder}>
              <h3 className="mb-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{folder}</h3>
              <div className="flex flex-wrap gap-1.5">
                {unique.filter((file) => folderOf(file.path) === folder).map((file) => {
                  const index = unique.indexOf(file)
                  const lastEdit = file.edits?.[file.edits.length - 1]
                  const working = editorsOf(file)
                  const conflicting = working.filter((agent) => agent.action === 'edit').length > 1
                  const tint = conflicting ? 'warning' : working[0]?.action === 'read' ? 'neutral' : lastEdit ? toneOf(lastEdit.agent) : working[0] ? toneOf(working[0].id) : 'neutral'
                  const dim = selectedAgent !== null && !working.some((agent) => agent.id === selectedAgent) && lastEdit?.agent !== selectedAgent
                  return (
                    <button
                      key={file.path}
                      ref={(el) => { refs.current[file.path] = el }}
                      type="button"
                      tabIndex={focused === index ? 0 : -1}
                      onFocus={() => setFocused(index)}
                      onMouseEnter={() => setHovered(index)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => setFocused(index)}
                      aria-label={`${file.path}, ${file.lines} lines${conflicting ? ', conflict' : ''}${working.length ? `, ${working.map((agent) => `${agent.name} ${agent.action ?? 'editing'}`).join(' and ')}` : ''}${lastEdit ? `, ${agentById(lastEdit.agent)?.name ?? lastEdit.agent} changed ${(lastEdit.added ?? 0) + (lastEdit.removed ?? 0)} lines` : ''}`}
                      className={cn('flex h-14 min-w-[76px] flex-col justify-between rounded-md border border-border p-1.5 text-left transition-all hover:ring-1 hover:ring-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', affectToneClass[tint].split(' ')[0], conflicting && 'animate-pulse ring-1 ring-warning', working[0]?.action === 'read' && 'border-dashed', dim && 'opacity-30', hovered === index && 'ring-1 ring-foreground')}
                      style={{ flexGrow: Math.max(1, file.lines / 40), flexBasis: 76 }}
                    >
                      <span className="truncate text-[10px] font-medium text-foreground">{file.path.split('/').pop()}</span>
                      <span className="flex items-center justify-between text-[9px] text-foreground/80"><span>{file.lines} lines</span>{lastEdit ? <span>+{lastEdit.added ?? 0} −{lastEdit.removed ?? 0}</span> : null}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        {detail ? (
          <div aria-live="polite" className="mt-3 rounded-md border border-border bg-background p-2 text-[11px]">
            <div className="flex items-center justify-between"><span className="min-w-0 truncate font-medium text-foreground">{detail.path}</span><AffectToneBadge tone="neutral">{detail.lines} lines</AffectToneBadge></div>
            {editorsOf(detail).filter((agent) => agent.action === 'edit').length > 1 ? <p className="mt-1 text-warning">Two agents are editing this file — changes may collide.</p> : null}
            {editorsOf(detail).map((agent) => <p key={agent.id} className="mt-0.5 text-muted-foreground">{agent.name} · {agent.action ?? 'edit'}{agent.task ? ` — ${agent.task}` : ''}</p>)}
            {(detail.edits ?? []).map((edit, index) => <p key={index} className="mt-0.5 text-muted-foreground">{agentById(edit.agent)?.name ?? edit.agent}: +{edit.added ?? 0} −{edit.removed ?? 0}</p>)}
          </div>
        ) : null}
      </AffectSurface>
    </div>
  )
}
