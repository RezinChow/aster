import { ArrowUpRight, X } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectToneBadge } from '../shared'
import type { AffectTone } from '../shared'

export interface NoticeAction {
  label: string
  href?: string
  onClick?: () => void
  external?: boolean
}

export interface Notice {
  id: string
  badge?: string
  title: string
  text?: string
  action?: NoticeAction
  pattern?: string
  tone?: AffectTone
}

export interface NotificationStackProps {
  notices: Notice[]
  onDismiss?: (notice: Notice) => void
  className?: string
}

/** Notice cards stacked behind each other; dismissing the front reveals the next. */
export function NotificationStack({ notices, onDismiss, className }: NotificationStackProps) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const visible = notices.filter((notice) => !dismissed.includes(notice.id))

  const dismiss = (notice: Notice) => {
    setDismissed((current) => [...current, notice.id])
    onDismiss?.(notice)
  }

  return (
    <div
      data-slot="notification-stack"
      aria-live="polite"
      className={cn('relative w-full', className)}
      style={{ minHeight: visible.length ? 92 + (visible.length - 1) * 12 : 0 }}
    >
      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">All caught up</div>
      ) : visible.map((notice, index) => {
        const isFront = index === 0
        return (
          <div
            key={notice.id}
            className={cn(
              'absolute inset-x-0 top-0 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-md transition-all',
              !isFront && 'pointer-events-none'
            )}
            style={{
              zIndex: visible.length - index,
              transform: `translateY(${index * 12}px) scale(${1 - index * 0.03})`,
              opacity: 1 - index * 0.12
            }}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                {notice.badge ? <AffectToneBadge tone={notice.tone ?? 'info'}>{notice.badge}</AffectToneBadge> : null}
                <div className="text-xs font-medium text-foreground">{notice.title}</div>
                {notice.text ? <div className="text-[11px] leading-relaxed text-muted-foreground">{notice.text}</div> : null}
                {notice.action ? (
                  notice.action.href ? (
                    <a
                      href={notice.action.href}
                      target={notice.action.external ? '_blank' : undefined}
                      rel={notice.action.external ? 'noreferrer' : undefined}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-info hover:underline"
                    >
                      {notice.action.label}
                      {notice.action.external ? <ArrowUpRight aria-hidden="true" className="size-3" /> : null}
                    </a>
                  ) : (
                    <button type="button" onClick={notice.action.onClick} className="text-[11px] font-medium text-info hover:underline">
                      {notice.action.label}
                    </button>
                  )
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Dismiss ${notice.title}`}
                onClick={() => dismiss(notice)}
                className="-mr-1 -mt-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
