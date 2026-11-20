import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export type ColorPreset = string | { value: string; label: string }

export interface ColorPickerProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  alpha?: boolean
  presets?: ColorPreset[]
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  label?: string
  showValue?: boolean
  size?: 'sm' | 'md'
  name?: string
  className?: string
}

function normalize(input: string): string {
  const text = input.trim().toLowerCase()
  if (text.startsWith('#')) {
    let hex = text.slice(1).replace(/[^0-9a-f]/g, '')
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    return `#${hex.slice(0, 6)}`
  }
  const match = text.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (match) return `#${match.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
  return '#0190fe'
}

const presetParts = (preset: ColorPreset): { value: string; label: string } => typeof preset === 'string' ? { value: normalize(preset), label: preset } : { value: normalize(preset.value), label: preset.label }

/** Swatch button that opens a color card with a native picker, hex field, opacity and presets. */
export function ColorPicker({
  value,
  defaultValue = '#0190fe',
  onValueChange,
  alpha = false,
  presets = [],
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  label = 'Color',
  showValue = true,
  size = 'md',
  name,
  className
}: ColorPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(normalize(defaultValue))
  const [hexInput, setHexInput] = useState(normalize(defaultValue))
  const [opacity, setOpacity] = useState(1)
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const current = normalize(isControlled ? value : internal)
  const rgb = current.slice(1, 7)
  const displayValue = alpha && opacity < 1 ? `#${rgb}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` : current

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const setColor = (next: string) => {
    const clean = normalize(next)
    if (!isControlled) setInternal(clean)
    setHexInput(clean)
    onValueChange?.(alpha && opacity < 1 ? `#${clean.slice(1)}${Math.round(opacity * 255).toString(16).padStart(2, '0')}` : clean)
  }

  useEffect(() => { setHexInput(current) }, [current])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={rootRef} data-slot="color-picker" className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-label={`${label}: ${current.toUpperCase()}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn('inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted', size === 'sm' ? 'h-7' : 'h-8')}
      >
        <span className="size-4 rounded border border-border" style={{ backgroundColor: displayValue }} />
        {showValue ? <span className="font-mono uppercase">{displayValue}</span> : null}
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>
      {name ? <input type="hidden" name={name} value={displayValue} /> : null}
      {open ? (
        <div role="dialog" aria-label={label} className="absolute top-full left-0 z-50 mt-1 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
          <input type="color" aria-label={`${label} color area`} value={current} onChange={(e) => setColor(e.target.value)} className="h-24 w-full cursor-pointer rounded-md border border-border bg-background" />
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Hex</span>
            <input
              value={hexInput}
              aria-label="Hex value"
              aria-invalid={normalize(hexInput) === '#0190fe' && hexInput !== '#0190fe' || undefined}
              onChange={(e) => { setHexInput(e.target.value); const n = normalize(e.target.value); if (e.target.value.trim().startsWith('#') && /^#[\da-f]{6}$/i.test(e.target.value.trim())) setColor(n) }}
              onBlur={() => setHexInput(current)}
              onKeyDown={(e) => { if (e.key === 'Enter' && /^#[\da-f]{6}$/i.test(hexInput.trim())) setColor(hexInput) }}
              className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs uppercase text-foreground outline-none focus:border-ring"
            />
          </div>
          {alpha ? (
            <label className="mt-3 block text-[11px] text-muted-foreground">
              Opacity {Math.round(opacity * 100)}%
              <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Opacity" className="mt-1 w-full accent-primary" />
            </label>
          ) : null}
          {presets.length ? (
            <div role="radiogroup" aria-label="Presets" className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => {
                const item = presetParts(preset)
                return (
                  <button key={item.label} type="button" role="radio" aria-checked={current === item.value} aria-label={item.label} title={item.label} onClick={() => setColor(item.value)} style={{ backgroundColor: item.value }} className={cn('size-6 rounded-full border border-border', current === item.value && 'ring-2 ring-ring ring-offset-1')} />
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <span className="sr-only">{label as ReactNode}</span>
    </div>
  )
}
