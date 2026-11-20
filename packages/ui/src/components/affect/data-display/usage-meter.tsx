import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import { cn } from '../../../lib/utils'
import { AffectMeter, AffectSectionLabel, formatPercent } from '../shared'

export interface UsagePart {
  label: string
  value: number
  color?: string
}

export interface UsageLimit {
  label: string
  used: number
  total?: number | null
  unit?: string
  decimals?: number
}

export interface UsagePeriod {
  id: string
  label: string
}

export interface UsageMeterProps {
  total: number
  used: UsagePart[]
  limits?: UsageLimit[]
  periods?: UsagePeriod[]
  period?: string
  defaultPeriod?: string
  onPeriodChange?: (id: string) => void
  resetAt?: Date | string | number
  daily?: { label: string; value: number | null }[]
  onUpgrade?: (state: 'ok' | 'warn' | 'limit') => void
  title?: string
  plan?: string
  unit?: string
  warnAt?: number
  upgradeLabel?: string
  topUpLabel?: string
  className?: string
}

const palette = ['#2f6bff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b']
const whole = (n: number) => Math.round(n).toLocaleString('en-US')

/** Plan usage: a stacked credits meter, limits, a daily sparkline and an upgrade nudge. */
export function UsageMeter({
  total,
  used,
  limits = [],
  periods,
  period,
  defaultPeriod,
  onPeriodChange,
  resetAt,
  daily = [],
  onUpgrade,
  title = 'Usage',
  plan,
  unit = 'credits',
  warnAt = 0.8,
  upgradeLabel = 'Upgrade',
  topUpLabel = 'Add credits',
  className
}: UsageMeterProps) {
  const [internalPeriod, setInternalPeriod] = useState(defaultPeriod ?? periods?.[0]?.id ?? '')
  const [hovered, setHovered] = useState<string | null>(null)
  const activePeriod = period ?? internalPeriod
  const sum = used.reduce((acc, item) => acc + item.value, 0)
  const ratio = total > 0 ? sum / total : 0
  const state: 'ok' | 'warn' | 'limit' = ratio >= 1 ? 'limit' : ratio >= warnAt ? 'warn' : 'ok'
  const sorted = [...used].sort((a, b) => b.value - a.value)
  const selected = sorted.find((item) => item.label === hovered)

  const resetDate = resetAt ? new Date(resetAt) : null
  const days = resetDate ? Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / 86_400_000)) : null

  const dailyValues = daily.map((d) => d.value ?? 0)
  const dailyMax = Math.max(1, ...dailyValues)
  const sparkPoints = daily.map((d, i) => `${(i / Math.max(1, daily.length - 1)) * 100},${24 - (d.value == null ? 0 : (d.value / dailyMax) * 22)}`).join(' ')

  return (
    <div
      data-slot="usage-meter"
      className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">
            {plan ? `${plan} · ` : ''}
            {days !== null ? <span title={resetDate?.toDateString()}>Resets in {days} {days === 1 ? 'day' : 'days'}</span> : 'Usage this period'}
          </div>
        </div>
        {periods && periods.length > 1 ? (
          <div role="group" aria-label="Period" className="flex shrink-0 rounded-md bg-muted p-0.5">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={activePeriod === p.id}
                onClick={() => {
                  setInternalPeriod(p.id)
                  onPeriodChange?.(p.id)
                }}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px]',
                  activePeriod === p.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {selected ? whole(selected.value) : whole(sum)}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {selected ? selected.label : `of ${whole(total)} ${unit}`}
            </span>
          </div>
          <div
            role="img"
            aria-label={`${whole(sum)} of ${whole(total)} ${unit} used`}
            className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            {sorted.map((item, index) => (
              <div
                key={item.label}
                tabIndex={0}
                title={`${item.label}: ${whole(item.value)} ${unit}`}
                onMouseEnter={() => setHovered(item.label)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(item.label)}
                onBlur={() => setHovered(null)}
                className={cn('h-full transition-opacity', hovered && hovered !== item.label && 'opacity-40')}
                style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%`, backgroundColor: item.color ?? palette[index % palette.length] }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className={cn('text-[11px] font-medium', state === 'limit' ? 'text-destructive' : state === 'warn' ? 'text-warning' : 'text-muted-foreground')}>
              {formatPercent(sum, total)} used
            </span>
            {onUpgrade ? (
              <button
                type="button"
                onClick={() => onUpgrade(state)}
                className={cn(
                  'ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  state === 'ok'
                    ? 'border border-border text-foreground hover:bg-muted'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {state === 'ok' ? upgradeLabel : topUpLabel}
                <ArrowUpRight aria-hidden="true" className="size-3" />
              </button>
            ) : null}
          </div>
        </div>

        {daily.length ? (
          <div className="border-t border-border pt-2">
            <AffectSectionLabel>Daily usage</AffectSectionLabel>
            <svg viewBox="0 0 100 26" preserveAspectRatio="none" className="mt-1 h-8 w-full" role="img" aria-label="Daily usage sparkline">
              <polyline points={sparkPoints} fill="none" stroke={state === 'limit' ? '#ef4444' : '#2f6bff'} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{daily[0]?.label}</span>
              <span>{daily[daily.length - 1]?.label}</span>
            </div>
          </div>
        ) : null}

        {limits.length ? (
          <div className="space-y-2 border-t border-border pt-2">
            <AffectSectionLabel>Limits</AffectSectionLabel>
            {limits.map((limit) => (
              <div key={limit.label} className="grid grid-cols-[64px_1fr_72px] items-center gap-2">
                <span className="truncate text-[11px] text-muted-foreground">{limit.label}</span>
                <AffectMeter
                  value={limit.used}
                  max={limit.total ?? Math.max(1, limit.used)}
                  tone={limit.total == null ? 'neutral' : limit.used / limit.total >= warnAt ? 'warning' : 'primary'}
                  label={`${limit.label} usage`}
                  className="h-1.5"
                />
                <span className="text-right text-[11px] tabular-nums text-foreground">
                  {limit.used.toFixed(limit.decimals ?? 0)} / {limit.total == null ? '∞' : `${limit.total.toFixed(limit.decimals ?? 0)}${limit.unit ?? ''}`}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
