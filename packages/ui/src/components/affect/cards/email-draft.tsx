import { Check, ChevronDown, Paperclip, Pencil, Send, Undo2, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectToneBadge } from '../shared'

export interface DraftContact {
  name: string
  email: string
}

export interface DraftTone {
  id: string
  label: string
  body: (contact: DraftContact) => string
}

export interface EmailDraftProps {
  reference?: string
  account?: string
  amount?: string
  status?: string
  agent?: string
  contacts?: DraftContact[]
  attachment?: string | null
  tones?: DraftTone[]
  link?: { label: string; href: string }
  onSend?: (email: { to: DraftContact; body: string; attachment: string | null }) => void
  onDiscard?: () => void
  className?: string
}

const defaultTones: DraftTone[] = [
  { id: 'friendly', label: 'Friendly', body: (c) => `Hi ${c.name},\n\nJust a friendly reminder that your subscription is coming up for renewal. Let me know if you need anything.\n\nBest` },
  { id: 'short', label: 'Short', body: (c) => `Hi ${c.name} — your subscription renews soon. Reply if you need changes.` },
  { id: 'formal', label: 'Formal', body: (c) => `Dear ${c.name},\n\nWe are writing to confirm the upcoming renewal of your account. Please contact us with any questions.\n\nSincerely` }
]

/** Agent-written email for review: recipient, tone, inline edit, attachment and send/undo. */
export function EmailDraft({
  reference = 'SUB-1182',
  account = 'Northwind Logistics',
  amount = '$8,900',
  status = 'Renews in 5 days',
  agent = 'Renewal agent',
  contacts = [{ name: 'Jonas Weber', email: 'jonas@northwind.io' }],
  attachment = 'Renewal-quote.pdf',
  tones = defaultTones,
  link,
  onSend,
  onDiscard,
  className
}: EmailDraftProps) {
  const [contactIndex, setContactIndex] = useState(0)
  const [toneId, setToneId] = useState(tones[0]?.id ?? 'friendly')
  const [body, setBody] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [file, setFile] = useState<string | null>(attachment)
  const [recipientOpen, setRecipientOpen] = useState(false)
  const [outcome, setOutcome] = useState<'sent' | 'discarded' | null>(null)
  const contact = contacts[contactIndex] ?? contacts[0]
  const tone = tones.find((item) => item.id === toneId) ?? tones[0]
  const text = body ?? (contact && tone ? tone.body(contact) : '')

  const chooseContact = (index: number) => {
    setContactIndex(index)
    setBody(null)
    setRecipientOpen(false)
  }
  const chooseTone = (id: string) => {
    setToneId(id)
    setBody(null)
  }
  const send = () => {
    if (!contact) return
    onSend?.({ to: contact, body: text, attachment: file })
    setOutcome('sent')
    setEditing(false)
  }
  const discard = () => {
    onDiscard?.()
    setOutcome('discarded')
  }
  const onBodyKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      send()
    }
    if (event.key === 'Escape') setEditing(false)
  }

  if (!contact) return null
  return (
    <div data-slot="email-draft" className={cn('w-full max-w-[520px] rounded-lg border border-border bg-card p-3 text-xs text-foreground', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{reference}</span>
          <span className="ml-1.5 truncate text-muted-foreground">{account}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status ? <AffectToneBadge tone="warning">{status}</AffectToneBadge> : null}
          <span className="font-medium">{amount}</span>
        </div>
      </div>
      <div className="relative mt-3">
        <span className="mr-1 text-muted-foreground">To</span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={recipientOpen}
          onClick={() => setRecipientOpen((value) => !value)}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-foreground hover:bg-muted"
        >
          {contact.name} <span className="text-muted-foreground">&lt;{contact.email}&gt;</span>
          <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
        </button>
        {recipientOpen ? (
          <div role="listbox" aria-label="Recipient" className="absolute z-20 mt-1 w-64 rounded-md border border-border bg-card p-1 shadow-lg">
            {contacts.map((item, index) => (
              <button
                key={item.email}
                type="button"
                role="option"
                aria-selected={index === contactIndex}
                onClick={() => chooseContact(index)}
                className={cn('block w-full rounded px-2 py-1 text-left hover:bg-muted', index === contactIndex && 'bg-accent')}
              >
                <span className="block font-medium">{item.name}</span>
                <span className="block text-[10px] text-muted-foreground">{item.email}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-muted-foreground">Tone</span>
        {tones.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === toneId}
            onClick={() => chooseTone(item.id)}
            className={cn('rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground', item.id === toneId && 'border-primary bg-accent text-foreground')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-md border border-border bg-background p-2.5">
        {editing ? (
          <textarea
            autoFocus
            value={text}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onBodyKey}
            aria-label="Email body"
            rows={6}
            className="w-full resize-y bg-transparent text-xs leading-relaxed text-foreground outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="block w-full text-left" aria-label="Edit email body">
            <span className="whitespace-pre-wrap leading-relaxed">{text}</span>
            <Pencil aria-hidden="true" className="ml-1 inline size-3 text-muted-foreground" />
          </button>
        )}
        {link ? (
          <a href={link.href} className="mt-2 inline-block text-[11px] text-info hover:underline">{link.label}</a>
        ) : null}
        {file ? (
          <span className="mt-2 flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            <Paperclip aria-hidden="true" className="size-3" />
            <span className="truncate">{file}</span>
            <button type="button" aria-label="Remove attachment" onClick={() => setFile(null)} className="ml-auto rounded p-0.5 hover:text-foreground"><X aria-hidden="true" className="size-3" /></button>
          </span>
        ) : (
          <button type="button" onClick={() => setFile(attachment)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Paperclip aria-hidden="true" className="size-3" />Add attachment
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Drafted by {agent}</span>
        <span className="flex-1" />
        <button type="button" onClick={discard} className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">Discard</button>
        <button type="button" onClick={send} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] text-primary-foreground">
          <Send aria-hidden="true" className="size-3" />Send
        </button>
      </div>
      {outcome ? (
        <div role="status" className="mt-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1.5 text-[11px] text-foreground">
          <Check aria-hidden="true" className="size-3.5 text-success" />
          {outcome === 'sent' ? 'Email sent' : 'Draft discarded'}
          <button type="button" onClick={() => setOutcome(null)} className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Undo2 aria-hidden="true" className="size-3" />Undo
          </button>
        </div>
      ) : null}
    </div>
  )
}
