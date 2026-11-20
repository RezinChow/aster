import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '../../../lib/utils'
import { AffectSectionLabel, AffectSelectMenu } from '../shared'

export type DataColumnType = 'title' | 'tag' | 'link' | 'number' | 'text'
export type TagTone = 'blue' | 'violet' | 'pink' | 'green' | 'amber' | 'gray'

export interface DataColumn {
  key: string
  label: string
  icon?: ReactNode
  width?: number | string
  type?: DataColumnType
  editable?: boolean
  options?: string[]
  format?: (value: number) => string
}

export interface DataRow {
  id: string
  [key: string]: string | number | undefined
}

export interface DataTableProps {
  title?: string
  icon?: ReactNode
  columns: DataColumn[]
  rows: DataRow[]
  tagTones?: Record<string, TagTone>
  editable?: boolean
  onRowsChange?: (rows: DataRow[]) => void
  onSelectionChange?: (ids: string[]) => void
  className?: string
}

const tagClass: Record<TagTone, string> = {
  blue: 'bg-blue-500/10 text-blue-500',
  violet: 'bg-violet-500/10 text-violet-500',
  pink: 'bg-pink-500/10 text-pink-500',
  green: 'bg-success-subtle text-success-subtle-foreground',
  amber: 'bg-warning-subtle text-warning-subtle-foreground',
  gray: 'bg-muted text-muted-foreground'
}

/** A compact spreadsheet-style table with sorting, row selection and inline editing. */
export function DataTable({
  title,
  icon,
  columns,
  rows,
  tagTones,
  editable = true,
  onRowsChange,
  onSelectionChange,
  className
}: DataTableProps) {
  const [data, setData] = useState<DataRow[]>(rows)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [active, setActive] = useState<{ rowId: string; key: string } | null>(null)
  const [draft, setDraft] = useState('')

  const visible = [...data].sort((a, b) => {
    if (!sort) return 0
    const av = a[sort.key]
    const bv = b[sort.key]
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av ?? '').localeCompare(String(bv ?? ''))
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const commit = (value: string | number) => {
    if (!active) return
    const next = data.map((row) => row.id === active.rowId ? { ...row, [active.key]: value } : row)
    setData(next)
    onRowsChange?.(next)
    setActive(null)
  }

  const beginEdit = (row: DataRow, col: DataColumn) => {
    if (!editable || col.editable === false) return
    if (col.options) {
      setActive(null)
      const value = String(row[col.key] ?? col.options[0] ?? '')
      const next = data.map((item) => item.id === row.id ? { ...item, [col.key]: value } : item)
      setData(next)
      onRowsChange?.(next)
      return
    }
    setActive({ rowId: row.id, key: col.key })
    setDraft(String(row[col.key] ?? ''))
  }

  const toggleRow = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]
    setSelectedIds(next)
    onSelectionChange?.(next)
  }

  const toggleSort = (key: string) => {
    setSort((current) => current?.key === key
      ? current.dir === 'asc' ? { key, dir: 'desc' } : null
      : { key, dir: 'asc' })
  }

  const addRow = () => {
    const row: DataRow = { id: `row-${Date.now()}-${data.length}` }
    columns.forEach((col) => { row[col.key] = col.type === 'number' ? 0 : '' })
    const next = [...data, row]
    setData(next)
    onRowsChange?.(next)
  }

  const cellContent = (row: DataRow, col: DataColumn) => {
    const raw = row[col.key]
    if (col.type === 'number') {
      const n = typeof raw === 'number' ? raw : Number(raw) || 0
      return <span className="tabular-nums">{col.format ? col.format(n) : n.toLocaleString('en-US')}</span>
    }
    if (col.type === 'tag') {
      const text = String(raw ?? '')
      return text ? (
        <span className={cn('rounded px-1.5 py-0.5 text-[11px]', tagClass[tagTones?.[text] ?? 'gray'])}>{text}</span>
      ) : <span className="text-muted-foreground">—</span>
    }
    if (col.type === 'link' && typeof raw === 'string' && /^https?:\/\//.test(raw)) {
      return <a href={raw} target="_blank" rel="noreferrer" className="text-info underline underline-offset-2">{raw}</a>
    }
    const text = String(raw ?? '')
    return text ? <span className="truncate">{text}</span> : <span className="text-muted-foreground">—</span>
  }

  return (
    <div
      data-slot="data-table"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="truncate text-sm font-medium text-foreground">{title ?? 'Table'}</span>
          <AffectSectionLabel className="ml-1">{visible.length}</AffectSectionLabel>
        </div>
        {editable ? (
          <button
            type="button"
            onClick={addRow}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus aria-hidden="true" className="size-3" /> Add row
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto" role="region" aria-label={title ?? 'Data table'}>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/30 text-left text-muted-foreground">
              <th className="w-8 px-2 py-2" aria-label="Select row" />
              {columns.map((col) => (
                <th key={col.key} scope="col" className="px-2 py-2 font-medium" style={{ width: col.width }}>
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    aria-label={`Sort by ${col.label}`}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted hover:text-foreground"
                  >
                    {col.icon ? <span aria-hidden="true">{col.icon}</span> : null}
                    {col.label}
                    {sort?.key === col.key
                      ? sort.dir === 'asc' ? <ArrowUp aria-hidden="true" className="size-3" /> : <ArrowDown aria-hidden="true" className="size-3" />
                      : <ChevronsUpDown aria-hidden="true" className="size-3 opacity-50" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted-foreground">No rows</td></tr>
            ) : visible.map((row) => (
              <tr key={row.id} className={cn('border-t border-border', selectedIds.includes(row.id) && 'bg-accent/40')}>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    aria-label={`Select row ${row.id}`}
                    aria-pressed={selectedIds.includes(row.id)}
                    onClick={() => toggleRow(row.id)}
                    className={cn(
                      'flex size-4 items-center justify-center rounded border border-border text-transparent',
                      selectedIds.includes(row.id) && 'border-primary bg-primary text-primary-foreground'
                    )}
                  >
                    <Check aria-hidden="true" className="size-3" />
                  </button>
                </td>
                {columns.map((col) => {
                  const isActive = active?.rowId === row.id && active.key === col.key
                  return (
                    <td
                      key={col.key}
                      tabIndex={editable && col.editable !== false ? 0 : undefined}
                      onDoubleClick={() => beginEdit(row, col)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') beginEdit(row, col)
                      }}
                      className={cn(
                        'max-w-56 px-2 py-1.5 text-foreground',
                        editable && col.editable !== false && 'cursor-text hover:bg-muted/40',
                        isActive && 'bg-accent'
                      )}
                    >
                      {isActive ? (
                        col.options ? (
                          <AffectSelectMenu
                            autoFocus
                            label={col.label}
                            value={String(draft)}
                            options={col.options.map((option) => ({ value: option, label: option }))}
                            onChange={commit}
                            className="w-full"
                          />
                        ) : (
                          <input
                            autoFocus
                            aria-label={col.label}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => commit(col.type === 'number' ? Number(draft) || 0 : draft)}
                            onKeyDown={(event) => {
                              event.stopPropagation()
                              if (event.key === 'Enter') commit(col.type === 'number' ? Number(draft) || 0 : draft)
                              if (event.key === 'Escape') setActive(null)
                            }}
                            className="w-full rounded border border-border bg-background px-1 py-0.5 text-xs"
                          />
                        )
                      ) : cellContent(row, col)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        {selectedIds.length ? `${selectedIds.length} selected` : 'Double-click a cell to edit'}
      </div>
    </div>
  )
}
