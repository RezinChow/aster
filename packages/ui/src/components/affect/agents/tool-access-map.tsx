import { ChevronLeft, Play, Wrench } from 'lucide-react'
import { useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectSurface, AffectToneBadge, affectStatusTone, formatDuration } from '../shared'

export interface ToolCall {
  id: string
  status: 'queued' | 'running' | 'waiting' | 'done' | 'failed'
  input: unknown
  output?: unknown
  error?: string
  at?: number
  duration?: number
  replay?: boolean
}
export interface AgentTool { id: string; calls?: ToolCall[] }
export interface MapAgent {
  id: string
  name: string
  model?: string
  avatar?: ReactNode
  status: 'queued' | 'running' | 'waiting' | 'done' | 'failed'
  task?: string
  tools: AgentTool[]
}
export interface AccessTool { id: string; name: string; icon?: ReactNode; description?: string }
export interface ToolAccessMapProps {
  agents: MapAgent[]
  tools: AccessTool[]
  agent?: string
  defaultAgent?: string
  onAgentChange?: (id: string) => void
  onReplay?: (call: ToolCall, input: unknown, tool: AccessTool, agent: MapAgent) => void
  formatTime?: (ms: number) => string
  title?: string
  className?: string
}

const stringify = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? ''

/** Which tools an agent can reach, what it called, and a replay of a call. */
export function ToolAccessMap({
  agents,
  tools,
  agent,
  defaultAgent,
  onAgentChange,
  onReplay,
  formatTime = formatDuration,
  title = 'Tool access',
  className
}: ToolAccessMapProps) {
  const [agentState, setAgentState] = useState(defaultAgent ?? agents[0]?.id ?? '')
  const [openTool, setOpenTool] = useState<string | null>(null)
  const [callIndex, setCallIndex] = useState(0)
  const [inputText, setInputText] = useState('')
  const [announce, setAnnounce] = useState('')
  const current = agents.find((item) => item.id === (agent ?? agentState)) ?? agents[0]
  const chooseAgent = (id: string) => { setAgentState(id); onAgentChange?.(id); setOpenTool(null); setAnnounce(`Showing ${id}`) }

  const accessOf = (tool: AccessTool): AgentTool | undefined => current?.tools.find((entry) => entry.id === tool.id)
  const callsOf = (tool: AccessTool): ToolCall[] => accessOf(tool)?.calls ?? []
  const statusOf = (tool: AccessTool): string => {
    const calls = callsOf(tool)
    if (!accessOf(tool)) return 'No access'
    if (!calls.length) return 'Not used yet'
    const last = calls[calls.length - 1]
    return last.status === 'running' ? 'Running' : last.status === 'failed' ? 'Failed' : `${calls.length} call${calls.length === 1 ? '' : 's'}`
  }
  const counts = {
    used: tools.filter((tool) => callsOf(tool).length).length,
    failed: tools.filter((tool) => callsOf(tool).some((call) => call.status === 'failed')).length,
    running: tools.filter((tool) => callsOf(tool).some((call) => call.status === 'running')).length
  }
  const openAccess = openTool ? tools.find((tool) => tool.id === openTool) : undefined
  const calls = openAccess ? callsOf(openAccess) : []
  const selectedCall = calls[callIndex]

  const onTabsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const index = agents.findIndex((item) => item.id === current?.id)
      const next = agents[(index + (event.key === 'ArrowRight' ? 1 : -1) + agents.length) % agents.length]
      if (next) chooseAgent(next.id)
    }
  }
  const onCallsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpenTool(null); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setCallIndex((index) => Math.min(calls.length - 1, index + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCallIndex((index) => Math.max(0, index - 1)) }
    else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && selectedCall && openAccess && current) { event.preventDefault(); replay(selectedCall, openAccess, current) }
  }
  const replay = (call: ToolCall, tool: AccessTool, mapAgent: MapAgent) => {
    let parsed: unknown = inputText
    try { parsed = JSON.parse(inputText) } catch { /* keep raw text */ }
    onReplay?.(call, parsed, tool, mapAgent)
    setAnnounce(`Replayed ${tool.name}`)
  }
  const open = (tool: AccessTool) => {
    if (!accessOf(tool)) return
    setOpenTool(tool.id); setCallIndex(0)
    setInputText(callsOf(tool)[0] ? stringify(callsOf(tool)[0].input) : '')
    setAnnounce(`${tool.name} opened`)
  }

  if (!current) return <div data-slot="tool-access-map" className={cn('w-full', className)}><AffectSurface className="p-3 text-xs text-muted-foreground">No agents to show.</AffectSurface></div>

  return (
    <div data-slot="tool-access-map" className={cn('w-full', className)}>
      <AffectSurface className="p-3">
        <AffectHeader title={title} description={current.task} actions={<AffectToneBadge tone={affectStatusTone[current.status]}>{current.status === 'waiting' ? 'Needs you' : current.status}</AffectToneBadge>} />
        <div role="tablist" aria-label="Agents" onKeyDown={onTabsKeyDown} className="mt-2 flex flex-wrap gap-1">
          {agents.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={current.id === item.id} tabIndex={current.id === item.id ? 0 : -1} onClick={() => chooseAgent(item.id)} className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]', current.id === item.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/60')}>
              {item.avatar ?? <span className="flex size-4 items-center justify-center rounded bg-muted text-[9px]">{item.name.slice(0, 1)}</span>}{item.name}
            </button>
          ))}
        </div>
        <div role="status" className="mt-2 flex gap-2 text-[10px] text-muted-foreground">
          <span>{counts.used} used</span><span>{counts.running} running</span><span>{counts.failed} failed</span><span>{tools.length - counts.used} unused</span>
        </div>

        {openAccess ? (
          <div role="tabpanel" aria-label={`${openAccess.name} calls`} onKeyDown={onCallsKeyDown} className="mt-3 rounded-md border border-border bg-background p-2">
            <div className="mb-2 flex items-center gap-2">
              <button type="button" aria-label="Back to tools" onClick={() => setOpenTool(null)} className="rounded p-1 text-muted-foreground hover:text-foreground"><ChevronLeft aria-hidden="true" className="size-3" /></button>
              <span className="text-xs font-medium text-foreground">{openAccess.name}</span>
              <AffectToneBadge tone="neutral">{calls.length} calls</AffectToneBadge>
            </div>
            {calls.length ? (
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <ul role="listbox" aria-label="Tool calls" className="space-y-0.5">
                  {calls.map((call, index) => (
                    <li key={call.id}>
                      <button type="button" role="option" aria-selected={callIndex === index} onClick={() => { setCallIndex(index); setInputText(stringify(call.input)) }} className={cn('w-full truncate rounded px-1.5 py-1 text-left text-[10px] hover:bg-muted/60', callIndex === index && 'bg-accent')}>
                        {call.id} · {call.status}{call.at !== undefined ? ` · ${formatTime(call.at)}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
                {selectedCall ? (
                  <div className="min-w-0 space-y-1.5">
                    <AffectToneBadge tone={affectStatusTone[selectedCall.status]}>{selectedCall.status === 'waiting' ? 'Needs you' : selectedCall.status}</AffectToneBadge>
                    {selectedCall.error ? <p className="text-[11px] text-destructive">{selectedCall.error}</p> : null}
                    {selectedCall.duration !== undefined ? <p className="text-[10px] text-muted-foreground">Took {formatDuration(selectedCall.duration)}</p> : null}
                    <div><span className="text-[10px] font-medium text-muted-foreground">Input</span><pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5 text-[10px] text-foreground">{stringify(selectedCall.input)}</pre></div>
                    {selectedCall.output !== undefined ? <div><span className="text-[10px] font-medium text-muted-foreground">Output</span><pre className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted p-1.5 text-[10px] text-foreground">{stringify(selectedCall.output)}</pre></div> : null}
                    {onReplay ? (
                      <div className="rounded-md border border-border p-1.5">
                        <label className="text-[10px] font-medium text-muted-foreground" htmlFor="tool-replay-input">Replay input</label>
                        <textarea id="tool-replay-input" rows={2} value={inputText} onChange={(event) => setInputText(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); replay(selectedCall, openAccess!, current) } }} className="mt-1 w-full resize-none rounded border border-border bg-background p-1.5 text-[10px] text-foreground outline-none" />
                        <div className="mt-1 flex items-center justify-between"><span className="text-[9px] text-muted-foreground">⌘Enter to run</span><button type="button" onClick={() => replay(selectedCall, openAccess!, current)} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground"><Play aria-hidden="true" className="size-3" />Replay</button></div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : <p className="py-4 text-center text-[11px] text-muted-foreground">No calls for this tool yet.</p>}
          </div>
        ) : (
          <div role="group" aria-label="Tools the agent can reach" className="mt-3 flex flex-wrap justify-center gap-2 rounded-lg border border-dashed border-border p-3">
            {tools.map((tool) => {
              const hasAccess = !!accessOf(tool)
              const status = statusOf(tool)
              const failed = status === 'Failed'
              const running = status === 'Running'
              return (
                <button key={tool.id} type="button" disabled={!hasAccess} aria-label={`${tool.name}. ${status}.`} onClick={() => open(tool)} className={cn('flex w-24 flex-col items-center gap-1 rounded-md border border-border bg-background p-2 text-center transition-colors', hasAccess ? 'hover:bg-muted/60' : 'cursor-not-allowed opacity-40', failed && 'border-destructive text-destructive', running && 'border-info ring-1 ring-info')}>
                  <span className="flex size-6 items-center justify-center rounded bg-muted text-muted-foreground">{tool.icon ?? <Wrench aria-hidden="true" className="size-3" />}</span>
                  <span className="w-full truncate text-[11px] font-medium text-foreground">{tool.name}</span>
                  <span className={cn('text-[9px] text-muted-foreground', failed && 'text-destructive', running && 'text-info')}>{status}</span>
                </button>
              )
            })}
          </div>
        )}
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
