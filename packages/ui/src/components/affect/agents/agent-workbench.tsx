import { FileText } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSectionLabel, AffectSurface } from '../shared/ui'

export interface WorkbenchTool {
  id: string
  name: string
  logo?: ReactNode
  scope?: string
  last?: string
  when?: string
}
export interface WorkbenchFile { id: string; name: string; logo?: ReactNode; meta?: string }
export interface WorkbenchStep { id: string; text: string; at?: string; running?: boolean }
export interface AgentWorkbenchProps {
  user: { name: string; message: string; photo?: string; avatar?: ReactNode }
  agent: { id: string; name: string; subtitle?: string }
  tools: WorkbenchTool[]
  files: WorkbenchFile[]
  steps: WorkbenchStep[]
  reading?: string
  done?: boolean
  title?: string
  className?: string
}

/** One agent at work on one request, with the person, files and tools it touches. */
export function AgentWorkbench({
  user, agent, tools, files, steps, reading, done = false, title = 'Agent workbench', className
}: AgentWorkbenchProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [selectedTool, setSelectedTool] = useState<string | null>(null)
  const recent = steps.slice(-3).reverse()
  const activeTool = tools.find((tool) => tool.id === selectedTool)

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="agent-workbench">
      <section aria-label={title} className="space-y-3 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
            <AffectSectionLabel>Requester</AffectSectionLabel>
            <div className="flex items-center gap-2">
              {user.avatar ?? (user.photo ? (
                <img src={user.photo} alt="" className="size-6 rounded-full border border-border object-cover" />
              ) : <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-foreground">{user.name.slice(0, 1)}</span>)}
              <span className="truncate text-xs font-medium text-foreground">{user.name}</span>
            </div>
            <p className="line-clamp-4 text-[11px] text-muted-foreground">{user.message}</p>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-card p-2 shadow-sm">
            <AffectSectionLabel>Agent</AffectSectionLabel>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={cn('size-3 rounded-sm bg-foreground', !done && 'animate-pulse')} />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{agent.name}</span>
              <span className="text-[10px] text-muted-foreground">{done ? 'Done' : 'Working'}</span>
            </div>
            {agent.subtitle ? <p className="truncate text-[10px] text-muted-foreground">{agent.subtitle}</p> : null}
            <ul role="list" aria-label="Work area" className="space-y-0.5" aria-live="polite">
              {recent.length ? recent.map((step) => (
                <li key={step.id}>
                  <button type="button" aria-expanded={selected === step.id}
                    onClick={() => setSelected(selected === step.id ? null : step.id)}
                    className={cn('flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted/60',
                      selected === step.id && 'bg-accent')}>
                    <span className={cn('size-1.5 shrink-0 rounded-full', step.running ? 'bg-info' : 'bg-success')} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{step.text}</span>
                  </button>
                  {selected === step.id ? (
                    <p className="ml-3 text-[10px] text-muted-foreground">{step.at ?? agent.id}</p>
                  ) : null}
                </li>
              )) : <li className="py-2 text-center text-[11px] text-muted-foreground">Waiting for a request</li>}
            </ul>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
            <AffectSectionLabel>Files</AffectSectionLabel>
            {files.length ? files.slice(0, 4).map((file) => (
              <div key={file.id} className={cn('flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px]',
                reading === file.id && 'bg-accent')}>
                {file.logo ?? <FileText aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                {file.meta ? <span className="shrink-0 text-[10px] text-muted-foreground">{file.meta}</span> : null}
              </div>
            )) : <p className="text-[11px] text-muted-foreground">No files given.</p>}
            {files.length > 4 ? <p className="text-[10px] text-muted-foreground">+{files.length - 4} more</p> : null}
          </div>
        </div>

        <div className="space-y-1">
          <AffectSectionLabel>Tools</AffectSectionLabel>
          <div className="grid gap-2 sm:grid-cols-4">
            {tools.slice(0, 4).map((tool) => (
              <button key={tool.id} type="button" aria-expanded={selectedTool === tool.id}
                onClick={() => setSelectedTool(selectedTool === tool.id ? null : tool.id)}
                className="space-y-0.5 rounded-md border border-border bg-card p-2 text-left shadow-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  {tool.logo ?? <span aria-hidden="true" className="size-3 rounded-sm bg-muted" />}
                  <span className="truncate">{tool.name}</span>
                </span>
                {tool.scope ? <span className="block truncate text-[10px] text-muted-foreground">{tool.scope}</span> : null}
                {tool.last ? <span className="block truncate text-[10px] text-muted-foreground">{tool.last}{tool.when ? ` · ${tool.when}` : ''}</span> : null}
              </button>
            ))}
            {tools.length > 4 ? <p className="rounded-md border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">+{tools.length - 4} more tools</p> : null}
          </div>
          {activeTool ? (
            <p role="status" className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
              {activeTool.name}: {activeTool.last ?? 'Nothing yet'}{activeTool.when ? ` · ${activeTool.when}` : ''}
            </p>
          ) : null}
        </div>
      </section>
    </AffectSurface>
  )
}
