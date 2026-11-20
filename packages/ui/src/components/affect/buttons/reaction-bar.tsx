import { Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'

export type ReactionKey = 'like' | 'comment' | 'repost' | 'share'

export interface ReactionState {
  count: number
  active?: boolean
}

export interface ReactionBarProps {
  reactions: Partial<Record<ReactionKey, ReactionState>>
  onReact?: (key: ReactionKey, state: ReactionState) => void
  actions?: ReactionKey[]
  className?: string
}

const meta: Record<ReactionKey, { label: string; icon: typeof Heart; activeClass: string }> = {
  like: { label: 'Like', icon: Heart, activeClass: 'bg-destructive/10 text-destructive' },
  comment: { label: 'Comment', icon: MessageCircle, activeClass: 'bg-info-subtle text-info' },
  repost: { label: 'Repost', icon: Repeat2, activeClass: 'bg-success-subtle text-success-subtle-foreground' },
  share: { label: 'Share', icon: Share2, activeClass: 'bg-accent text-accent-foreground' }
}

const defaultActions: ReactionKey[] = ['like', 'comment', 'repost', 'share']

/** Like / comment / repost / share as toggle buttons with live counts. */
export function ReactionBar({ reactions, onReact, actions = defaultActions, className }: ReactionBarProps) {
  const [overrides, setOverrides] = useState<Partial<Record<ReactionKey, ReactionState>>>({})
  const get = (key: ReactionKey): ReactionState => overrides[key] ?? reactions[key] ?? { count: 0 }

  const toggle = (key: ReactionKey) => {
    const current = get(key)
    const active = !current.active
    const next: ReactionState = { count: Math.max(0, current.count + (active ? 1 : -1)), active }
    setOverrides((prev) => ({ ...prev, [key]: next }))
    onReact?.(key, next)
  }

  return (
    <div
      role="group"
      aria-label="Reactions"
      data-slot="reaction-bar"
      className={cn('inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-1', className)}
    >
      {actions.map((key) => {
        const item = meta[key]
        const state = get(key)
        const Icon = item.icon
        return (
          <button
            key={key}
            type="button"
            aria-pressed={state.active === true}
            aria-label={`${item.label}, ${state.count}`}
            title={`${item.label} (${state.count})`}
            onClick={() => toggle(key)}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              state.active && item.activeClass
            )}
          >
            <Icon aria-hidden="true" className={cn('size-3.5', state.active && 'fill-current')} />
            <span className="tabular-nums">{state.count}</span>
          </button>
        )
      })}
    </div>
  )
}
