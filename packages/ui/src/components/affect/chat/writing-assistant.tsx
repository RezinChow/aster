import { Mic, Plus, Send, Sparkles, Square } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'

export interface WritingAssistantProps {
  name?: string
  tagline?: string
  greeting?: string
  suggestions?: string[]
  placeholder?: string
  respond?: (message: string) => string | Promise<string>
  speech?: 'auto' | 'simulate'
  dictation?: string
  className?: string
}

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
}

function sampleWriter(message: string): string {
  const text = message.replace(/^(rewrite|shorten|translate|draft)\s*/i, '').trim()
  const subject = text || 'your text'
  return `Here's a first pass on ${subject}:\n\nKeep the message short and concrete. Lead with the outcome, add one supporting detail, then close with a clear next step.`
}

/** Small AI helper card with suggestions, streaming replies and simulated dictation. */
export function WritingAssistant({
  name = 'Quill',
  tagline = 'Your writing companion.',
  greeting = 'What should we write?',
  suggestions = ['Rewrite this', 'Make it shorter', 'Draft an update'],
  placeholder = 'Ask anything…',
  respond = sampleWriter,
  speech = 'auto',
  dictation = 'Help me write a short update for the team',
  className
}: WritingAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [spoken, setSpoken] = useState('')
  const nextId = useRef(0)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, thinking])

  useEffect(() => {
    if (!recording) return
    const words = dictation.split(/\s+/)
    let index = 0
    const id = window.setInterval(() => {
      index += 1
      setSpoken(words.slice(0, index).join(' '))
      if (index >= words.length) window.clearInterval(id)
    }, 200)
    return () => window.clearInterval(id)
  }, [recording, dictation])

  const send = async (raw: string) => {
    const text = raw.trim()
    if (!text || thinking) return
    setDraft('')
    setMessages((current) => [...current, { id: nextId.current++, role: 'user', text }])
    setThinking(true)
    try {
      const answer = await respond(text)
      const words = answer.split(/(\s+)/)
      const id = nextId.current++
      setMessages((current) => [...current, { id, role: 'assistant', text: '' }])
      for (let index = 0; index < words.length; index += 2) {
        await new Promise((resolve) => window.setTimeout(resolve, 24))
        setMessages((current) => current.map((item) => (item.id === id ? { ...item, text: item.text + words.slice(index, index + 2).join('') } : item)))
      }
    } finally {
      setThinking(false)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send(draft)
    }
  }
  const toggleRecording = () => {
    if (recording && spoken) setDraft(spoken)
    if (recording) setSpoken('')
    setRecording((value) => !value)
  }

  return (
    <div
      data-slot="writing-assistant"
      className={cn('flex w-full max-w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}
    >
      <div className="relative border-b border-border bg-accent/30 px-3 py-2.5">
        <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-primary/10 blur-xl" />
        <div className="flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkles aria-hidden="true" className="size-3.5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-foreground">{name}</span>
            <span className="block text-[10px] text-muted-foreground">{tagline}</span>
          </span>
          {messages.length ? (
            <button type="button" aria-label="New chat" onClick={() => { setMessages([]); setRecording(false); setSpoken('') }} className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div aria-live="polite" className="flex max-h-80 min-h-32 flex-1 flex-col gap-2 overflow-auto p-3">
        {!messages.length ? (
          <div className="my-auto space-y-3 text-center">
            <p className="text-sm font-medium text-foreground">{greeting}</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {suggestions.map((item) => (
                <button key={item} type="button" onClick={() => void send(item)} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">{item}</button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={cn('max-w-[88%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs leading-relaxed', message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
              {message.text}
            </div>
          ))
        )}
        {thinking ? (
          <div role="status" className="flex items-center gap-1 rounded-lg bg-muted px-2.5 py-2 text-[11px] text-muted-foreground">
            <span className="size-1 animate-pulse rounded-full bg-current" />
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
            <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div className="flex items-end gap-1.5 border-t border-border p-2">
        <textarea
          value={recording ? spoken : draft}
          onChange={(event) => (recording ? setSpoken(event.target.value) : setDraft(event.target.value))}
          onKeyDown={onKeyDown}
          rows={2}
          aria-label="Prompt"
          placeholder={recording ? 'Listening…' : placeholder}
          className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          aria-label={recording ? 'Stop dictation' : 'Start dictation'}
          aria-pressed={recording}
          onClick={toggleRecording}
          className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground', recording && 'bg-destructive/10 text-destructive')}
        >
          {recording ? <Square aria-hidden="true" className="size-3.5" /> : <Mic aria-hidden="true" className="size-4" />}
        </button>
        <button type="button" aria-label="Send" disabled={(!draft.trim() && !spoken) || thinking} onClick={() => void send(recording ? spoken : draft)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40">
          <Send aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <span className="sr-only">{speech === 'simulate' ? 'Simulated dictation' : ''}</span>
    </div>
  )
}
