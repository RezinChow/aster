import { Folder, Globe, Mic, Paperclip, Plus, Send, ShieldCheck, Square } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface ChatModel {
  id: string
  name: string
  description?: string
}

export interface ChatApp {
  id: string
  name: string
  logo?: ReactNode
}

export interface ChatComposerProps {
  placeholder?: string
  models?: ChatModel[]
  loadMs?: number
  dictation?: string
  onSend?: (message: string, details: { model: string }) => void
  onModelChange?: (model: ChatModel) => void
  onAttach?: () => void
  onRequestApproval?: () => void
  folders?: string[]
  folder?: string
  onFolderChange?: (folder: string | null) => void
  apps?: ChatApp[]
  connectedApps?: string[]
  onAppsChange?: (connected: string[]) => void
}

const defaultModels: ChatModel[] = [
  { id: 'auto', name: 'Auto', description: 'Picks the best model' },
  { id: 'claude', name: 'Claude', description: 'Long context' },
  { id: 'chatgpt', name: 'ChatGPT', description: 'Fast and general' }
]
const defaultFolders = ['Product', 'Research']
const defaultApps: ChatApp[] = [
  { id: 'gmail', name: 'Gmail' },
  { id: 'slack', name: 'Slack' },
  { id: 'clickup', name: 'ClickUp' }
]

type Menu = 'model' | 'folder' | 'apps' | null

/** Prompt composer with a model picker, folder and app menus, approval and dictation. */
export function ChatComposer({
  placeholder = 'Start by typing...',
  models = defaultModels,
  loadMs = 1300,
  dictation = 'Draft a short update…',
  onSend,
  onModelChange,
  onAttach,
  onRequestApproval,
  folders = defaultFolders,
  folder,
  onFolderChange,
  apps = defaultApps,
  connectedApps = ['gmail'],
  onAppsChange
}: ChatComposerProps) {
  const [message, setMessage] = useState('')
  const [modelId, setModelId] = useState(models[0]?.id ?? 'auto')
  const [innerFolder, setInnerFolder] = useState<string | undefined>(folder)
  const [connected, setConnected] = useState(connectedApps)
  const [menu, setMenu] = useState<Menu>(null)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [spoken, setSpoken] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const activeFolder = folder ?? innerFolder
  const model = models.find((item) => item.id === modelId) ?? models[0]

  useEffect(() => {
    if (!recording) return
    const words = dictation.split(/\s+/)
    let index = 0
    const id = window.setInterval(() => {
      index += 1
      setSpoken(words.slice(0, index).join(' '))
      if (index >= words.length) window.clearInterval(id)
    }, 220)
    return () => window.clearInterval(id)
  }, [recording, dictation])

  const send = () => {
    const text = message.trim()
    if (!text) return
    onSend?.(text, { model: modelId })
    setMessage('')
  }
  const pickModel = (next: ChatModel) => {
    setModelId(next.id)
    onModelChange?.(next)
    setMenu(null)
  }
  const pickFolder = (next: string) => {
    const value = activeFolder === next ? null : next
    if (folder === undefined) setInnerFolder(value ?? undefined)
    onFolderChange?.(value)
    setMenu(null)
  }
  const toggleApp = (id: string) => {
    const next = connected.includes(id) ? connected.filter((item) => item !== id) : [...connected, id]
    setConnected(next)
    onAppsChange?.(next)
  }
  const requestApproval = () => {
    if (approvalLoading) return
    setApprovalLoading(true)
    onRequestApproval?.()
    window.setTimeout(() => setApprovalLoading(false), loadMs)
  }
  const toggleRecording = () => {
    if (recording && spoken) setMessage((current) => `${current}${current ? ' ' : ''}${spoken}`.trimStart())
    if (recording) setSpoken('')
    setRecording((value) => !value)
  }
  const onListKey = (event: KeyboardEvent<HTMLDivElement>, length: number, pick: (index: number) => void) => {
    if (event.key === 'Escape') {
      setMenu(null)
      return
    }
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-menu-item]'))
    const current = buttons.findIndex((button) => button === document.activeElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + length) % length
      buttons[next]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      buttons[event.key === 'Home' ? 0 : length - 1]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pick(Math.max(0, current))
    }
  }

  return (
    <div
      data-slot="chat-composer"
      onClick={(event) => {
        if (recording || (event.target as HTMLElement).closest('button')) return
        inputRef.current?.focus()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (recording) {
            setRecording(false)
            setSpoken('')
          } else if (menu) setMenu(null)
        }
      }}
      className="w-full max-w-[680px] rounded-xl border border-border bg-card p-2 shadow-sm"
    >
      <div className="relative flex items-start gap-1">
        <button
          type="button"
          aria-label="Attach file"
          onClick={onAttach}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
        <textarea
          ref={inputRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          rows={2}
          aria-label="Message"
          placeholder={placeholder}
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {recording ? (
          <span aria-live="polite" className="max-w-40 self-center truncate text-[11px] text-muted-foreground">{spoken}</span>
        ) : null}
        <button
          type="button"
          aria-label={recording ? 'Stop dictation' : 'Start dictation'}
          aria-pressed={recording}
          onClick={toggleRecording}
          className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground', recording && 'bg-destructive/10 text-destructive')}
        >
          {recording ? <Square aria-hidden="true" className="size-3.5" /> : <Mic aria-hidden="true" className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Send message"
          disabled={!message.trim()}
          onClick={send}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Send aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-border pt-1.5">
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menu === 'model'}
            onClick={() => setMenu(menu === 'model' ? null : 'model')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                setMenu('model')
              }
            }}
            className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {model?.name ?? 'Model'}
          </button>
          {menu === 'model' ? (
            <div role="listbox" aria-label="Model" onKeyDown={(event) => onListKey(event, models.length, (index) => pickModel(models[index] ?? model))} className="absolute bottom-full z-20 mb-1 w-48 rounded-md border border-border bg-card p-1 shadow-lg">
              {models.map((item) => (
                <button key={item.id} type="button" data-menu-item role="option" aria-selected={item.id === modelId} onClick={() => pickModel(item)} className={cn('block w-full rounded px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted', item.id === modelId && 'bg-accent')}>
                  <span className="font-medium">{item.name}</span>
                  {item.description ? <span className="block text-[10px] text-muted-foreground">{item.description}</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-busy={approvalLoading}
          disabled={approvalLoading}
          onClick={requestApproval}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <ShieldCheck aria-hidden="true" className="size-3.5" />{approvalLoading ? 'Requesting…' : 'Request approval'}
        </button>
        <div className="flex-1" />
        {folders.length ? (
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={menu === 'folder'}
              title={activeFolder}
              onClick={() => setMenu(menu === 'folder' ? null : 'folder')}
              className="inline-flex max-w-32 items-center gap-1 truncate rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Folder aria-hidden="true" className="size-3.5 shrink-0" /><span className="truncate">{activeFolder ?? 'Work in a folder'}</span>
            </button>
            {menu === 'folder' ? (
              <div role="listbox" aria-label="Folder" onKeyDown={(event) => onListKey(event, folders.length, (index) => pickFolder(folders[index] ?? ''))} className="absolute bottom-full z-20 mb-1 w-40 rounded-md border border-border bg-card p-1 shadow-lg">
                {folders.map((item) => (
                  <button key={item} type="button" data-menu-item role="option" aria-selected={item === activeFolder} onClick={() => pickFolder(item)} className={cn('block w-full truncate rounded px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted', item === activeFolder && 'bg-accent')}>{item}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu === 'apps'}
            onClick={() => setMenu(menu === 'apps' ? null : 'apps')}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Globe aria-hidden="true" className="size-3.5" />Connect apps
            {apps.slice(0, 3).map((app) => <span key={app.id} aria-hidden="true" title={app.name} className="inline-flex size-4 items-center justify-center rounded bg-muted text-[8px]">{app.logo ?? app.name.slice(0, 1)}</span>)}
          </button>
          {menu === 'apps' ? (
            <div role="menu" aria-label="Connect apps" onKeyDown={(event) => onListKey(event, apps.length, (index) => toggleApp(apps[index]?.id ?? ''))} className="absolute bottom-full right-0 z-20 mb-1 w-44 rounded-md border border-border bg-card p-1 shadow-lg">
              {apps.map((app) => (
                <button key={app.id} type="button" data-menu-item role="menuitemcheckbox" aria-checked={connected.includes(app.id)} onClick={() => toggleApp(app.id)} className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted">
                  <span aria-hidden="true" className="inline-flex size-4 items-center justify-center rounded bg-muted text-[8px]">{app.logo ?? app.name.slice(0, 1)}</span>
                  <span className="flex-1">{app.name}</span>
                  {connected.includes(app.id) ? <Paperclip aria-hidden="true" className="size-3 text-success" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <span role="status" className="sr-only">{approvalLoading ? 'Requesting approval' : ''}</span>
    </div>
  )
}
