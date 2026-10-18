import type { Locale } from '@/prefs/store';

/** `12.3k` / `1.2万` style counters for downloads and installs. */
export function formatCount(value: number, locale: Locale): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (locale === 'zh') {
    if (value >= 1e8) return `${trim(value / 1e8)}亿`;
    if (value >= 1e4) return `${trim(value / 1e4)}万`;
    return String(value);
  }
  if (value >= 1e9) return `${trim(value / 1e9)}B`;
  if (value >= 1e6) return `${trim(value / 1e6)}M`;
  if (value >= 1e3) return `${trim(value / 1e3)}k`;
  return String(value);
}

function trim(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '');
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatDate(millis: number, locale: Locale): string {
  if (!millis) return '—';
  return new Date(millis).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** `a, b ,c` → `['a', 'b', 'c']`. */
export function splitList(raw: string): string[] {
  return raw
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
