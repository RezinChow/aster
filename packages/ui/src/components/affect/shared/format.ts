/** Small deterministic formatters shared by affect components. */

export function formatCost(amount: number, currency = '$'): string {
  if (!Number.isFinite(amount)) return `${currency}0`
  if (amount === 0) return `${currency}0`
  if (Math.abs(amount) < 0.01) return `<${currency}0.01`
  if (Math.abs(amount) >= 1000) return `${currency}${(amount / 1000).toFixed(1)}k`
  return `${currency}${amount.toFixed(2).replace(/\.?0+$/, '')}`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp)
  if (delta < 5_000) return 'just now'
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}

export function formatPercent(value: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round(Math.min(100, Math.max(0, (value / total) * 100)))}%`
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

export function truncate(text: string, max = 40): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
