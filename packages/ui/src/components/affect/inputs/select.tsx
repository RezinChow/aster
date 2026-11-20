import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'

import { cn } from '../../../lib/utils'
import type { AffectSize } from '../shared'

export interface SelectOption {
  value: string
  label: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}

export interface SelectProps {
  options: SelectOption[]
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string, option: SelectOption) => void
  placeholder?: string
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  size?: AffectSize
  disabled?: boolean
  name?: string
  required?: boolean
  'aria-label'?: string
  className?: string
  ref?: Ref<HTMLButtonElement>
}

const sizeClass: Record<AffectSize, string> = { sm: 'h-8', md: 'h-9', lg: 'h-10' }

/** Single-choice listbox styled like a text field, with type-ahead and keyboard control. */
export function Select({
  options,
  value,
  defaultValue = null,
  onChange,
  placeholder = 'Choose…',
  label,
  hint,
  error,
  optional,
  size = 'md',
  disabled,
  name,
  required,
  'aria-label': ariaLabel,
  className,
  ref
}: SelectProps) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState<string | null>(defaultValue)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const current = isControlled ? value : internal
  const selected = options.find((o) => o.value === current)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const pick = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    if (!isControlled) setInternal(option.value)
    setOpen(false)
    onChange?.(option.value, option)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') { setOpen(false); return }
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      setOpen(true)
      const selectedIndex = options.findIndex((o) => o.value === current)
      setActive(selectedIndex >= 0 ? selectedIndex : 0)
      return
    }
    if (!open) {
      if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
        const found = options.findIndex((o) => o.label.toLowerCase().startsWith(event.key.toLowerCase()) && !o.disabled)
        if (found >= 0 && !isControlled) { setInternal(options[found].value); onChange?.(options[found].value, options[found]) }
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      let next = active
      for (let i = 0; i < options.length; i++) {
        next = (next + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        if (!options[next].disabled) break
      }
      setActive(next)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const next = event.key === 'Home' ? options.findIndex((o) => !o.disabled) : options.map((o) => !o.disabled).lastIndexOf(true)
      if (next >= 0) setActive(next)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(active)
    }
  }

  return (
    <div ref={rootRef} data-slot="select" className={cn('relative w-full space-y-1.5', className)}>
      {label ? <label id={`${id}-label`} className="flex items-center gap-1 text-xs font-medium text-foreground">{label}{optional ? <span className="text-[11px] font-normal text-muted-foreground">Optional</span> : null}</label> : null}
      <button
        ref={ref}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        aria-required={required}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={cn('flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-left text-sm text-foreground transition-colors focus-visible:border-ring disabled:opacity-50', sizeClass[size], error && 'border-destructive bg-destructive/5')}
      >
        <span className={cn('flex min-w-0 items-center gap-2', !selected && 'text-muted-foreground')}>
          {selected?.icon ? <span className="shrink-0 text-muted-foreground">{selected.icon}</span> : null}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      <span id={error ? `${id}-error` : `${id}-hint`} className={cn('block text-[11px]', error ? 'text-destructive' : 'text-muted-foreground')} role={error ? 'alert' : undefined}>{error || hint}</span>
      {name ? <input type="hidden" name={name} value={current ?? ''} /> : null}
      {open ? (
        <div id={`${id}-list`} role="listbox" aria-labelledby={label ? `${id}-label` : undefined} className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={option.value === current}
              aria-disabled={option.disabled || undefined}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(index)}
              className={cn('flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs', index === active && 'bg-accent text-accent-foreground', option.disabled && 'pointer-events-none opacity-40')}
            >
              {option.icon ? <span className="shrink-0 text-muted-foreground">{option.icon}</span> : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{option.label}</span>
                {option.description ? <span className="block truncate text-[11px] text-muted-foreground">{option.description}</span> : null}
              </span>
              {option.value === current ? <Check className="size-3.5 shrink-0" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
