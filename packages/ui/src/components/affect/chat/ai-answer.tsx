import { Check, Copy, RefreshCw, Square, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectIconButton } from '../shared'

export interface AnswerSource {
  name: string
  title: string
  href?: string
  icon?: ReactNode
  snippet?: string
}

export interface AiAnswerProps {
  question?: string
  sources?: AnswerSource[]
  answer: string
  streaming?: boolean
  animate?: boolean
  speed?: number
  followUps?: string[]
  onFollowUp?: (question: string) => void
  onRegenerate?: () => void
  onStop?: () => void
  onFeedback?: (value: 'up' | 'down', reason?: string) => void
  feedbackReasons?: string[]
  onCopy?: (text: string) => void
  framed?: boolean
  className?: string
}

function CitationChip({
  number,
  source,
  open,
  onToggle,
  onOpen
}: {
  number: number
  source: AnswerSource
  open: boolean
  onToggle: () => void
  onOpen: () => void
}) {
  return (
    <span className="relative inline-flex align-baseline">
      <button
        type="button"
        aria-label={`Source ${number}: ${source.name} – ${source.title}`}
        aria-expanded={open}
        onFocus={onOpen}
        onClick={onToggle}
        className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-info-subtle px-1 align-baseline text-[10px] font-medium text-info hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {number}
      </button>
      {open ? (
        <span role="tooltip" className="absolute bottom-full left-0 z-20 mb-1 w-56 rounded-md border border-border bg-card p-2 text-left shadow-lg">
          <span className="block text-[11px] font-medium text-foreground">{source.title}</span>
          <span className="mt-0.5 block text-[10px] text-muted-foreground">{source.name}</span>
          {source.snippet ? <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{source.snippet}</span> : null}
        </span>
      ) : null}
    </span>
  )
}

/** A streamed answer with source cards, citation previews, copy, feedback and follow-ups. */
export function AiAnswer({
  question,
  sources = [],
  answer,
  streaming = false,
  animate = true,
  speed = 38,
  followUps = [],
  onFollowUp,
  onRegenerate,
  onStop,
  onFeedback,
  feedbackReasons = ['Not accurate', 'Wrong source', 'Too long', 'Out of date'],
  onCopy,
  framed = false,
  className
}: AiAnswerProps) {
  const words = useMemo(() => answer.split(/(\s+)/), [answer])
  const [progress, setProgress] = useState(() => (animate && !streaming ? 0 : Number.MAX_SAFE_INTEGER))
  const [preview, setPreview] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const [showReasons, setShowReasons] = useState(false)
  const lastAnswer = useRef(answer)
  useEffect(() => {
    if (lastAnswer.current !== answer) {
      lastAnswer.current = answer
      setProgress(0)
    }
  }, [answer])
  useEffect(() => {
    if (!animate || streaming || progress >= words.length) return
    const id = window.setTimeout(() => setProgress((value) => value + 1), Math.max(12, 1000 / Math.max(1, speed)))
    return () => window.clearTimeout(id)
  }, [animate, streaming, progress, words.length, speed])

  const visible = animate && !streaming ? words.slice(0, progress).join('') : answer
  const inline = (text: string): ReactNode =>
    text.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g).map((token, index) => {
      if (/^\*\*[^*]+\*\*$/.test(token)) {
        return <strong key={index} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>
      }
      const match = /^\[(\d+(?:\s*,\s*\d+)*)\]$/.exec(token)
      if (match) {
        return (
          <span key={index} className="inline-flex flex-wrap gap-0.5">
            {match[1].split(',').map((raw) => {
              const number = Number(raw.trim())
              const source = sources[number - 1]
              if (!source) return null
              return (
                <CitationChip
                  key={number}
                  number={number}
                  source={source}
                  open={preview === number}
                  onToggle={() => setPreview(preview === number ? null : number)}
                  onOpen={() => setPreview(number)}
                />
              )
            })}
          </span>
        )
      }
      return token
    })
  const body = visible.split(/\n\s*\n/).map((block, blockIndex) => {
    const lines = block.split('\n')
    const isList = lines.every((line) => line.trimStart().startsWith('- '))
    if (isList) {
      return (
        <ul key={blockIndex} className="my-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-foreground">
          {lines.map((line, lineIndex) => <li key={lineIndex}>{inline(line.trimStart().slice(2))}</li>)}
        </ul>
      )
    }
    return (
      <p key={blockIndex} className="my-1 text-xs leading-relaxed text-foreground">
        {lines.map((line, lineIndex) => (
          <span key={lineIndex}>{lineIndex > 0 ? <br /> : null}{inline(line)}</span>
        ))}
      </p>
    )
  })

  const copy = async () => {
    const plain = answer.replace(/\*\*/g, '').replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '')
    const list = sources.length
      ? `\n\nSources:\n${sources.map((source, index) => `[${index + 1}] ${source.title}${source.href ? ` (${source.href})` : ''}`).join('\n')}`
      : ''
    try {
      await navigator.clipboard?.writeText(plain + list)
    } catch {
      // Clipboard may be unavailable.
    }
    setCopied(true)
    onCopy?.(plain + list)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-slot="ai-answer"
      aria-busy={streaming || undefined}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setPreview(null)
      }}
      className={cn('w-full max-w-[640px]', framed && 'rounded-lg bg-muted p-3', className)}
    >
      <div className={cn('space-y-3', framed && 'rounded-lg border border-border bg-card p-4 shadow-sm')}>
        {question ? <div className="text-sm font-medium text-foreground">{question}</div> : null}
        {sources.length ? (
          <div className="flex flex-wrap gap-1.5">
            {sources.slice(0, 3).map((source, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPreview(preview === index + 1 ? null : index + 1)}
                onFocus={() => setPreview(index + 1)}
                className="max-w-44 truncate rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {source.icon ? <span aria-hidden="true" className="mr-1 inline-flex">{source.icon}</span> : null}
                {source.name} · {source.title}
              </button>
            ))}
            {sources.length > 3 ? (
              <span className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">+{sources.length - 3}</span>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-0.5">{body}</div>
        {streaming ? (
          <span className="inline-block h-3 w-0.5 animate-pulse bg-foreground align-middle" aria-hidden="true" />
        ) : null}
        <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
          <AffectIconButton label={copied ? 'Copied' : 'Copy answer'} onClick={copy} active={copied}>
            {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
          </AffectIconButton>
          {onRegenerate ? <AffectIconButton label="Regenerate" onClick={onRegenerate}><RefreshCw aria-hidden="true" className="size-3.5" /></AffectIconButton> : null}
          {streaming && onStop ? <AffectIconButton label="Stop" onClick={onStop}><Square aria-hidden="true" className="size-3.5" /></AffectIconButton> : null}
          <AffectIconButton label="Good answer" active={vote === 'up'} onClick={() => { const next = vote === 'up' ? null : 'up'; setVote(next); setShowReasons(false); if (next) onFeedback?.(next) }}>
            <ThumbsUp aria-hidden="true" className="size-3.5" />
          </AffectIconButton>
          <AffectIconButton label="Bad answer" active={vote === 'down'} onClick={() => { setVote('down'); setShowReasons((value) => !value) }}>
            <ThumbsDown aria-hidden="true" className="size-3.5" />
          </AffectIconButton>
          {showReasons ? (
            <span className="flex w-full flex-wrap gap-1">
              {feedbackReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => { setShowReasons(false); onFeedback?.('down', reason) }}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {reason}
                </button>
              ))}
            </span>
          ) : null}
        </div>
        {!streaming && followUps.length ? (
          <div className="flex flex-wrap gap-1.5">
            {followUps.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onFollowUp?.(item)}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <span role="status" className="sr-only">{copied ? 'Copied' : ''}</span>
      </div>
    </div>
  )
}
