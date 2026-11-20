import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export type KbdPlatform = 'mac' | 'other'

export interface KbdProps extends ComponentProps<'kbd'> {
  keys?: string | string[]
  children?: ReactNode
  size?: 'sm' | 'md'
  platform?: KbdPlatform
}

const named: Record<string, { mac: string; other: string; spoken: string }> = {
  cmd: { mac: '⌘', other: 'Cmd', spoken: 'Command' },
  ctrl: { mac: '⌃', other: 'Ctrl', spoken: 'Control' },
  alt: { mac: '⌥', other: 'Alt', spoken: 'Alt' },
  shift: { mac: '⇧', other: 'Shift', spoken: 'Shift' },
  enter: { mac: '↵', other: 'Enter', spoken: 'Enter' },
  esc: { mac: '⎋', other: 'Esc', spoken: 'Escape' },
  tab: { mac: '⇥', other: 'Tab', spoken: 'Tab' },
  space: { mac: '␣', other: 'Space', spoken: 'Space' },
  backspace: { mac: '⌫', other: 'Backspace', spoken: 'Backspace' },
  delete: { mac: '⌦', other: 'Delete', spoken: 'Delete' },
  up: { mac: '↑', other: 'Up', spoken: 'Up arrow' },
  down: { mac: '↓', other: 'Down', spoken: 'Down arrow' },
  left: { mac: '←', other: 'Left', spoken: 'Left arrow' },
  right: { mac: '→', other: 'Right', spoken: 'Right arrow' },
  pageup: { mac: '⇞', other: 'Page Up', spoken: 'Page Up' },
  pagedown: { mac: '⇟', other: 'Page Down', spoken: 'Page Down' },
  home: { mac: '↖', other: 'Home', spoken: 'Home' },
  end: { mac: '↘', other: 'End', spoken: 'End' }
}

/** A shortcut chip: one key or a combo, drawn as a single non-wrapping <kbd>. */
export function Kbd({ keys, children, size = 'sm', platform, className, ...props }: KbdProps) {
  const [detected, setDetected] = useState<KbdPlatform>('other')
  useEffect(() => {
    if (platform) return
    const value = navigator.platform ?? ''
    setDetected(/mac|iphone|ipad|ipod/i.test(value) ? 'mac' : 'other')
  }, [platform])
  const active = platform ?? detected

  const list = keys === undefined ? (children === undefined ? [] : [String(children)]) : Array.isArray(keys) ? keys : [keys]
  if (!list.length) return null

  const parts = list.map((key) => {
    if (key.toLowerCase() === 'mod') {
      return active === 'mac' ? { glyph: '⌘', say: 'Command' } : { glyph: 'Ctrl', say: 'Control' }
    }
    const entry = named[key.toLowerCase()]
    if (entry) return { glyph: active === 'mac' ? entry.mac : entry.other, say: entry.spoken }
    return { glyph: key.length === 1 ? key.toUpperCase() : key, say: key }
  })

  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded border border-border bg-muted font-sans font-medium leading-none text-foreground',
        size === 'sm' ? 'h-[18px] px-1 text-[11px]' : 'h-[22px] px-1.5 text-xs',
        className
      )}
      {...props}
    >
      <span className="sr-only">{parts.map((part) => part.say).join(' ')}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums">
        {parts.map((part, index) => (
          <span key={index}>{part.glyph}</span>
        ))}
      </span>
    </kbd>
  )
}
