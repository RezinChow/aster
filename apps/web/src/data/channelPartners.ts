/**
 * Channel partners are tenants.
 * A Cloud organization is a channel partner. Extra company fields stay in this
 * browser, keyed by that tenant id. This module does not create Organizations.
 */

import { resolveTerritory } from '@/data/chinaRegions';

export type ChannelPartnerStatus = 'active' | 'inactive';

export const CHANNEL_LEVELS = [
  'registered',
  'authorized',
  'silver',
  'gold',
  'strategic',
] as const;

export type ChannelLevel = (typeof CHANNEL_LEVELS)[number];

export type PartnerIssue =
  | 'name'
  | 'email'
  | 'website'
  | 'logo'
  | 'status'
  | 'level'
  | 'province'
  | 'city'
  | 'region'
  | 'duplicate';

export type ChannelTerritory = {
  province: string;
  city: string;
  county: string;
};

export type ChannelPartner = {
  id: string;
  name: string;
  /** Organization customer this channel was created from. */
  customerId: string;
  legalName: string;
  logoUrl: string;
  website: string;
  region: string;
  /** Whole-country coverage. Mutually exclusive with territories. */
  nationwide: boolean;
  territories: ChannelTerritory[];
  province: string;
  city: string;
  county: string;
  level: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  notes: string;
  /** Null until this tenant has a saved profile. */
  status: ChannelPartnerStatus | null;
  createdAt: string;
};

export type ChannelPartnerInput = Omit<ChannelPartner, 'id' | 'createdAt' | 'status'> & {
  status: ChannelPartnerStatus;
};

export type CsvPreviewRow = {
  line: number;
  name: string;
  issue: PartnerIssue | null;
  input: ChannelPartnerInput | null;
};

export type CsvPreview = {
  error: 'header' | 'empty' | null;
  rows: CsvPreviewRow[];
};

const STORAGE_KEY = 'kense.console.channelPartners.v1';
const MAX_LOGO_CHARS = 400_000;

export const PARTNER_CSV_HEADERS = [
  'name',
  'legalName',
  'website',
  'region',
  'province',
  'city',
  'county',
  'level',
  'industry',
  'contactName',
  'contactEmail',
  'phone',
  'notes',
  'status',
] as const;

const HEADER_ALIAS: Record<string, (typeof PARTNER_CSV_HEADERS)[number]> = {
  name: 'name',
  company: 'name',
  companyname: 'name',
  legalname: 'legalName',
  legal: 'legalName',
  website: 'website',
  url: 'website',
  region: 'region',
  country: 'region',
  province: 'province',
  省: 'province',
  city: 'city',
  市: 'city',
  county: 'county',
  区: 'county',
  区县: 'county',
  县: 'county',
  level: 'level',
  tier: 'level',
  级别: 'level',
  渠道级别: 'level',
  industry: 'industry',
  contactname: 'contactName',
  contact: 'contactName',
  contactemail: 'contactEmail',
  email: 'contactEmail',
  phone: 'phone',
  tel: 'phone',
  notes: 'notes',
  note: 'notes',
  status: 'status',
};

let partners: ChannelPartner[] | null = null;
const partnerListeners = new Set<() => void>();

export function emptyPartnerInput(): ChannelPartnerInput {
  return {
    name: '',
    customerId: '',
    legalName: '',
    logoUrl: '',
    website: '',
    region: '',
    nationwide: false,
    territories: [],
    province: '',
    city: '',
    county: '',
    level: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    phone: '',
    notes: '',
    status: 'active',
  };
}

export function partnerToInput(partner: ChannelPartner): ChannelPartnerInput {
  return {
    name: partner.name,
    customerId: partner.customerId,
    legalName: partner.legalName,
    logoUrl: partner.logoUrl,
    website: partner.website,
    region: partner.region,
    nationwide: partner.nationwide,
    territories: partner.territories.map((item) => ({ ...item })),
    province: partner.province,
    city: partner.city,
    county: partner.county,
    level: partner.level,
    industry: partner.industry,
    contactName: partner.contactName,
    contactEmail: partner.contactEmail,
    phone: partner.phone,
    notes: partner.notes,
    status: partner.status ?? 'active',
  };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `chp_${uuid}`;
  return `chp_${Math.random().toString(36).slice(2, 10)}`;
}

function fold(value: string): string {
  return value.trim().toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readTerritories(value: Record<string, unknown>): ChannelTerritory[] {
  if (Array.isArray(value.territories)) {
    const parsed = value.territories.flatMap((item) => {
      if (!isRecord(item)) return [];
      const province = text(item.province).trim();
      if (!province) return [];
      return [{ province, city: text(item.city).trim(), county: text(item.county).trim() }];
    });
    if (parsed.length > 0) return parsed;
  }
  const province = text(value.province).trim();
  if (!province) return [];
  return [{ province, city: text(value.city).trim(), county: text(value.county).trim() }];
}

function readPartner(value: unknown): ChannelPartner | null {
  if (!isRecord(value)) return null;
  const legacyTenant = text(value.tenantId).trim();
  const id = legacyTenant || (typeof value.id === 'string' ? value.id : '');
  if (!id || typeof value.name !== 'string') return null;
  return {
    id,
    name: value.name,
    customerId: text(value.customerId),
    legalName: text(value.legalName),
    logoUrl: text(value.logoUrl),
    website: text(value.website),
    region: text(value.region),
    nationwide: value.nationwide === true,
    territories: value.nationwide === true ? [] : readTerritories(value),
    province: text(value.province),
    city: text(value.city),
    county: text(value.county),
    level: text(value.level),
    industry: text(value.industry),
    contactName: text(value.contactName),
    contactEmail: text(value.contactEmail),
    phone: text(value.phone),
    notes: text(value.notes),
    status: value.status === 'inactive' ? 'inactive' : 'active',
    createdAt: text(value.createdAt) || today(),
  };
}

function readStore(): ChannelPartner[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const map = new Map<string, ChannelPartner>();
    for (const item of parsed) {
      const partner = readPartner(item);
      if (partner) map.set(partner.id, partner);
    }
    return [...map.values()];
  } catch {
    return [];
  }
}

function ensure(): ChannelPartner[] {
  if (!partners) partners = readStore();
  return partners;
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensure()));
  } catch {
    // Quota or private mode: the in-memory copy still works this session.
  }
  for (const listener of partnerListeners) listener();
}

export function subscribeChannelPartners(listener: () => void): () => void {
  partnerListeners.add(listener);
  return () => {
    partnerListeners.delete(listener);
  };
}

function clone(partner: ChannelPartner): ChannelPartner {
  return {
    ...partner,
    territories: partner.territories.map((item) => ({ ...item })),
  };
}

function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.')) return null;
  return url.toString();
}

function normalizeEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

function normalizeLogo(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  if (value.startsWith('data:image/')) {
    return value.length <= MAX_LOGO_CHARS ? value : null;
  }
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isChannelLevel(value: string): value is ChannelLevel {
  return (CHANNEL_LEVELS as readonly string[]).includes(value);
}

function normalizeLevel(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return '';
  const alias: Record<string, ChannelLevel> = {
    registered: 'registered',
    注册: 'registered',
    authorized: 'authorized',
    certified: 'authorized',
    认证: 'authorized',
    silver: 'silver',
    银牌: 'silver',
    gold: 'gold',
    金牌: 'gold',
    strategic: 'strategic',
    战略: 'strategic',
  };
  return alias[value] ?? alias[raw.trim()] ?? null;
}

function nameSet(exceptId?: string): Set<string> {
  return new Set(
    ensure()
      .filter((item) => item.id !== exceptId)
      .map((item) => fold(item.name)),
  );
}

function isDivisionKey(value: string): boolean {
  return /^\d{6}(?:\/|$)/.test(value);
}

function normalizeTerritory(
  provinceRaw: string,
  cityRaw: string,
  countyRaw: string,
): { ok: true; province: string; city: string; county: string } | { ok: false; issue: 'province' | 'city' } {
  const province = provinceRaw.trim();
  const city = cityRaw.trim();
  const county = countyRaw.trim();
  if (!province && !city && !county) return { ok: true, province: '', city: '', county: '' };
  if (!province) return { ok: false, issue: 'province' };
  if (!city && county) return { ok: false, issue: 'city' };
  if (isDivisionKey(province) || isDivisionKey(city) || isDivisionKey(county)) {
    return { ok: true, province, city, county };
  }
  const territory = resolveTerritory(province, city);
  if (!territory.ok) return territory;
  return { ok: true, province: territory.province, city: territory.city, county: '' };
}

function territoryPath(item: ChannelTerritory): string[] {
  return [item.province, item.city, item.county].filter((part) => part.length > 0);
}

function sameTerritory(left: ChannelTerritory, right: ChannelTerritory): boolean {
  const a = territoryPath(left);
  const b = territoryPath(right);
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

function territoryCovers(ancestor: ChannelTerritory, item: ChannelTerritory): boolean {
  const parent = territoryPath(ancestor);
  const path = territoryPath(item);
  return parent.length < path.length && parent.every((part, index) => part === path[index]);
}

function compressTerritories(items: ChannelTerritory[]): ChannelTerritory[] {
  const unique: ChannelTerritory[] = [];
  for (const item of items) {
    if (!unique.some((other) => sameTerritory(other, item))) unique.push(item);
  }
  return unique.filter(
    (item) => !unique.some((other) => territoryCovers(other, item)),
  );
}

function normalizeCoverage(
  input: ChannelPartnerInput,
  requireCoverage: boolean,
):
  | { ok: true; nationwide: boolean; territories: ChannelTerritory[] }
  | { ok: false; issue: PartnerIssue } {
  if (input.nationwide) return { ok: true, nationwide: true, territories: [] };
  const raw = input.territories.length > 0
    ? input.territories
    : input.province.trim()
      ? [{ province: input.province, city: input.city, county: input.county }]
      : [];
  const territories: ChannelTerritory[] = [];
  for (const item of raw) {
    const territory = normalizeTerritory(item.province, item.city, item.county);
    if (!territory.ok) return { ok: false, issue: territory.issue };
    if (territory.province) {
      territories.push({
        province: territory.province,
        city: territory.city,
        county: territory.county,
      });
    }
  }
  const compressed = compressTerritories(territories);
  if (requireCoverage && compressed.length === 0) return { ok: false, issue: 'region' };
  return { ok: true, nationwide: false, territories: compressed };
}

export function preparePartnerInput(
  input: ChannelPartnerInput,
  options?: {
    exceptId?: string;
    takenNames?: Set<string>;
    requireCoverage?: boolean;
  },
): { ok: true; value: ChannelPartnerInput } | { ok: false; issue: PartnerIssue } {
  const name = input.name.trim();
  if (!name) return { ok: false, issue: 'name' };
  if (input.status !== 'active' && input.status !== 'inactive') {
    return { ok: false, issue: 'status' };
  }
  const website = normalizeWebsite(input.website);
  if (website == null) return { ok: false, issue: 'website' };
  const contactEmail = normalizeEmail(input.contactEmail);
  if (contactEmail == null) return { ok: false, issue: 'email' };
  const logoUrl = normalizeLogo(input.logoUrl);
  if (logoUrl == null) return { ok: false, issue: 'logo' };
  const level = normalizeLevel(input.level);
  if (level == null) return { ok: false, issue: 'level' };
  const coverage = normalizeCoverage(input, options?.requireCoverage === true);
  if (!coverage.ok) return { ok: false, issue: coverage.issue };
  const first = coverage.territories[0];
  const takenNames = options?.takenNames ?? nameSet(options?.exceptId);
  if (takenNames.has(fold(name))) return { ok: false, issue: 'duplicate' };
  return {
    ok: true,
    value: {
      name,
      customerId: input.customerId.trim(),
      legalName: input.legalName.trim(),
      logoUrl,
      website,
      region: input.region.trim(),
      nationwide: coverage.nationwide,
      territories: coverage.territories,
      province: first?.province ?? '',
      city: first?.city ?? '',
      county: first?.county ?? '',
      level,
      industry: input.industry.trim(),
      contactName: input.contactName.trim(),
      contactEmail,
      phone: input.phone.trim(),
      notes: input.notes.trim(),
      status: input.status,
    },
  };
}

function insert(
  input: ChannelPartnerInput,
  createdAt = today(),
  id = newId(),
): ChannelPartner {
  const partner: ChannelPartner = {
    id,
    ...input,
    createdAt,
  };
  ensure().unshift(partner);
  return clone(partner);
}

export function listChannelPartners(): ChannelPartner[] {
  return ensure().map(clone);
}

export function getChannelPartner(id: string): ChannelPartner | undefined {
  const item = ensure().find((row) => row.id === id);
  return item ? clone(item) : undefined;
}

export function createChannelPartner(
  input: ChannelPartnerInput,
  options?: { requireCoverage?: boolean },
): { partner?: ChannelPartner; issue?: PartnerIssue } {
  const prepared = preparePartnerInput(input, options);
  if (!prepared.ok) return { issue: prepared.issue };
  const partner = insert(prepared.value);
  persist();
  return { partner };
}

export function updateChannelPartner(
  id: string,
  input: ChannelPartnerInput,
  createdAt?: string,
  options?: { requireCoverage?: boolean },
): { partner?: ChannelPartner; issue?: PartnerIssue } {
  const prepared = preparePartnerInput(input, {
    exceptId: id,
    requireCoverage: options?.requireCoverage,
  });
  if (!prepared.ok) return { issue: prepared.issue };
  const current = ensure().find((row) => row.id === id);
  if (!current) {
    const date = createdAt?.slice(0, 10) ?? '';
    const partner = insert(
      prepared.value,
      /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(),
      id,
    );
    persist();
    return { partner };
  }
  Object.assign(current, prepared.value);
  persist();
  return { partner: clone(current) };
}

export type ChannelTenant = {
  id: string;
  name: string;
  createdAt: string;
};

function unsavedTenant(tenant: ChannelTenant): ChannelPartner {
  const date = tenant.createdAt.slice(0, 10);
  return {
    id: tenant.id,
    name: tenant.name,
    customerId: '',
    legalName: '',
    logoUrl: '',
    website: '',
    region: '',
    nationwide: false,
    territories: [],
    province: '',
    city: '',
    county: '',
    level: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    phone: '',
    notes: '',
    status: null,
    createdAt: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
  };
}

/** Saved channel profiles. Cloud tenants stay in the scope switcher until a profile is saved. */
export function listChannelPartnerRows(tenants: ChannelTenant[]): ChannelPartner[] {
  const stored = listChannelPartners();
  const tenantsById = new Map(tenants.map((item) => [item.id, item]));
  return stored.map((item) => {
    const tenant = tenantsById.get(item.id);
    if (!tenant) return item;
    return {
      ...item,
      name: item.name || tenant.name,
      createdAt: item.createdAt || unsavedTenant(tenant).createdAt,
    };
  });
}

export function resolveChannelPartner(
  id: string,
  tenants: ChannelTenant[],
): ChannelPartner | undefined {
  if (!id) return undefined;
  const stored = getChannelPartner(id);
  if (stored) return stored;
  const tenant = tenants.find((item) => item.id === id);
  return tenant ? unsavedTenant(tenant) : undefined;
}

export function importPartnerInputs(
  inputs: ChannelPartnerInput[],
): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;
  for (const input of inputs) {
    const prepared = preparePartnerInput(input);
    if (!prepared.ok) {
      skipped += 1;
      continue;
    }
    insert(prepared.value);
    created += 1;
  }
  if (created > 0) persist();
  return { created, skipped };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i] ?? '';
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some((item) => item.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((item) => item.trim() !== '')) rows.push(row);
  }
  return rows;
}

function parseStatus(raw: string): ChannelPartnerStatus | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'active' || raw.trim() === '启用') return 'active';
  if (value === 'inactive' || raw.trim() === '停用') return 'inactive';
  return null;
}

export function previewPartnerCsv(text: string): CsvPreview {
  if (!text.trim()) return { error: 'empty', rows: [] };
  const table = parseCsv(text);
  if (table.length === 0) return { error: 'empty', rows: [] };
  const header = table[0] ?? [];
  const columns = header.map((item) => HEADER_ALIAS[item.trim().toLowerCase().replace(/\s+/g, '')]);
  if (!columns.includes('name')) return { error: 'header', rows: [] };
  const takenNames = nameSet();
  const rows: CsvPreviewRow[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const cells = table[index] ?? [];
    if (cells.every((item) => item.trim() === '')) continue;
    const pick = (key: (typeof PARTNER_CSV_HEADERS)[number]) => {
      const at = columns.indexOf(key);
      return at < 0 ? '' : (cells[at] ?? '');
    };
    const status = parseStatus(pick('status'));
    const draft: ChannelPartnerInput = {
      ...emptyPartnerInput(),
      name: pick('name'),
      legalName: pick('legalName'),
      website: pick('website'),
      region: pick('region'),
      province: pick('province'),
      city: pick('city'),
      county: pick('county'),
      level: pick('level'),
      industry: pick('industry'),
      contactName: pick('contactName'),
      contactEmail: pick('contactEmail'),
      phone: pick('phone'),
      notes: pick('notes'),
      status: status ?? 'active',
    };
    const line = index + 1;
    if (!status) {
      rows.push({ line, name: draft.name.trim(), issue: 'status', input: null });
      continue;
    }
    const prepared = preparePartnerInput(draft, { takenNames });
    if (!prepared.ok) {
      rows.push({ line, name: draft.name.trim(), issue: prepared.issue, input: null });
      continue;
    }
    takenNames.add(fold(prepared.value.name));
    rows.push({ line, name: prepared.value.name, issue: null, input: prepared.value });
  }
  if (rows.length === 0) return { error: 'empty', rows: [] };
  return { error: null, rows };
}
