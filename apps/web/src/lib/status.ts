import type { BadgeTone } from '@a3s-lab/ui';
import type { FlowStatus } from '@/data/mock';

export function statusTone(
  status: FlowStatus | 'healthy' | 'degraded' | 'pending' | 'ready' | 'draining' | 'offline',
): BadgeTone {
  switch (status) {
    case 'running':
    case 'healthy':
    case 'ready':
      return 'success';
    case 'completed':
      return 'primary';
    case 'retrying':
    case 'degraded':
    case 'draining':
      return 'warn';
    case 'suspended':
    case 'pending':
      return 'neutral';
    case 'offline':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function eventTone(level: 'info' | 'warn' | 'error'): BadgeTone {
  if (level === 'error') return 'danger';
  if (level === 'warn') return 'warn';
  return 'neutral';
}
