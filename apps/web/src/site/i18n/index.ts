import { proxy } from 'valtio';
import { en } from './en';
import { zh } from './zh';
import type { Locale, Messages } from './types';

const STORAGE_KEY = 'a3s-locale';

const dictionaries: Record<Locale, Messages> = { zh, en };

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'zh';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'en' || stored === 'zh' ? stored : 'zh';
}

export const i18nStore = proxy({
  locale: 'zh' as Locale,
});

export function initLocale() {
  const locale = readStoredLocale();
  i18nStore.locale = locale;
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
}

export const i18nActions = {
  setLocale(locale: Locale) {
    i18nStore.locale = locale;
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  },
  toggleLocale() {
    i18nActions.setLocale(i18nStore.locale === 'zh' ? 'en' : 'zh');
  },
};

export function getMessages(locale: Locale = i18nStore.locale): Messages {
  return dictionaries[locale];
}
