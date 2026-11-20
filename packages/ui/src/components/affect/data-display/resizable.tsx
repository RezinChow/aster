import { GripHorizontal, GripVertical } from 'lucide-react'
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import type { HTMLAttributes, KeyboardEvent, ReactElement, ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { clamp } from '../shared'

type Direction = 'horizontal' | 'vertical'

interface PanelConfig {
  minSize: number
  maxSize: number
  collapsible: boolean
  collapsedSize: number
}

interface GroupContextValue {
  direction: Direction
  sizes: number[]
  groupRef: React.RefObject<HTMLDivElement | null>
  keyboardStep: number
  registerPanel: (config: PanelConfig) => number
  unregisterPanel: (index: number) => void
  registerHandle: () => number
  resize: (a: number, b: number, sizeA: number) => void
  toggleCollapse: (index: number) => void
  getConfig: (index: number) => PanelConfig
}

const GroupContext = createContext<GroupContextValue | null>(null)

const defaultConfig: PanelConfig = { minSize: 0, maxSize: 100, collapsible: false, collapsedSize: 0 }

export interface ResizablePanelGroupProps extends HTMLAttributes<HTMLDivElement> {
  direction?: Direction
  keyboardStep?: number
  onLayout?: (sizes: number[]) => void
}

export interface ResizablePanelProps extends HTMLAttributes<HTMLDivElement> {
  defaultSize?: number
  minSize?: number
  maxSize?: number
  collapsible?: boolean
  collapsedSize?: number
}

export interface ResizableHandleProps extends HTMLAttributes<HTMLDivElement> {
  withHandle?: boolean
}

/** Props for the `Resizable` convenience wrapper. */
export interface ResizableProps extends ResizablePanelGroupProps {}

/** Convenience entry point: pass `ResizablePanel` and `ResizableHandle` as children. */
export function Resizable(props: ResizableProps) {
  return <ResizablePanelGroup {...props} />
}

function isPanel(child: ReactNode): child is ReactElement<ResizablePanelProps> {
  return isValidElement(child) && child.type === ResizablePanel
}

/** A group of panes with draggable dividers. Give the parent a height. */
export function ResizablePanelGroup({
  direction = 'horizontal',
  keyboardStep = 5,
  onLayout,
  children,
  className,
  ...props
}: ResizablePanelGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null)
  const configs = useRef<(PanelConfig | undefined)[]>([])
  const handleCount = useRef(0)
  const registered = useRef(0)

  const defaults = Children.toArray(children).filter(isPanel).map((child) => child.props.defaultSize)
  const specified = defaults.reduce<number>((sum, value) => sum + (value ?? 0), 0)
  const missing = defaults.filter((value) => value === undefined).length
  const [sizes, setSizes] = useState<number[]>(() => {
    if (!defaults.length) return []
    const mapped = defaults.map((value) => value ?? (missing ? (100 - specified) / missing : 0))
    const sum = mapped.reduce((a, b) => a + b, 0)
    return sum > 0 ? mapped.map((value) => (value / sum) * 100) : mapped
  })

  const registerPanel = useCallback((config: PanelConfig) => {
    const index = registered.current
    registered.current += 1
    configs.current[index] = config
    return index
  }, [])

  const unregisterPanel = useCallback((index: number) => {
    configs.current[index] = undefined
  }, [])

  const registerHandle = useCallback(() => {
    const index = handleCount.current
    handleCount.current += 1
    return index
  }, [])

  const getConfig = useCallback(
    (index: number) => configs.current[index] ?? defaultConfig,
    []
  )

  const resize = useCallback((a: number, b: number, sizeA: number) => {
    setSizes((current) => {
      const next = [...current]
      if (next[a] === undefined || next[b] === undefined) return current
      const cfgA = configs.current[a] ?? defaultConfig
      const cfgB = configs.current[b] ?? defaultConfig
      const pair = next[a] + next[b]
      let value = clamp(sizeA, cfgA.minSize, cfgA.maxSize)
      value = clamp(value, pair - cfgB.maxSize, pair - cfgB.minSize)
      if (cfgA.collapsible && value < (cfgA.minSize + cfgA.collapsedSize) / 2) value = cfgA.collapsedSize
      if (cfgB.collapsible && pair - value < (cfgB.minSize + cfgB.collapsedSize) / 2) value = pair - cfgB.collapsedSize
      next[a] = value
      next[b] = pair - value
      onLayout?.(next)
      return next
    })
  }, [onLayout])

  const toggleCollapse = useCallback((index: number) => {
    setSizes((current) => {
      const cfg = configs.current[index] ?? defaultConfig
      if (!cfg.collapsible || current[index] === undefined) return current
      const next = [...current]
      const collapsed = current[index] <= cfg.collapsedSize + 0.5
      const other = index + 1 < next.length ? index + 1 : index - 1
      if (other < 0 || other >= next.length) return current
      const pair = next[index] + next[other]
      next[index] = collapsed ? Math.max(cfg.minSize, Math.min(cfg.maxSize, 25)) : cfg.collapsedSize
      next[other] = pair - next[index]
      onLayout?.(next)
      return next
    })
  }, [onLayout])

  const value: GroupContextValue = {
    direction, sizes, groupRef, keyboardStep, registerPanel, unregisterPanel, registerHandle, resize, toggleCollapse, getConfig
  }

  return (
    <GroupContext.Provider value={value}>
      <div
        data-slot="resizable-panel-group"
        ref={groupRef}
        role="group"
        aria-orientation={direction}
        className={cn('flex h-full w-full', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}
        {...props}
      >
        {children}
      </div>
    </GroupContext.Provider>
  )
}

/** One pane in a ResizablePanelGroup. */
export function ResizablePanel({
  defaultSize,
  minSize = 0,
  maxSize = 100,
  collapsible = false,
  collapsedSize = 0,
  children,
  className,
  style,
  ...props
}: ResizablePanelProps) {
  const context = useContext(GroupContext)
  const indexRef = useRef<number | null>(null)
  const unregisterRef = useRef(context?.unregisterPanel)
  if (context && indexRef.current === null) indexRef.current = context.registerPanel({ minSize, maxSize, collapsible, collapsedSize })
  unregisterRef.current = context?.unregisterPanel

  useEffect(() => () => {
    const index = indexRef.current
    if (index !== null) unregisterRef.current?.(index)
  }, [])

  const size = context && indexRef.current !== null ? context.sizes[indexRef.current] : undefined
  const basis = size ?? defaultSize

  return (
    <div
      data-slot="resizable-panel"
      className={cn('min-h-0 min-w-0 overflow-hidden', className)}
      style={{ flex: `0 0 ${basis ?? 0}%`, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

/** The draggable divider between two panels. */
export function ResizableHandle({ withHandle = false, className, onKeyDown, ...props }: ResizableHandleProps) {
  const context = useContext(GroupContext)
  const indexRef = useRef<number | null>(null)
  if (context && indexRef.current === null) indexRef.current = context.registerHandle()
  const index = indexRef.current ?? 0
  const vertical = context?.direction === 'vertical'

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const start = vertical ? event.clientY : event.clientX
    const startSizes = [...(context?.sizes ?? [])]
    const rect = context?.groupRef.current?.getBoundingClientRect()
    const totalPx = rect ? (vertical ? rect.height : rect.width) : 1
    const move = (ev: PointerEvent) => {
      const delta = ((vertical ? ev.clientY : ev.clientX) - start) / Math.max(1, totalPx) * 100
      context?.resize(index, index + 1, (startSizes[index] ?? 0) + delta)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event)
    if (!context) return
    const step = context.keyboardStep * (event.shiftKey ? 2 : 1)
    const current = context.sizes[index] ?? 0
    const cfg = context.getConfig(index)
    if (event.key === 'Enter') context.toggleCollapse(index)
    else if (event.key === 'Home') context.resize(index, index + 1, cfg.minSize)
    else if (event.key === 'End') context.resize(index, index + 1, cfg.maxSize)
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') context.resize(index, index + 1, current - step)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') context.resize(index, index + 1, current + step)
    else return
    event.preventDefault()
  }

  return (
    <div
      data-slot="resizable-handle"
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label="Resize"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex shrink-0 items-center justify-center bg-border outline-none transition-colors hover:bg-primary/60 focus-visible:bg-primary',
        vertical ? 'h-1 w-full cursor-row-resize' : 'h-full w-1 cursor-col-resize',
        className
      )}
      {...props}
    >
      {withHandle ? (
        <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow-sm">
          {vertical ? <GripHorizontal className="size-3" /> : <GripVertical className="size-3" />}
        </span>
      ) : null}
    </div>
  )
}
