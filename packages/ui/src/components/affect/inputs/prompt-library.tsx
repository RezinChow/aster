import { Check, Copy, Search } from 'lucide-react'
import { useId, useMemo, useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface } from '../shared'

export interface PromptVariable {
  description?: string
  default?: string
}

export interface PromptTemplate {
  id: string
  title: string
  category?: string
  tone?: string
  body: string
  variables?: Record<string, PromptVariable>
}

export interface PromptLibraryProps {
  templates: PromptTemplate[]
  value?: string
  defaultValue?: string
  onSelect?: (id: string) => void
  onUse?: (prompt: string, template: PromptTemplate, values: Record<string, string>) => void
  onCopy?: (prompt: string) => void
  title?: string
  useLabel?: string
  className?: string
}

/** Saved prompt templates with inline variables and a live assembled prompt. */
export function PromptLibrary({
  templates,
  value,
  defaultValue,
  onSelect,
  onUse,
  onCopy,
  title = 'Prompts',
  useLabel = 'Use prompt',
  className
}: PromptLibraryProps) {
  const id = useId()
  const [internal, setInternal] = useState(defaultValue ?? templates[0]?.id ?? '')
  const selectedId = value ?? internal
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const template = templates.find((t) => t.id === selectedId) ?? templates[0]
  const variableNames = useMemo(() => template ? Array.from(new Set(template.body.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? [])) : [], [template])
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(variableNames.map((name) => [name, template?.variables?.[name]?.default ?? ''])))

  const choose = (nextId: string) => {
    if (value === undefined) setInternal(nextId)
    onSelect?.(nextId)
    const next = templates.find((t) => t.id === nextId)
    setValues(Object.fromEntries((next ? Array.from(new Set(next.body.match(/\{(\w+)\}/g)?.map((m) => m.slice(1, -1)) ?? [])) : []).map((name) => [name, next?.variables?.[name]?.default ?? ''])))
  }

  const built = template ? template.body.replace(/\{(\w+)\}/g, (_, name: string) => values[name] || `{${name}}`) : ''
  const missing = variableNames.filter((name) => !values[name]?.trim())
  const ready = Boolean(template) && missing.length === 0
  const filtered = templates.filter((t) => `${t.title} ${t.category ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  const copy = () => {
    void navigator.clipboard?.writeText(built)
    setCopied(true)
    onCopy?.(built)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <AffectSurface data-slot="prompt-library" className={cn('w-full max-w-[640px] p-3', className)}>
      <h2 className="mb-2 text-sm font-medium text-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute top-2 left-2 size-3.5 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompts…" aria-label="Search prompts" className="h-8 w-full rounded-md border border-border bg-background pr-2 pl-7 text-xs text-foreground outline-none focus:border-ring" />
          </div>
          <div role="listbox" aria-label={title} className="max-h-72 space-y-0.5 overflow-auto">
            {filtered.map((item) => (
              <div key={item.id} role="option" aria-selected={item.id === selectedId} tabIndex={0} onClick={() => choose(item.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(item.id) } }} className={cn('cursor-pointer rounded-md px-2 py-1.5 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring', item.id === selectedId ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted')}>
                <span className="block truncate font-medium">{item.title}</span>
                {item.category ? <span className="block text-[10px] text-muted-foreground">{item.category}</span> : null}
              </div>
            ))}
          </div>
        </div>
        {template ? (
          <div className="min-w-0 space-y-3 rounded-md border border-border bg-background p-3">
            <div className="text-xs font-medium text-foreground">{template.title}</div>
            <div className="space-y-2">
              {variableNames.map((name) => (
                <label key={name} className="block space-y-1 text-[11px] text-muted-foreground">
                  {name}{template.variables?.[name]?.description ? ` — ${template.variables[name].description}` : ''}
                  <input value={values[name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))} aria-label={name} className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring" />
                </label>
              ))}
            </div>
            <div className="rounded-md bg-muted p-2 text-xs leading-relaxed text-foreground">{built}</div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">{missing.length ? `${missing.length} variable${missing.length > 1 ? 's' : ''} left` : 'Ready'}</span>
              <div className="flex gap-2">
                <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted">{copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />} Copy</button>
                <button type="button" aria-disabled={!ready} onClick={() => { if (ready) onUse?.(built, template, values) }} className={cn('rounded-md bg-primary px-2.5 py-1.5 text-xs text-primary-foreground', !ready && 'opacity-50')}>{useLabel}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <span id={`${id}-status`} className="sr-only" aria-live="polite">{ready ? 'Prompt ready' : 'Variables missing'}</span>
    </AffectSurface>
  )
}
