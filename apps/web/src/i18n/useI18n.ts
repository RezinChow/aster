import { useCallback } from 'react';
import { usePrefs } from '@/prefs/store';
import { translate, type MessageKey } from './messages';

export function useI18n() {
  const { locale } = usePrefs();
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);
  return { locale, t };
}

export type { MessageKey };
