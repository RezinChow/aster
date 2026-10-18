import { ApiRequestError } from '@/lib/apiEnvelope';
import type { MessageKey } from '@/i18n/messages';

/** Map a console sign-in failure onto one catalog entry. */
export function loginErrorKey(err: unknown): MessageKey {
  const message = (err instanceof Error ? err.message : String(err ?? ''))
    .trim()
    .toLowerCase();
  const code = err instanceof ApiRequestError ? err.code : 0;

  if (message === 'account locked' || message === 'locked') {
    return 'login.error.locked';
  }
  if (message === 'second factor required' || message === 'challenge_required') {
    return 'login.error.secondFactor';
  }
  if (
    code === 403 ||
    code === 40300 ||
    message.includes('not permitted to log in')
  ) {
    return 'login.error.forbidden';
  }
  if (
    code >= 500 ||
    message.startsWith('http ') ||
    message === 'storage' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network error')
  ) {
    return 'login.error.unavailable';
  }
  return 'login.error.credentials';
}
