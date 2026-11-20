/** Shared value types for the affect component family. */

export type AffectStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'paused'

export type AffectTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

export type AffectSize = 'sm' | 'md' | 'lg'

export interface AffectMetric {
  label: string
  value: string | number
  hint?: string
  tone?: AffectTone
}

export interface AffectOption<T extends string = string> {
  value: T
  label: string
  description?: string
  disabled?: boolean
}
