import { X } from 'lucide-react'
import { useId, useState } from 'react'
import type { ChangeEvent, ClipboardEvent, KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface TagInputProps {
  value?: string[]
  defaultValue?: string[]
  onChange?: (tags: string[]) => void
  validate?: (tag: string) => true | string
  normalize?: (tag: string) => string
  splitOnSpace?: boolean
  max?: number
  avatar?: boolean
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  placeholder?: string
  name?: string
  disabled?: boolean
  className?: string
}

/** Field that turns typed or pasted text into removable chips. */
export function TagInput({
  value,
  defaultValue = [],
  onChange,
  validate,
  normalize = (t) => t.trim(),
  splitOnSpace = false,
  max,
  avatar,
  label,
  hint,
  error,
  optional,
  placeholder = 'Add…',
  name,
  disabled,
  className
}: TagInputProps) {
  const id = useId()
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<string[]>(defaultValue)
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const tags = isControlled ? value : internal
  const [active, setActive] = useState<number | null>(null)

  const update = (next: string[]) => {
    if (!isControlled) setInternal(next)
    onChange?.(next)
  }

  const addTag = (raw: string) => {
    const tag = normalize(raw)
    if (!tag) return
    if (tags.includes(tag)) { setMessage(`“${tag}” is already added.`); return }
    if (max !== undefined && tags.length >= max) { setMessage(`At most ${max} values.`); return }
    const result = validate?.(tag)
    if (typeof result === 'string') { setMessage(result); return }
    setMessage('')
    update([...tags, tag])
  }

  const addBatch = (batch: string) => {
    const parts = batch.split(splitOnSpace ? /[\s,;\n]+/ : /[,;\n]+/).map(normalize).filter(Boolean)
    const next = [...tags]
    for (const part of parts) {
      if (next.includes(part) || (max !== undefined && next.length >= max)) continue
      const result = validate?.(part)
      if (result === true || result === undefined) next.push(part)
    }
    if (next.length !== tags.length) { setMessage(''); update(next) }
  }

  const remove = (index: number) => {
    update(tags.filter((_, i) => i !== index))
    setActive(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || (event.key === ' ' && splitOnSpace)) {
      if (text.trim()) { event.preventDefault(); addTag(text); setText('') }
    } else if (event.key === 'Backspace') {
      if (!text && active !== null) remove(active)
      else if (!text && tags.length) setActive(tags.length - 1)
    } else if (event.key === 'ArrowLeft' && !text) {
      event.preventDefault()
      setActive((n) => (n === null ? tags.length - 1 : Math.max(0, n - 1)))
    } else if (event.key === 'ArrowRight' && active !== null) {
      event.preventDefault()
      setActive((n) => (n === null ? null : n + 1 >= tags.length ? null : n + 1))
    } else if (event.key === 'Escape') {
      setText('')
      setMessage('')
    }
  }

  return (
    <div data-slot="tag-input" className={cn('w-full space-y-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-foreground">
          {label}
          {optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}
        </label>
      ) : null}
      <div
        className={cn('flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 transition-colors focus-within:border-ring', error && 'border-destructive bg-destructive/5', disabled && 'opacity-60')}
        onClick={() => document.getElementById(`${id}-input`)?.focus()}
      >
        {tags.map((tag, i) => (
          <span key={`${tag}-${i}`} className={cn('inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground', active === i && 'ring-1 ring-ring')}>
            {avatar ? <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{tag.charAt(0).toUpperCase()}</span> : null}
            <span className="max-w-32 truncate">{tag}</span>
            <button type="button" aria-label={`Remove ${tag}`} disabled={disabled} onClick={(e) => { e.stopPropagation(); remove(i) }} className="text-muted-foreground hover:text-destructive"><X className="size-3" /></button>
          </span>
        ))}
        <input
          id={`${id}-input`}
          value={text}
          disabled={disabled}
          placeholder={tags.length ? 'Add more…' : placeholder}
          aria-invalid={Boolean(error || message) || undefined}
          aria-describedby={error || message ? `${id}-msg` : hint ? `${id}-hint` : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => { setText(e.target.value); setMessage('') }}
          onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
            const pasted = e.clipboardData.getData('text')
            if (/[,;\n]/.test(pasted) || (splitOnSpace && /\s/.test(pasted))) { e.preventDefault(); addBatch(pasted) }
          }}
          onKeyDown={onKeyDown}
          onBlur={() => { if (text.trim()) { addTag(text); setText('') } }}
          className="min-w-24 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
      </div>
      {name ? <input type="hidden" name={name} value={tags.join(',')} /> : null}
      <div className="flex items-start justify-between gap-2 text-[11px]">
        <span id={error || message ? `${id}-msg` : `${id}-hint`} role={error || message ? 'alert' : undefined} className={cn('min-w-0 break-words', error || message ? 'text-destructive' : 'text-muted-foreground')}>{error || message || hint}</span>
        {max ? <span className="shrink-0 tabular-nums text-muted-foreground">{tags.length}/{max}</span> : null}
      </div>
    </div>
  )
}
