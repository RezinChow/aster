import { ChevronDown, Layers3 } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectTone } from '../shared/types'
import { AffectEmpty, AffectHeader, AffectSurface, AffectToneBadge, affectToneClass } from '../shared/ui'

export type ContextKind = 'system' | 'tools' | 'memory' | 'file' | 'chat' | 'result' | 'summary'
export interface ContextBlock {
  id: string
  label: string
  kind: ContextKind
  tokens: number
  detail?: string
  icon?: ReactNode
  items?: { label: string; icon?: ReactNode }[]
}
export interface ContextCompaction {
  before: ContextBlock[]
  summarized?: string[]
  dropped?: string[]
  summary?: string
}
export interface ContextAgent { id: string; name: string }
export interface ContextMapProps {
  blocks: ContextBlock[]
  limit: number
  model?: string
  modelIcon?: ReactNode
  agents?: ContextAgent[]
  agent?: string
  onAgentChange?: (id: string) => void
  compaction?: ContextCompaction | null
  view?: 'before' | 'after'
  onViewChange?: (view: 'before' | 'after') => void
  status?: string
  onSelect?: (block: ContextBlock | null) => void
  title?: string
  className?: string
}

const kindTone: Record<ContextKind, AffectTone> = {
  system: 'neutral', tools: 'info', memory: 'primary', file: 'success',
  chat: 'warning', result: 'danger', summary: 'neutral'
}
const kindLabel: Record<ContextKind, string> = {
  system: 'System', tools: 'Tools', memory: 'Memory', file: 'File',
  chat: 'Chat', result: 'Result', summary: 'Summary'
}

/** A living treemap of what fills an agent's context window. */
export function ContextMap({
  blocks, limit, model, modelIcon, agents, agent, onAgentChange, compaction,
  view, onViewChange, status, onSelect, title = 'Context', className
}: ContextMapProps) {
  const [localView, setLocalView] = useState<'before' | 'after'>('after')
  const [localAgent, setLocalAgent] = useState<string | undefined>(agents?.[0]?.id)
  const [agentOpen, setAgentOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const side = view ?? localView
  const currentAgent = agent ?? localAgent
  const shown = side === 'before' && compaction ? compaction.before : blocks
  const used = shown.reduce((sum, block) => sum + block.tokens, 0)
  const free = Math.max(0, limit - used)
  const percent = Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  const selected = shown.find((block) => block.id === selectedId) ?? null
  const chooseView = (next: 'before' | 'after') => {
    if (view === undefined) setLocalView(next)
    onViewChange?.(next)
  }
  const chooseAgent = (id: string) => {
    if (agent === undefined) setLocalAgent(id)
    onAgentChange?.(id)
    setAgentOpen(false)
  }
  const select = (block: ContextBlock | null) => {
    setSelectedId(block?.id ?? null)
    onSelect?.(block)
  }

  return (
    <AffectSurface className={cn('w-full', className)} data-slot="context-map">
      <div className="space-y-2 p-3">
        <AffectHeader title={title}
          description={<span aria-live="polite">{used.toLocaleString()} / {limit.toLocaleString()} tokens · {percent}% full</span>}
          actions={
            <span className="flex items-center gap-1.5">
              {status ? <AffectToneBadge tone="warning">{status}</AffectToneBadge> : null}
              {modelIcon}{model ? <span className="text-[10px] text-muted-foreground">{model}</span> : null}
              {agents?.length ? (
                <div className="relative">
                  <button type="button" aria-haspopup="listbox" aria-expanded={agentOpen} onClick={() => setAgentOpen(!agentOpen)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-foreground">
                    {agents.find((item) => item.id === currentAgent)?.name ?? 'Agent'} <ChevronDown aria-hidden="true" className="size-3" />
                  </button>
                  {agentOpen ? (
                    <ul role="listbox" className="absolute right-0 z-10 mt-1 w-32 rounded-md border border-border bg-card p-1 shadow-md">
                      {agents.map((item) => (
                        <li key={item.id} role="option" aria-selected={item.id === currentAgent}>
                          <button type="button" onClick={() => chooseAgent(item.id)} className="w-full rounded px-2 py-1 text-left text-[11px] hover:bg-muted">{item.name}</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </span>
          } />

        {compaction ? (
          <div role="radiogroup" aria-label="Compaction view" className="flex w-fit gap-0.5 rounded-md border border-border p-0.5">
            {(['before', 'after'] as const).map((option) => (
              <button key={option} type="button" role="radio" aria-checked={side === option} onClick={() => chooseView(option)}
                className={cn('rounded px-2 py-0.5 text-[10px] capitalize', side === option ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {shown.length ? (
          <div role="list" aria-label={title} className="flex h-36 w-full gap-0.5 overflow-hidden rounded-md border border-border bg-muted/20">
            {shown.map((block) => {
              const summarized = side === 'before' && compaction?.summarized?.includes(block.id)
              const dropped = side === 'before' && compaction?.dropped?.includes(block.id)
              return (
                <button key={block.id} type="button" role="listitem"
                  aria-label={`${block.label}, ${kindLabel[block.kind]}, ${block.tokens} tokens`}
                  aria-pressed={selectedId === block.id}
                  onClick={() => select(selectedId === block.id ? null : block)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(block) } }}
                  title={`${block.label} · ${block.tokens} tokens${block.detail ? ` · ${block.detail}` : ''}`}
                  className={cn('flex min-w-0 flex-col items-start justify-end overflow-hidden rounded-sm p-1 text-left transition-[flex] duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    affectToneClass[kindTone[block.kind]],
                    (summarized || dropped) && 'opacity-40',
                    dropped && 'border border-dashed border-destructive',
                    selectedId === block.id && 'ring-2 ring-ring')}
                  style={{ flexGrow: Math.max(1, block.tokens), flexBasis: 0 }}>
                  <span className="w-full truncate text-[9px] font-medium">{block.icon}{block.label}</span>
                  <span className="w-full truncate text-[9px] tabular-nums opacity-80">{block.tokens.toLocaleString()}</span>
                </button>
              )
            })}
            {free > 0 ? (
              <span role="listitem" aria-label={`${free} free tokens`}
                className="flex min-w-0 flex-col items-start justify-end rounded-sm border border-dashed border-border p-1 text-[9px] text-muted-foreground"
                style={{ flexGrow: Math.max(1, free), flexBasis: 0 }}>
                <span className="truncate">Free</span>
                <span className="tabular-nums">{free.toLocaleString()}</span>
              </span>
            ) : null}
          </div>
        ) : <AffectEmpty>No context blocks yet.</AffectEmpty>}

        {compaction?.summary ? (
          <p className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">
            <Layers3 aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">Compacted: {compaction.summary}</span>
          </p>
        ) : null}

        {selected ? (
          <div role="status" className="space-y-1 rounded-md border border-border bg-background p-2 text-[11px]">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-foreground">{selected.label}</span>
              <AffectToneBadge tone={kindTone[selected.kind]}>{kindLabel[selected.kind]}</AffectToneBadge>
            </span>
            {selected.detail ? <p className="text-muted-foreground">{selected.detail}</p> : null}
            {selected.items?.length ? (
              <ul role="list" className="flex flex-wrap gap-1">
                {selected.items.map((item) => (
                  <li key={item.label} className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">{item.icon}{item.label}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </AffectSurface>
  )
}
