import { usePrefs } from '@/prefs/store';

/** Stand-in for the Flow docs site runtime so the designer can run in Console. */
export function useLang(): 'zh' | 'en' {
  const { locale } = usePrefs();
  return locale === 'en' ? 'en' : 'zh';
}

export function useVersion(): string {
  return '1.1.0';
}

export function useSite() {
  return {
    site: {
      multiVersion: {
        default: '1.1.0',
        versions: ['1.1.0'],
      },
    },
  };
}

export function withBase(url: string): string {
  return url;
}
