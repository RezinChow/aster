import { CheckCircle2, FileText, RotateCcw, UploadCloud, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter } from '../shared'

export type UploadStatus = 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  name: string
  size: number
  status: UploadStatus
  progress: number
  error?: string
  file?: File
}

export interface DropzoneProps {
  accept?: string[]
  maxSize?: number
  onUpload?: (file: File, onProgress: (p: number) => void) => Promise<void>
  onChange?: (items: UploadItem[]) => void
  hint?: string
  autoplay?: boolean
  className?: string
}

const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Drag-and-drop upload area with progress, errors and retry. */
export function Dropzone({ accept, maxSize = 25 * 1024 * 1024, onUpload, onChange, hint, autoplay, className }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)

  const emit = (next: UploadItem[]) => { setItems(next); onChange?.(next) }
  const patch = (id: string, changes: Partial<UploadItem>) => {
    setItems((current) => {
      const next = current.map((item) => item.id === id ? { ...item, ...changes } : item)
      onChange?.(next)
      return next
    })
  }

  const runUpload = async (item: UploadItem) => {
    if (!item.file) return
    patch(item.id, { status: 'uploading', progress: 0, error: undefined })
    try {
      if (onUpload) await onUpload(item.file, (p) => patch(item.id, { progress: p }))
      else for (let p = 0; p <= 1.0001; p += 0.1) { await new Promise((r) => window.setTimeout(r, 120)); patch(item.id, { progress: Math.min(1, p) }) }
      patch(item.id, { status: 'done', progress: 1 })
    } catch (error) {
      patch(item.id, { status: 'error', error: error instanceof Error ? error.message : 'Upload failed' })
    }
  }

  const addFiles = (files: FileList | File[]) => {
    const added: UploadItem[] = Array.from(files).map((file) => {
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      const badType = accept && !accept.some((a) => a.toLowerCase() === extension || a.toLowerCase() === file.type)
      const tooLarge = file.size > maxSize
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        size: file.size,
        status: badType ? 'error' as const : 'uploading' as const,
        progress: 0,
        error: badType ? `Unsupported type (${extension || 'unknown'})` : tooLarge ? 'Too large' : undefined,
        file
      }
    })
    emit([...items, ...added])
    added.filter((item) => item.status === 'uploading' && !item.error).forEach((item) => void runUpload(item))
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files)
  }

  const defaultHint = `Drop files here or click to browse${accept ? ` · ${accept.join(', ')}` : ''} · up to ${formatSize(maxSize)}`

  return (
    <div data-slot="dropzone" className={cn('w-full max-w-[520px] space-y-2', className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-primary focus-visible:border-primary focus-visible:outline-none', dragging && 'border-primary bg-accent/40')}
      >
        <UploadCloud className="size-7 text-muted-foreground" />
        <p className="text-xs font-medium text-foreground">Upload files</p>
        <p className="text-[11px] text-muted-foreground">{hint ?? defaultHint}</p>
        <input ref={inputRef} type="file" multiple accept={accept?.join(',')} className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
      </div>
      {autoplay && items.length === 0 ? (
        <button type="button" onClick={() => addFiles([new File(['sample'], 'report.pdf', { type: 'application/pdf' })])} className="text-[11px] text-muted-foreground underline">Load sample files</button>
      ) : null}
      <div className="space-y-2" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground', item.status === 'done' && 'bg-success-subtle text-success-subtle-foreground')}>
              {item.status === 'done' ? <CheckCircle2 className="size-4" /> : <FileText className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">{item.name}</span>
              <span className="block text-[10px] text-muted-foreground">{item.error ?? formatSize(item.size)}</span>
              {item.status === 'uploading' ? <AffectMeter value={item.progress * 100} tone={item.error ? 'danger' : 'primary'} className="mt-1" /> : null}
            </span>
            {item.status === 'error' ? <button type="button" aria-label={`Retry ${item.name}`} onClick={() => void runUpload(item)} className="rounded p-1 text-muted-foreground hover:text-foreground"><RotateCcw className="size-3.5" /></button> : null}
            <button type="button" aria-label={`Remove ${item.name}`} onClick={() => emit(items.filter((i) => i.id !== item.id))} className="rounded p-1 text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}
