/** Classify Cloud BFF failures for shell UX (friendly copy + raw detail). */

export type CloudScopeErrorKind =
  | 'unreachable'
  | 'unauthorized'
  | 'timeout'
  | 'unknown';

export function classifyCloudScopeError(raw: string): CloudScopeErrorKind {
  const message = raw.toLowerCase();
  if (
    message.includes('error sending request') ||
    message.includes('connection refused') ||
    message.includes('connect error') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error') ||
    message.includes('name or service not known') ||
    message.includes('nodename nor servname') ||
    message.includes('dns')
  ) {
    return 'unreachable';
  }
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('permission')
  ) {
    return 'unauthorized';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  return 'unknown';
}
