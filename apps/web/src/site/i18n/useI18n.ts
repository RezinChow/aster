import { useSnapshot } from 'valtio';
import { getMessages, i18nActions, i18nStore } from './index';
import type { Locale, Messages } from './types';

export function useI18n(): {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
} {
  const { locale } = useSnapshot(i18nStore);
  return {
    locale,
    t: getMessages(locale),
    setLocale: i18nActions.setLocale,
    toggleLocale: i18nActions.toggleLocale,
  };
}
