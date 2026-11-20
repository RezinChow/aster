import { CheckCircle2, CircleAlert, Info, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export type ToastTone = 'default' | 'success' | 'error' | 'info' | 'loading'
export type ToastId = string
export type ToastPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  id?: string
  description?: ReactNode
  action?: ToastAction
  duration?: number
  icon?: ReactNode
  toaster?: string
  onDismiss?: () => void
}

interface ToastRecord {
  id: string
  title: ReactNode
  tone: ToastTone
  description?: ReactNode
  action?: ToastAction
  duration?: number
  icon?: ReactNode
  toaster?: string
  onDismiss?: () => void
}

let records: ToastRecord[] = []
const listeners = new Set<() => void>()
let sequence = 0

const getSnapshot = () => records
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const emit = () => { for (const listener of listeners) listener() }

function push(tone: ToastTone, title: ReactNode, options: ToastOptions = {}): ToastId {
  const id = options.id ?? `toast-${(sequence += 1)}`
  const record: ToastRecord = {
    id, title, tone,
    description: options.description,
    action: options.action,
    duration: options.duration,
    icon: options.icon,
    toaster: options.toaster,
    onDismiss: options.onDismiss
  }
  records = [record, ...records.filter((item) => item.id !== id)]
  emit()
  return id
}

function update(id: string, tone: ToastTone, title: ReactNode, description?: ReactNode) {
  records = records.map((item) => item.id === id ? { ...item, tone, title, description, duration: 4000 } : item)
  emit()
}

function dismiss(id?: ToastId) {
  const targets = id ? records.filter((item) => item.id === id) : records
  records = id ? records.filter((item) => item.id !== id) : []
  emit()
  for (const item of targets) item.onDismiss?.()
}

interface ToastFn {
  (title: ReactNode, options?: ToastOptions): ToastId
  success: (title: ReactNode, options?: ToastOptions) => ToastId
  error: (title: ReactNode, options?: ToastOptions) => ToastId
  info: (title: ReactNode, options?: ToastOptions) => ToastId
  loading: (title: ReactNode, options?: ToastOptions) => ToastId
  promise: <T>(
    task: Promise<T> | (() => Promise<T>),
    messages: { loading: string; success: string | ((result: T) => string); error: string | ((error: unknown) => string) },
    options?: ToastOptions
  ) => Promise<T>
  dismiss: (id?: ToastId) => void
}

/** Show a toast from anywhere – no hook or context needed. */
export const toast = ((title: ReactNode, options?: ToastOptions) => push('default', title, options)) as ToastFn
toast.success = (title, options) => push('success', title, options)
toast.error = (title, options) => push('error', title, options)
toast.info = (title, options) => push('info', title, options)
toast.loading = (title, options) => push('loading', title, options)
toast.dismiss = dismiss
toast.promise = <T,>(
  task: Promise<T> | (() => Promise<T>),
  messages: { loading: string; success: string | ((result: T) => string); error: string | ((error: unknown) => string) },
  options?: ToastOptions
): Promise<T> => {
  const id = push('loading', messages.loading, { ...options, duration: Number.POSITIVE_INFINITY })
  const promise = typeof task === 'function' ? task() : task
  return promise.then((result) => {
    update(id, 'success', typeof messages.success === 'function' ? messages.success(result) : messages.success)
    return result
  }).catch((error: unknown) => {
    update(id, 'error', typeof messages.error === 'function' ? messages.error(error) : messages.error)
    throw error
  })
}

export interface ToasterProps {
  position?: ToastPosition
  inline?: boolean
  id?: string
  duration?: number
  visibleToasts?: number
  expand?: boolean
  offset?: number
  gap?: number
  closeButton?: boolean
  label?: string
  className?: string
}

const toneIcon: Record<ToastTone, ReactNode> = {
  default: null,
  success: <CheckCircle2 aria-hidden="true" className="size-4 text-success" />,
  error: <CircleAlert aria-hidden="true" className="size-4 text-destructive" />,
  info: <Info aria-hidden="true" className="size-4 text-info" />,
  loading: <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-info" />
}

function ToastCard({ item, duration, closeButton, onDismiss }: {
  item: ToastRecord
  duration: number
  closeButton: boolean
  onDismiss: () => void
}) {
  const [width, setWidth] = useState(100)
  const ms = item.duration ?? duration
  useEffect(() => {
    if (!Number.isFinite(ms)) return
    const frame = requestAnimationFrame(() => setWidth(0))
    return () => cancelAnimationFrame(frame)
  }, [ms])

  return (
    <div
      role="status"
      className="relative w-80 max-w-full overflow-hidden rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground shadow-lg"
    >
      <div className="flex items-start gap-2">
        {item.icon ?? toneIcon[item.tone] ? <span className="mt-0.5 shrink-0">{item.icon ?? toneIcon[item.tone]}</span> : null}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground">{item.title}</div>
          {item.description ? <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.description}</div> : null}
          {item.action ? (
            <button type="button" onClick={item.action.onClick} className="mt-1.5 text-[11px] font-medium text-info hover:underline">
              {item.action.label}
            </button>
          ) : null}
        </div>
        {closeButton ? (
          <button type="button" aria-label="Dismiss notification" onClick={onDismiss} className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
      {Number.isFinite(ms) ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-px bg-primary"
          style={{ width: `${width}%`, transition: `width ${ms}ms linear` }}
        />
      ) : null}
    </div>
  )
}

/** The region that renders toasts created with `toast()`. */
export function Toaster({
  position = 'bottom-right',
  inline = false,
  id,
  duration = 4000,
  visibleToasts = 3,
  expand = false,
  offset,
  gap = 10,
  closeButton = true,
  label = 'Notifications',
  className
}: ToasterProps) {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const list = all.filter((item) => item.toaster === id).slice(0, visibleToasts)
  const [hovered, setHovered] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    for (const item of list) {
      if (timers.current[item.id] || !Number.isFinite(item.duration ?? duration)) continue
      timers.current[item.id] = setTimeout(() => dismiss(item.id), item.duration ?? duration)
    }
    for (const key of Object.keys(timers.current)) {
      if (!all.some((item) => item.id === key)) {
        clearTimeout(timers.current[key])
        delete timers.current[key]
      }
    }
  }, [list, all, duration])

  useEffect(() => () => {
    for (const timer of Object.values(timers.current)) clearTimeout(timer)
  }, [])

  const vertical = position.startsWith('top') ? 'top' : 'bottom'
  const horizontal = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center'
  const distance = offset ?? (inline ? 20 : 24)
  const anchor: CSSProperties = { [vertical]: distance } as CSSProperties
  if (horizontal === 'center') {
    anchor.left = '50%'
    anchor.transform = 'translateX(-50%)'
  } else {
    anchor[horizontal] = distance
  }
  const fanned = expand || hovered

  return (
    <div
      data-slot="toaster"
      role="region"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
      onKeyDown={(event) => { if (event.key === 'Escape' && list[0]) dismiss(list[0].id) }}
      className={cn(
        'z-50 flex w-80 max-w-[calc(100vw-24px)] flex-col',
        inline ? 'absolute' : 'fixed',
        vertical === 'bottom' && 'flex-col-reverse',
        className
      )}
      style={anchor}
    >
      {list.length === 0 ? null : list.map((item, index) => (
        <div
          key={item.id}
          style={{
            marginTop: fanned ? (index === 0 ? 0 : gap) : (index === 0 ? 0 : -12),
            zIndex: list.length - index,
            opacity: fanned ? 1 : 1 - index * 0.18,
            transform: fanned ? undefined : `scale(${1 - index * 0.04})`
          }}
        >
          <ToastCard item={item} duration={duration} closeButton={closeButton} onDismiss={() => dismiss(item.id)} />
        </div>
      ))}
    </div>
  )
}
