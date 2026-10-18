import { CHANNEL_LEVELS, isChannelLevel, type ChannelLevel } from '@/data/channelPartners';

const LEVEL_KEY = 'kense.console.channelLevelShares.v1';
const PARTNER_KEY = 'kense.console.channelPartnerShares.v1';

export type LevelShares = Record<ChannelLevel, string>;

export function emptyLevelShares(): LevelShares {
  return {
    registered: '',
    authorized: '',
    silver: '',
    gold: '',
    strategic: '',
  };
}

/** SaaS channel rebate ladder: 5-point steps, strategic capped at 30%. */
const DEFAULT_LEVEL_SHARES: LevelShares = {
  registered: '5',
  authorized: '10',
  silver: '15',
  gold: '20',
  strategic: '30',
};

export function defaultLevelShares(): LevelShares {
  return { ...DEFAULT_LEVEL_SHARES };
}

/** Empty is allowed. Otherwise a number from 0 to 100, at most two decimals. */
export function parseShare(raw: string): number | null | 'invalid' {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return 'invalid';
  const amount = Number(value);
  if (amount < 0 || amount > 100) return 'invalid';
  return amount;
}

export function formatShare(amount: number): string {
  return String(Math.round(amount * 100) / 100);
}

function readMap(key: string): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const next: Record<string, string> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string') next[id] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function loadLevelShares(): LevelShares {
  const stored = readMap(LEVEL_KEY);
  const next = defaultLevelShares();
  for (const level of CHANNEL_LEVELS) {
    const parsed = parseShare(stored[level] ?? '');
    if (parsed == null || parsed === 'invalid') continue;
    next[level] = formatShare(parsed);
  }
  return next;
}

export function loadPartnerShares(): Record<string, string> {
  const stored = readMap(PARTNER_KEY);
  const next: Record<string, string> = {};
  for (const [id, value] of Object.entries(stored)) {
    const parsed = parseShare(value);
    if (parsed == null || parsed === 'invalid') continue;
    next[id] = formatShare(parsed);
  }
  return next;
}

export function saveChannelShares(levels: LevelShares, partners: Record<string, string>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LEVEL_KEY, JSON.stringify(levels));
    localStorage.setItem(PARTNER_KEY, JSON.stringify(partners));
  } catch {
    // Quota or private mode: the in-memory copy still works this session.
  }
}

export function saveLevelShares(levels: LevelShares) {
  saveChannelShares(levels, loadPartnerShares());
}

/** Empty clears the override and falls back to the level share. */
export function savePartnerShare(partnerId: string, raw: string): 'ok' | 'invalid' {
  const parsed = parseShare(raw);
  if (parsed === 'invalid') return 'invalid';
  const next = loadPartnerShares();
  if (parsed == null) delete next[partnerId];
  else next[partnerId] = formatShare(parsed);
  saveChannelShares(loadLevelShares(), next);
  return 'ok';
}

/** Partner override wins. Otherwise the level's share. */
export function effectiveShare(partnerId: string, level: string): string {
  const override = loadPartnerShares()[partnerId];
  if (override) return override;
  if (!isChannelLevel(level)) return '';
  return loadLevelShares()[level];
}
