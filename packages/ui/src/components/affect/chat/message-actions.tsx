import { Check, ChevronLeft, ChevronRight, Copy, LoaderCircle, RefreshCw, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectIconButton } from '../shared'

export type MessageActionKey = 'copy' | 'regenerate' | 'feedback' | 'speak'
export type FeedbackKind = 'up' | 'down' | null

export interface MessageActionsProps {
  text: string
  actions?: MessageActionKey[]
  versions?: number | string[]
  version?: number
  defaultVersion?: number
  onVersionChange?: (index: number) => void
  onCopy?: (text?: string) => void
  onRegenerate?: () => void
  regenerating?: boolean
  onFeedback?: (kind: FeedbackKind, reason?: string) => void
  reasons?: string[]
  onSpeak?: (playing: boolean) => void
  speaking?: boolean
  speakDuration?: number
  quiet?: boolean
  label?: string
  className?: string
}

const defaultActions: MessageActionKey[] = ['copy', 'regenerate', 'feedback', 'speak']
const defaultReasons = ['Not accurate', 'Too long', "Didn't follow instructions", 'Other']

/** Wrapper that keeps the message text together with its action bar. */
export function MessageText({ children, className }: { children?: ReactNode; className?: string }) {
  return <div data-slot="message-text" className={cn('text-sm leading-relaxed text-foreground', className)}>{children}</div>
}

/** The quiet bar under an assistant message: copy, regenerate, rate and read aloud. */
export function MessageActions({
  text,
  actions = defaultActions,
  versions = 1,
  version,
  defaultVersion,
  onVersionChange,
  onCopy,
  onRegenerate,
  regenerating = false,
  onFeedback,
  reasons = defaultReasons,
  onSpeak,
  speaking,
  speakDuration,
  quiet = true,
  label = 'Message actions',
  className
}: MessageActionsProps) {
  const count = typeof versions === 'number' ? versions : versions.length
  const [internalVersion, setInternalVersion] = useState(defaultVersion ?? count - 1)
  const current = version ?? internalVersion
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<FeedbackKind>(null)
  const [showReasons, setShowReasons] = useState(false)
  const [customReason, setCustomReason] = useState('')
  const [otherOpen, setOtherOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const downRef = useRef<HTMLButtonElement>(null)

  const isSpeaking = speaking ?? playing
  useEffect(() => {
    if (speaking !== undefined || !playing) return
    const id = window.setTimeout(() => {
      setPlaying(false)
      onSpeak?.(false)
    }, speakDuration ?? Math.max(2600, text.length * 45))
    return () => window.clearTimeout(id)
  }, [playing, speaking, speakDuration, text.length, onSpeak])

  const changeVersion = (next: number) => {
    const index = Math.max(0, Math.min(count - 1, next))
    if (version === undefined) setInternalVersion(index)
    setVote(null)
    onVersionChange?.(index)
  }

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      // Clipboard can be blocked in insecure contexts.
    }
    setCopied(true)
    onCopy?.(text)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const pickVote = (kind: FeedbackKind) => {
    const next = vote === kind ? null : kind
    setVote(next)
    setShowReasons(false)
    onFeedback?.(next)
  }

  const sendReason = (reason: string) => {
    setVote('down')
    setShowReasons(false)
    setOtherOpen(false)
    setCustomReason('')
    onFeedback?.('down', reason)
  }

  const toggleSpeak = () => {
    const next = !isSpeaking
    if (speaking === undefined) setPlaying(next)
    onSpeak?.(next)
  }

  return (
    <div
      role="toolbar"
      aria-label={label}
      data-slot="message-actions"
      className={cn(
        'flex flex-wrap items-center gap-1',
        quiet && 'opacity-60 transition-opacity hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100',
        className
      )}
    >
      {actions.includes('copy') ? (
        <AffectIconButton label={copied ? 'Copied' : 'Copy'} onClick={copy} active={copied}>
          {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
        </AffectIconButton>
      ) : null}
      {actions.includes('regenerate') ? (
        <span className="inline-flex items-center">
          <AffectIconButton label="Regenerate" onClick={onRegenerate} active={regenerating}>
            <RefreshCw aria-hidden="true" className={cn('size-3.5', regenerating && 'animate-spin')} />
          </AffectIconButton>
          {count > 1 ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] tabular-nums text-muted-foreground">
              <button type="button" aria-label="Previous version" onClick={() => changeVersion(current - 1)} className="rounded p-0.5 hover:text-foreground">
                <ChevronLeft aria-hidden="true" className="size-3" />
              </button>
              {current + 1} / {count}
              <button type="button" aria-label="Next version" onClick={() => changeVersion(current + 1)} className="rounded p-0.5 hover:text-foreground">
                <ChevronRight aria-hidden="true" className="size-3" />
              </button>
            </span>
          ) : null}
        </span>
      ) : null}
      {actions.includes('feedback') ? (
        <span className="inline-flex items-center gap-0.5">
          <AffectIconButton label="Good response" active={vote === 'up'} onClick={() => pickVote('up')}>
            <ThumbsUp aria-hidden="true" className="size-3.5" />
          </AffectIconButton>
          <button
            ref={downRef}
            type="button"
            aria-label="Bad response"
            aria-pressed={vote === 'down'}
            title="Bad response"
            onClick={() => setShowReasons((value) => !value)}
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-border focus-visible:outline-none',
              vote === 'down' && 'bg-accent text-accent-foreground'
            )}
          >
            <ThumbsDown aria-hidden="true" className="size-3.5" />
          </button>
        </span>
      ) : null}
      {actions.includes('speak') ? (
        <AffectIconButton label={isSpeaking ? 'Stop reading' : 'Read aloud'} active={isSpeaking} onClick={toggleSpeak}>
          {isSpeaking ? (
            <span aria-hidden="true" className="flex h-3.5 items-end gap-px">
              <span className="h-1.5 w-px animate-pulse bg-current" />
              <span className="h-3 w-px animate-pulse bg-current" />
              <span className="h-2 w-px animate-pulse bg-current" />
            </span>
          ) : (
            <Volume2 aria-hidden="true" className="size-3.5" />
          )}
        </AffectIconButton>
      ) : null}
      {showReasons ? (
        <span className="flex w-full flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-1.5">
          {reasons.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => (reason === 'Other' ? setOtherOpen((value) => !value) : sendReason(reason))}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {reason}
            </button>
          ))}
          {otherOpen ? (
            <input
              autoFocus
              value={customReason}
              onChange={(event) => setCustomReason(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendReason(customReason.trim() || 'Other')
                if (event.key === 'Escape') {
                  setShowReasons(false)
                  setOtherOpen(false)
                  downRef.current?.focus()
                }
              }}
              aria-label="Other reason"
              placeholder="Reason…"
              className="h-6 min-w-24 flex-1 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none"
            />
          ) : null}
        </span>
      ) : null}
      {regenerating ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" /> : null}
    </div>
  )
}
