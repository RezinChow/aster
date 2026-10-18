/** Platform-wide token usage calendar. Days stay empty until a meter is wired. */

export type TokenDay = {
  date: string; // YYYY-MM-DD
  tokens: number;
  /** 0 empty · 1–4 heat */
  level: 0 | 1 | 2 | 3 | 4;
};

export type TokenFilterOption = {
  id: string;
  label: string;
  /** Channel logo or user avatar (data URL / absolute URL). */
  imageUrl?: string;
};

function allChannelsMarkUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#334155"/><rect x="7" y="7" width="8" height="8" rx="2" fill="#94a3b8"/><rect x="17" y="7" width="8" height="8" rx="2" fill="#cbd5e1"/><rect x="7" y="17" width="8" height="8" rx="2" fill="#cbd5e1"/><rect x="17" y="17" width="8" height="8" rx="2" fill="#94a3b8"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function allUsersMarkUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#475569"/><circle cx="12" cy="13" r="3.2" fill="#e2e8f0"/><circle cx="20" cy="13" r="3.2" fill="#cbd5e1"/><path d="M7.5 23c.6-3 2.8-4.5 4.5-4.5h1c.4 0 .8.1 1.1.2 1-.7 2.2-1.1 3.4-1.1h1c1.7 0 3.9 1.5 4.5 4.5" fill="#e2e8f0"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const tokenChannelOptions: TokenFilterOption[] = [
  {
    id: 'all',
    label: 'All',
    imageUrl: allChannelsMarkUrl(),
  },
];

export const tokenUserOptions: TokenFilterOption[] = [
  {
    id: 'all',
    label: 'All',
    imageUrl: allUsersMarkUrl(),
  },
];


function levelFor(tokens: number, max: number): TokenDay['level'] {
  if (tokens <= 0) return 0;
  const r = tokens / max;
  if (r < 0.2) return 1;
  if (r < 0.45) return 2;
  if (r < 0.7) return 3;
  return 4;
}

export function daysForRange(rangeId: string) {
  if (rangeId === '30d') return 30;
  if (rangeId === '365d') return 365;
  return 90;
}

/** Fixed week columns so filters never change heatmap geometry. */
export const HEATMAP_WEEK_COLUMNS = 53;

function emptyDay(): TokenDay {
  return { date: '', tokens: 0, level: 0 };
}

function emptyWeek(): TokenDay[] {
  return Array.from({ length: 7 }, emptyDay);
}

/** Center the active range; pad both sides with empty weeks to a fixed column count. */
export function centerPadWeeks(
  weeks: TokenDay[][],
  columns = HEATMAP_WEEK_COLUMNS,
): TokenDay[][] {
  if (weeks.length === columns) return weeks;
  if (weeks.length > columns) {
    const start = Math.floor((weeks.length - columns) / 2);
    return weeks.slice(start, start + columns);
  }
  const totalPad = columns - weeks.length;
  const left = Math.floor(totalPad / 2);
  const right = totalPad - left;
  return [
    ...Array.from({ length: left }, emptyWeek),
    ...weeks,
    ...Array.from({ length: right }, emptyWeek),
  ];
}

function toDayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseDay(key: string) {
  return new Date(`${key}T12:00:00`);
}

export function defaultCustomRange(): { start: string; end: string } {
  const end = new Date();
  end.setHours(23, 45, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  start.setHours(0, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { start: fmt(start), end: fmt(end) };
}

/** Build a Sunday-aligned calendar ending at `end` spanning `days` days. */
export function buildTokenHeatmap(opts: {
  days?: number;
  start?: string;
  end?: string;
  channelId: string;
  userId: string;
}): { days: TokenDay[]; total: number; peak: number; weeks: TokenDay[][]; start: string; end: string } {
  let end = opts.end ? parseDay(opts.end) : new Date();
  end.setHours(12, 0, 0, 0);
  let start: Date;
  if (opts.start) {
    start = parseDay(opts.start);
  } else {
    const span = opts.days ?? 90;
    start = new Date(end);
    start.setDate(end.getDate() - (span - 1));
  }
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const raw: TokenDay[] = [];
  const peak = 1;
  const cursor = new Date(start);
  while (cursor <= end) {
    raw.push({ date: toDayKey(cursor), tokens: 0, level: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const days = raw.map((day) => ({
    ...day,
    level: levelFor(day.tokens, peak),
  }));
  const total = days.reduce((s, d) => s + d.tokens, 0);

  const first = parseDay(days[0]?.date ?? toDayKey(start));
  const pad = first.getDay();
  const cells: Array<TokenDay | null> = [
    ...Array.from({ length: pad }, () => null),
    ...days,
  ];
  const weeks: TokenDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const slice = cells.slice(i, i + 7);
    while (slice.length < 7) slice.push(null);
    weeks.push(slice.map((c) => c ?? { date: '', tokens: 0, level: 0 }));
  }

  return {
    days,
    total,
    peak,
    weeks: centerPadWeeks(weeks),
    start: toDayKey(start),
    end: toDayKey(end),
  };
}
