import { Check, Copy, ExternalLink } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSurface } from '../shared'

export interface CitedSource {
  id: string
  title: string
  site: string
  url?: string
  date?: string
  quote?: string
  highlight?: string[]
  icon?: ReactNode
}

export interface CitedSegment {
  text: string
  cite?: string[]
  paragraph?: boolean
}

export interface CitedAnswerProps {
  segments: CitedSegment[]
  sources: CitedSource[]
  pagesRead?: number
  defaultOpen?: string
  onOpenSource?: (source: CitedSource) => void
  onPreviewChange?: (id: string | null) => void
  action?: { label: string; onClick: () => void }
  className?: string
}

function quoted(text: string, highlights: string[]): ReactNode {
  if (!highlights.length) return text
  const escaped = highlights.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'g')
  return text.split(pattern).map((part, index) =>
    highlights.includes(part) ? (
      <mark key={index} className="rounded bg-warning-subtle px-0.5 text-warning-subtle-foreground">{part}</mark>
    ) : (
      part
    )
  )
}

/** A finished answer whose sentences light up with the source behind each citation. */
export function CitedAnswer({
  segments,
  sources,
  pagesRead,
  defaultOpen,
  onOpenSource,
  onPreviewChange,
  action,
  className
}: CitedAnswerProps) {
  const previewId = useId()
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [openId, setOpenId] = useState<string | null>(defaultOpen ?? null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const indexOf = (id: string) => sources.findIndex((source) => source.id === id)
  const setOpen = (id: string | null) => {
    setOpenId(id)
    onPreviewChange?.(id)
  }

  const openSource = (source: CitedSource) => {
    if (onOpenSource) onOpenSource(source)
    else if (source.url) window.open(source.url, '_blank', 'noopener,noreferrer')
  }
  const copyQuote = async (source: CitedSource) => {
    try {
      await navigator.clipboard?.writeText(source.quote ?? source.title)
    } catch {
      // Clipboard may be unavailable.
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  const onChipKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? sources.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + sources.length) % sources.length
    const source = sources[next]
    if (!source) return
    chipRefs.current[source.id]?.focus()
    setActiveId(source.id)
  }

  const openSourceData = openId ? sources[indexOf(openId)] : undefined
  return (
    <div data-slot="cited-answer" className={cn('w-full max-w-[460px] space-y-2', className)}>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{sources.length} sources{pagesRead !== undefined ? ` · ${pagesRead} pages read` : ''}</span>
        {action ? (
          <button type="button" onClick={action.onClick} className="rounded text-muted-foreground hover:text-foreground">
            {action.label}
          </button>
        ) : null}
      </div>
      <div className="space-y-1 text-xs leading-relaxed text-foreground">
        {segments.map((segment, index) => {
          const isActive = segment.cite?.some((id) => id === activeId) ?? false
          return (
            <p key={index} className={cn('rounded px-1 py-0.5', segment.paragraph && 'mt-2', isActive && 'bg-info-subtle')}>
              {segment.text}
              {segment.cite?.map((id) => {
                const position = indexOf(id)
                if (position < 0) return null
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={`Source ${position + 1}: ${sources[position]?.site} – ${sources[position]?.title}`}
                    aria-expanded={openId === id}
                    aria-controls={previewId}
                    onFocus={() => setActiveId(id)}
                    onBlur={() => setActiveId(null)}
                    onMouseEnter={() => setActiveId(id)}
                    onMouseLeave={() => setActiveId(null)}
                    onClick={() => setOpen(openId === id ? null : id)}
                    className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-info-subtle px-1 align-baseline text-[10px] font-medium text-info hover:underline"
                  >
                    {position + 1}
                  </button>
                )
              })}
            </p>
          )
        })}
      </div>
      {openSourceData ? (
        <AffectSurface id={previewId} role="region" aria-label={`Source ${indexOf(openSourceData.id) + 1} preview`} className="p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">{openSourceData.title}</span>
              <span className="block text-[10px] text-muted-foreground">{openSourceData.site}{openSourceData.date ? ` · ${openSourceData.date}` : ''}</span>
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{indexOf(openSourceData.id) + 1}</span>
          </div>
          {openSourceData.quote ? (
            <blockquote className="mt-2 border-l-2 border-border pl-2 text-[11px] leading-relaxed text-muted-foreground">
              {quoted(openSourceData.quote, openSourceData.highlight ?? [])}
            </blockquote>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => openSource(openSourceData)} className="inline-flex items-center gap-1 text-[11px] text-foreground hover:underline">
              <ExternalLink aria-hidden="true" className="size-3" />Open source
            </button>
            <button type="button" onClick={() => copyQuote(openSourceData)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              {copied ? <Check aria-hidden="true" className="size-3" /> : <Copy aria-hidden="true" className="size-3" />}
              {copied ? 'Quote copied' : 'Copy quote'}
            </button>
          </div>
        </AffectSurface>
      ) : null}
      <div role="group" aria-label="Sources" className="flex flex-wrap gap-1" onKeyDown={(event) => {
        if (event.key === 'Escape' && openId) {
          event.preventDefault()
          setOpen(null)
          chipRefs.current[openId]?.focus()
        }
      }}>
        {sources.map((source, index) => (
          <button
            key={source.id}
            ref={(el) => {
              chipRefs.current[source.id] = el
            }}
            type="button"
            aria-expanded={openId === source.id}
            onKeyDown={(event) => onChipKey(event, index)}
            onFocus={() => setActiveId(source.id)}
            onBlur={() => setActiveId(null)}
            onClick={() => setOpen(openId === source.id ? null : source.id)}
            className={cn(
              'max-w-40 truncate rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground',
              (activeId === source.id || openId === source.id) && 'border-primary bg-accent text-foreground'
            )}
          >
            {index + 1} · {source.title}
          </button>
        ))}
      </div>
    </div>
  )
}
