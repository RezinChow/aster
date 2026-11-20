import { Check, ChevronDown, Globe, Sparkles } from 'lucide-react'
import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter, AffectSurface, affectToneClass } from '../shared'

export type ModelEffort = 'low' | 'medium' | 'high'

export interface PickerModel {
  id: string
  name: string
  description?: string
  icon?: ReactNode
  speed?: number
  quality?: number
  cost?: number
  latencyMs?: number
  pricePerM?: number
}

export interface ModelPickerProps {
  models: PickerModel[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
  thinking?: boolean
  defaultThinking?: boolean
  onThinkingChange?: (on: boolean) => void
  webSearch?: boolean
  defaultWebSearch?: boolean
  onWebSearchChange?: (on: boolean) => void
  effort?: ModelEffort
  defaultEffort?: ModelEffort
  onEffortChange?: (effort: ModelEffort) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  className?: string
}

const efforts: ModelEffort[] = ['low', 'medium', 'high']

/** Composer model menu with strength meters, thinking/search switches and an effort radio. */
export function ModelPicker({
  models,
  value,
  defaultValue,
  onChange,
  thinking,
  defaultThinking = false,
  onThinkingChange,
  webSearch,
  defaultWebSearch = false,
  onWebSearchChange,
  effort,
  defaultEffort = 'medium',
  onEffortChange,
  open,
  defaultOpen = false,
  onOpenChange,
  align = 'start',
  side = 'bottom',
  className
}: ModelPickerProps) {
  const listId = useId()
  const [innerId, setInnerId] = useState(defaultValue ?? models[0]?.id ?? '')
  const [innerOpen, setInnerOpen] = useState(defaultOpen)
  const [innerThinking, setInnerThinking] = useState(defaultThinking)
  const [innerSearch, setInnerSearch] = useState(defaultWebSearch)
  const [innerEffort, setInnerEffort] = useState<ModelEffort>(defaultEffort)
  const [active, setActive] = useState(0)
  const selectedId = value ?? innerId
  const isOpen = open ?? innerOpen
  const isThinking = thinking ?? innerThinking
  const isSearch = webSearch ?? innerSearch
  const currentEffort = effort ?? innerEffort
  const selected = models.find((model) => model.id === selectedId) ?? models[0]

  const setOpen = (next: boolean) => {
    if (open === undefined) setInnerOpen(next)
    onOpenChange?.(next)
  }
  const choose = (model: PickerModel) => {
    if (value === undefined) setInnerId(model.id)
    onChange?.(model.id)
    setOpen(false)
  }
  const setMenuOpen = (next: boolean) => {
    setOpen(next)
    if (next) setActive(Math.max(0, models.findIndex((model) => model.id === selectedId)))
  }
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + models.length) % models.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActive(event.key === 'Home' ? 0 : models.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const model = models[active]
      if (model) choose(model)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  const strength = (model: PickerModel, key: 'speed' | 'quality' | 'cost', label: string) =>
    model[key] !== undefined ? (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {label}
        <AffectMeter value={model[key] ?? 0} max={5} tone={key === 'cost' ? 'warning' : 'primary'} className="w-10" />
      </span>
    ) : null

  return (
    <div data-slot="model-picker" className={cn('relative inline-block', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={`Model: ${selected?.name ?? 'None'}${isThinking ? ', thinking on' : ''}`}
        onClick={() => setMenuOpen(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault()
            setMenuOpen(true)
          }
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {selected?.icon ? <span aria-hidden="true" className="inline-flex">{selected.icon}</span> : <Sparkles aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        <span className="max-w-32 truncate">{selected?.name ?? 'Model'}</span>
        {isThinking ? <Sparkles aria-hidden="true" className="size-3 text-muted-foreground" /> : null}
        <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
      </button>
      {isOpen ? (
        <AffectSurface
          className={cn(
            'absolute z-30 w-72 p-1.5',
            align === 'end' ? 'right-0' : 'left-0',
            side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          <div role="listbox" id={listId} aria-label="Model" aria-activedescendant={`${listId}-${active}`} tabIndex={0} onKeyDown={onListKeyDown} className="space-y-0.5 rounded-md outline-none">
            {models.map((model, index) => (
              <button
                key={model.id}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={model.id === selectedId}
                onClick={() => choose(model)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'w-full rounded-md px-2 py-1.5 text-left transition-colors',
                  active === index ? 'bg-accent' : 'hover:bg-muted/60'
                )}
              >
                <span className="flex items-center gap-1.5">
                  {model.icon ? <span aria-hidden="true" className="inline-flex">{model.icon}</span> : null}
                  <span className="flex-1 truncate text-xs font-medium text-foreground">{model.name}</span>
                  {model.id === selectedId ? <Check aria-hidden="true" className="size-3.5 text-foreground" /> : null}
                </span>
                {model.description ? <span className="block truncate text-[11px] text-muted-foreground">{model.description}</span> : null}
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  {model.speed === undefined && model.quality === undefined && model.cost === undefined ? (
                    <span className="text-[10px] text-muted-foreground">Varies</span>
                  ) : (
                    <>
                      {strength(model, 'speed', 'Speed')}
                      {strength(model, 'quality', 'Quality')}
                      {strength(model, 'cost', 'Cost')}
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1.5 space-y-1.5 border-t border-border px-1.5 pt-2">
            <button
              type="button"
              role="switch"
              aria-checked={isThinking}
              onClick={() => {
                if (thinking === undefined) setInnerThinking((v) => !v)
                onThinkingChange?.(!isThinking)
              }}
              className="flex w-full items-center justify-between text-xs text-foreground"
            >
              <span className="inline-flex items-center gap-1.5"><Sparkles aria-hidden="true" className="size-3.5" />Extended thinking</span>
              <span className={cn('h-4 w-7 rounded-full p-0.5 transition-colors', isThinking ? affectToneClass.primary.split(' ')[0] : 'bg-muted')}>
                <span className={cn('block size-3 rounded-full bg-background transition-transform', isThinking && 'translate-x-3')} />
              </span>
            </button>
            {isThinking ? (
              <div role="radiogroup" aria-label="Thinking effort" className="flex items-center gap-1 pl-5">
                {efforts.map((value2) => (
                  <button
                    key={value2}
                    type="button"
                    role="radio"
                    aria-checked={currentEffort === value2}
                    onClick={() => {
                      if (effort === undefined) setInnerEffort(value2)
                      onEffortChange?.(value2)
                    }}
                    className={cn('rounded border px-1.5 py-0.5 text-[10px] capitalize', currentEffort === value2 ? 'border-primary bg-accent text-foreground' : 'border-border text-muted-foreground')}
                  >
                    {value2}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              role="switch"
              aria-checked={isSearch}
              onClick={() => {
                if (webSearch === undefined) setInnerSearch((v) => !v)
                onWebSearchChange?.(!isSearch)
              }}
              className="flex w-full items-center justify-between text-xs text-foreground"
            >
              <span className="inline-flex items-center gap-1.5"><Globe aria-hidden="true" className="size-3.5" />Web search</span>
              <span className={cn('h-4 w-7 rounded-full p-0.5 transition-colors', isSearch ? affectToneClass.primary.split(' ')[0] : 'bg-muted')}>
                <span className={cn('block size-3 rounded-full bg-background transition-transform', isSearch && 'translate-x-3')} />
              </span>
            </button>
          </div>
          {selected?.latencyMs !== undefined || selected?.pricePerM !== undefined ? (
            <div className="mt-1.5 flex items-center justify-between border-t border-border px-1.5 pt-2 text-[10px] text-muted-foreground">
              <span>{selected?.latencyMs !== undefined ? `${(selected.latencyMs / 1000).toFixed(1)}s first token` : '—'}</span>
              <span>{selected?.pricePerM !== undefined ? `$${selected.pricePerM}/M tokens` : '—'}</span>
            </div>
          ) : null}
        </AffectSurface>
      ) : null}
    </div>
  )
}
