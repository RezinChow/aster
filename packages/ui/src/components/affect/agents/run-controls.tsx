import { ChevronDown, CornerDownLeft, Play, RotateCcw, Send, Square, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectHeader, AffectMeter, AffectSurface, AffectToneBadge, formatDuration } from '../shared'

export type RunStatus = 'idle' | 'running' | 'stopped' | 'error' | 'done'
export type RunMode = 'chat' | 'act'
export type RunPermission = 'ask' | 'edits' | 'full'
export interface RunSteer { at: number; text: string }
export interface RunQueueItem { id: string; text: string }
export interface RunControlsProps {
  agent?: { id: string; name: string }
  prompt?: string
  answer?: string
  status?: RunStatus
  steers?: RunSteer[]
  queue?: RunQueueItem[]
  mode?: RunMode
  defaultMode?: RunMode
  onModeChange?: (mode: RunMode) => void
  permission?: RunPermission
  defaultPermission?: RunPermission
  onPermissionChange?: (permission: RunPermission) => void
  context?: number
  took?: number
  onSend?: (text: string) => void
  onSteer?: (text: string) => void
  onQueue?: (text: string) => void
  onUnqueue?: (id: string) => void
  onStop?: () => void
  onResume?: () => void
  onRetry?: () => void
  onDismiss?: () => void
  placeholder?: string
  className?: string
}

const permissionWord: Record<RunPermission, string> = { ask: 'Ask first', edits: 'Edits only', full: 'Full access' }

/** Stop, steer, resume or queue messages around a running agent answer. */
export function RunControls({
  agent = { id: 'agent', name: 'Agent' },
  prompt,
  answer = '',
  status = 'idle',
  steers = [],
  queue = [],
  mode,
  defaultMode = 'act',
  onModeChange,
  permission,
  defaultPermission = 'ask',
  onPermissionChange,
  context,
  took,
  onSend,
  onSteer,
  onQueue,
  onUnqueue,
  onStop,
  onResume,
  onRetry,
  onDismiss,
  placeholder = 'Ask anything…',
  className
}: RunControlsProps) {
  const [text, setText] = useState('')
  const [modeState, setModeState] = useState<RunMode>(defaultMode)
  const [permissionState, setPermissionState] = useState<RunPermission>(defaultPermission)
  const [permOpen, setPermOpen] = useState(false)
  const [announce, setAnnounce] = useState('')
  const currentMode = mode ?? modeState
  const currentPermission = permission ?? permissionState
  const running = status === 'running'

  const chooseMode = (next: RunMode) => { setModeState(next); onModeChange?.(next) }
  const choosePermission = (next: RunPermission) => { setPermissionState(next); onPermissionChange?.(next); setPermOpen(false); setAnnounce(`Permissions: ${permissionWord[next]}`) }
  const submit = (queueIt: boolean) => {
    const value = text.trim()
    if (!value) return
    if (queueIt) onQueue?.(value)
    else if (running) onSteer?.(value)
    else onSend?.(value)
    setText('')
    setAnnounce(queueIt ? 'Queued for after the run' : running ? 'Steered the agent' : 'Sent')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); if (permOpen) setPermOpen(false); else if (running) onStop?.() }
  }
  const onTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit(event.altKey && running)
    }
  }

  return (
    <div data-slot="run-controls" onKeyDown={onKeyDown} className={cn('w-full', className)}>
      <AffectSurface className="overflow-hidden">
        <div className="bg-muted px-3 py-1.5">
          <AffectHeader
            title={agent.name}
            actions={
              <div className="flex items-center gap-1.5">
                {took !== undefined ? <span className="text-[10px] tabular-nums text-muted-foreground">Done in {formatDuration(took * 1000)}</span> : null}
                <AffectToneBadge tone={running ? 'info' : status === 'error' ? 'danger' : status === 'done' ? 'success' : 'neutral'}>{running ? 'Writing' : status === 'stopped' ? 'Stopped' : status === 'error' ? 'Error' : status === 'done' ? 'Done' : 'Idle'}</AffectToneBadge>
              </div>
            }
          />
        </div>
        <div className="p-3">
          <div role="log" aria-label={`${agent.name} answer`} tabIndex={0} className="max-h-48 min-h-16 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-2.5 outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {prompt ? <p className="text-xs font-medium text-foreground">{prompt}</p> : <p className="text-xs text-muted-foreground">Start a run by sending a message.</p>}
            {answer ? <p className="whitespace-pre-wrap text-xs text-foreground">{answer}{running ? <span aria-hidden="true" className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-foreground" /> : null}</p> : null}
            {steers.map((steer, index) => <p key={index} className="rounded bg-info-subtle px-2 py-1 text-[11px] text-info">Steer at {steer.at}: {steer.text}</p>)}
          </div>

          {queue.length ? (
            <ul role="list" aria-label="Queued messages" className="mt-2 space-y-1">
              {queue.slice(0, 4).map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="min-w-0 flex-1 truncate">{item.text}</span>
                  <button type="button" aria-label={`Remove queued message ${item.text}`} onClick={() => onUnqueue?.(item.id)} className="text-muted-foreground hover:text-destructive"><X aria-hidden="true" className="size-3" /></button>
                </li>
              ))}
              {queue.length > 4 ? <li className="text-[10px] text-muted-foreground">+{queue.length - 4} more queued</li> : null}
            </ul>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Mode" className="flex rounded-md border border-border p-0.5">
              {(['chat', 'act'] as const).map((option) => <button key={option} type="button" role="radio" aria-checked={currentMode === option} onClick={() => chooseMode(option)} className={cn('rounded px-2 py-0.5 text-[11px]', currentMode === option ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>{option === 'chat' ? 'Chat' : 'Act'}</button>)}
            </div>
            {currentMode === 'act' ? (
              <div className="relative">
                <button type="button" aria-haspopup="menu" aria-expanded={permOpen} onClick={() => setPermOpen((open) => !open)} className={cn('inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px]', currentPermission === 'full' ? 'text-destructive' : 'text-muted-foreground')}>Permissions: {permissionWord[currentPermission]}<ChevronDown aria-hidden="true" className="size-3" /></button>
                {permOpen ? (
                  <div role="menu" aria-label="Permissions" className="absolute bottom-full left-0 z-10 mb-1 w-40 rounded-md border border-border bg-card p-1 shadow-md">
                    {(['ask', 'edits', 'full'] as const).map((option) => <button key={option} type="button" role="menuitemradio" aria-checked={currentPermission === option} onClick={() => choosePermission(option)} className={cn('flex w-full items-center justify-between rounded px-2 py-1 text-left text-[11px] hover:bg-accent', option === 'full' ? 'text-destructive' : 'text-foreground')}>{permissionWord[option]}{currentPermission === option ? '✓' : ''}</button>)}
                  </div>
                ) : null}
              </div>
            ) : null}
            {context !== undefined ? <div className="ml-auto flex w-24 items-center gap-1.5"><AffectMeter value={Math.round(context * 100)} tone={context >= 0.8 ? 'warning' : 'primary'} label="Context used" /><span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{Math.round(context * 100)}%</span></div> : null}
          </div>

          <div className="mt-2 flex items-end gap-2">
            <textarea
              aria-label={running ? 'Steer the agent or queue a message' : 'Message the agent'}
              aria-describedby="run-controls-keys"
              rows={2}
              value={text}
              placeholder={placeholder}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onTextKeyDown}
              className="min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring"
            />
            <button type="button" aria-label={running ? 'Steer now' : 'Send message'} disabled={!text.trim()} onClick={() => submit(false)} className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40">{running ? <CornerDownLeft aria-hidden="true" className="size-4" /> : <Send aria-hidden="true" className="size-4" />}</button>
          </div>
          <p id="run-controls-keys" className="mt-1 text-[10px] text-muted-foreground">{running ? 'Enter to steer · ⌥Enter to queue · Esc to stop' : 'Enter to send · Shift+Enter for a new line'}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {running ? <button type="button" onClick={onStop} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><Square aria-hidden="true" className="size-3" />Stop <span className="opacity-50">Esc</span></button> : null}
            {status === 'stopped' || status === 'error' ? (
              <>
                <button type="button" onClick={onResume} className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground"><Play aria-hidden="true" className="size-3" />Resume</button>
                <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><RotateCcw aria-hidden="true" className="size-3" />Retry</button>
                <button type="button" onClick={onDismiss} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">Dismiss</button>
              </>
            ) : null}
            {status === 'done' ? <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"><RotateCcw aria-hidden="true" className="size-3" />Retry</button> : null}
          </div>
        </div>
      </AffectSurface>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  )
}
