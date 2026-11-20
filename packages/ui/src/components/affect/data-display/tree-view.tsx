import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

import { cn } from '../../../lib/utils'

export interface TreeNode {
  id: string
  label: string
  icon?: ReactNode
  openIcon?: ReactNode
  meta?: ReactNode
  disabled?: boolean
  children?: TreeNode[]
}

export interface TreeViewProps {
  items: TreeNode[]
  expanded?: string[]
  defaultExpanded?: string[]
  onExpandedChange?: (ids: string[]) => void
  selected?: string | null
  defaultSelected?: string | null
  onSelect?: (id: string, node: TreeNode) => void
  guides?: boolean
  emptyText?: string
  'aria-label'?: string
  className?: string
}

interface FlatNode {
  node: TreeNode
  depth: number
  parentId: string | null
}

/** A nested folder/file tree with keyboard navigation and type-ahead. */
export function TreeView({
  items,
  expanded,
  defaultExpanded = [],
  onExpandedChange,
  selected,
  defaultSelected = null,
  onSelect,
  guides = true,
  emptyText = 'Empty',
  'aria-label': ariaLabel = 'Tree view',
  className
}: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = useState<string[]>(defaultExpanded)
  const [internalSelected, setInternalSelected] = useState<string | null>(defaultSelected)
  const openIds = expanded ?? internalExpanded
  const activeId = selected !== undefined ? selected : internalSelected
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const typeAhead = useRef({ text: '', at: 0 })

  const toggle = (id: string) => {
    const next = openIds.includes(id) ? openIds.filter((item) => item !== id) : [...openIds, id]
    setInternalExpanded(next)
    onExpandedChange?.(next)
  }

  const pick = (id: string, node: TreeNode) => {
    setInternalSelected(id)
    onSelect?.(id, node)
    rowRefs.current[id]?.focus()
  }

  const flat: FlatNode[] = []
  const walk = (nodes: TreeNode[], depth: number, parentId: string | null) => {
    for (const node of nodes) {
      flat.push({ node, depth, parentId })
      const isBranch = node.children !== undefined
      if (isBranch && openIds.includes(node.id)) walk(node.children ?? [], depth + 1, node.id)
    }
  }
  walk(items, 0, null)
  const enabled = flat.filter(({ node }) => !node.disabled)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string, node: TreeNode) => {
    const pos = enabled.findIndex((entry) => entry.node.id === id)
    const isBranch = node.children !== undefined
    const isOpen = openIds.includes(id)
    const focusAt = (next: number) => {
      const target = enabled[Math.max(0, Math.min(enabled.length - 1, next))]
      if (target) pick(target.node.id, target.node)
    }
    if (event.key === 'ArrowDown') focusAt(pos + 1)
    else if (event.key === 'ArrowUp') focusAt(pos - 1)
    else if (event.key === 'Home') focusAt(0)
    else if (event.key === 'End') focusAt(enabled.length - 1)
    else if (event.key === 'ArrowRight') {
      if (isBranch && !isOpen) toggle(id)
      else if (isBranch && isOpen) focusAt(pos + 1)
    } else if (event.key === 'ArrowLeft') {
      if (isBranch && isOpen) toggle(id)
      else {
        const current = flat.find((entry) => entry.node.id === id)
        if (current?.parentId) pick(current.parentId, flat.find((entry) => entry.node.id === current.parentId)?.node ?? node)
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      pick(id, node)
      if (isBranch) toggle(id)
    } else if (event.key.length === 1) {
      const now = Date.now()
      const state = typeAhead.current
      state.text = now - state.at > 500 ? event.key : state.text + event.key
      state.at = now
      const match = enabled.find((entry) => entry.node.label.toLowerCase().startsWith(state.text.toLowerCase()))
      if (match) pick(match.node.id, match.node)
    } else return
    event.preventDefault()
  }

  return (
    <ul role="tree" aria-label={ariaLabel} className={cn('w-full text-xs', className)} data-slot="tree-view">
      {flat.length === 0 ? <li className="px-2 py-3 text-muted-foreground">{emptyText}</li> : flat.map(({ node, depth }) => {
        const isBranch = node.children !== undefined
        const isOpen = openIds.includes(node.id)
        const isSelected = activeId === node.id
        return (
          <li key={node.id} role="none">
            <div
              ref={(element) => { rowRefs.current[node.id] = element }}
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={isBranch ? isOpen : undefined}
              aria-selected={isSelected}
              aria-disabled={node.disabled || undefined}
              tabIndex={isSelected || (!activeId && node.id === flat[0]?.node.id) ? 0 : -1}
              onClick={() => {
                if (node.disabled) return
                pick(node.id, node)
                if (isBranch) toggle(node.id)
              }}
              onKeyDown={(event) => onKeyDown(event, node.id, node)}
              className={cn(
                'relative flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 outline-none transition-colors',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
                node.disabled && 'pointer-events-none opacity-50'
              )}
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              {guides && depth > 0 ? (
                <span aria-hidden="true" className="absolute top-0 h-full w-px bg-border" style={{ left: 8 + (depth - 1) * 16 + 7 }} />
              ) : null}
              {isBranch ? (
                <ChevronRight aria-hidden="true" className={cn('size-3 shrink-0 transition-transform', isOpen && 'rotate-90')} />
              ) : (
                <span className="size-3 shrink-0" />
              )}
              <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                {node.icon ?? (isBranch ? (isOpen ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />) : <File className="size-3.5" />)}
              </span>
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {node.meta ? <span className="shrink-0 text-[10px] text-muted-foreground">{node.meta}</span> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
