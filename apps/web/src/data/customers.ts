/**
 * Ops customer directory.
 * Seeded from the admin customer records. Channel is not on the record.
 * Creates and edits stay in this session.
 * Balance and lifetime spend stay null until a ledger provides them.
 */

import {
  adminCustomers,
  type AdminCustomer,
  type CustomerKind,
  type CustomerPlan,
  type CustomerStatus,
  type CustomerVerification,
} from '@/data/admin';

export type CustomerIssue = 'name' | 'seats' | 'website' | 'logo' | 'kind' | 'verification';

export type CustomerInput = {
  name: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  seatsUsed: number;
  seatsTotal: number;
  /** Empty means no owner was recorded. */
  owner: string;
  kind: CustomerKind;
  logoUrl: string;
  legalName: string;
  website: string;
  region: string;
  industry: string;
  verification: CustomerVerification;
  verificationRef: string;
};

const customers: AdminCustomer[] = adminCustomers.map((item) => ({
  ...item,
  seats: { ...item.seats },
}));

function clone(item: AdminCustomer): AdminCustomer {
  return { ...item, seats: { ...item.seats } };
}

function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProto);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeLogo(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  if (value.startsWith('data:image/')) return value.length <= 400_000 ? value : null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function prepareCustomer(
  input: CustomerInput,
): { ok: true; value: CustomerInput } | { ok: false; issue: CustomerIssue } {
  const name = input.name.trim();
  if (!name) return { ok: false, issue: 'name' };
  if (input.kind !== 'organization' && input.kind !== 'individual') {
    return { ok: false, issue: 'kind' };
  }
  if (
    input.verification !== 'unverified' &&
    input.verification !== 'pending' &&
    input.verification !== 'verified' &&
    input.verification !== 'rejected'
  ) {
    return { ok: false, issue: 'verification' };
  }
  if (
    !Number.isInteger(input.seatsUsed) ||
    !Number.isInteger(input.seatsTotal) ||
    input.seatsUsed < 0 ||
    input.seatsTotal < 0 ||
    input.seatsUsed > input.seatsTotal
  ) {
    return { ok: false, issue: 'seats' };
  }
  const website = normalizeWebsite(input.website);
  if (website == null) return { ok: false, issue: 'website' };
  const logoUrl = normalizeLogo(input.logoUrl);
  if (logoUrl == null) return { ok: false, issue: 'logo' };
  return {
    ok: true,
    value: {
      ...input,
      name,
      owner: input.owner.trim(),
      logoUrl,
      legalName: input.legalName.trim(),
      website,
      region: input.region.trim(),
      industry: input.kind === 'individual' ? '' : input.industry.trim(),
      verificationRef: input.verificationRef.trim(),
    },
  };
}

export function listCustomers(): AdminCustomer[] {
  return customers.map(clone);
}

export function createCustomer(
  input: CustomerInput,
): { customer?: AdminCustomer; issue?: CustomerIssue } {
  const prepared = prepareCustomer(input);
  if (!prepared.ok) return { issue: prepared.issue };
  let id = `cus_${Math.random().toString(36).slice(2, 8)}`;
  while (customers.some((item) => item.id === id)) {
    id = `cus_${Math.random().toString(36).slice(2, 8)}`;
  }
  const value = prepared.value;
  const created: AdminCustomer = {
    id,
    name: value.name,
    plan: value.plan,
    status: value.status,
    seats: { used: value.seatsUsed, total: value.seatsTotal },
    owner: value.owner || '—',
    createdAt: new Date().toISOString().slice(0, 10),
    kind: value.kind,
    logoUrl: value.logoUrl,
    legalName: value.legalName,
    website: value.website,
    region: value.region,
    industry: value.industry,
    verification: value.verification,
    verificationRef: value.verificationRef,
    balance: null,
    spendTotal: null,
    currency: null,
  };
  customers.unshift(created);
  return { customer: clone(created) };
}

export function updateCustomer(
  id: string,
  input: CustomerInput,
): { customer?: AdminCustomer; issue?: CustomerIssue } {
  const item = customers.find((row) => row.id === id);
  if (!item) return { issue: 'name' };
  const prepared = prepareCustomer(input);
  if (!prepared.ok) return { issue: prepared.issue };
  const value = prepared.value;
  item.name = value.name;
  item.plan = value.plan;
  item.status = value.status;
  item.seats = { used: value.seatsUsed, total: value.seatsTotal };
  item.owner = value.owner || '—';
  item.kind = value.kind;
  item.logoUrl = value.logoUrl;
  item.legalName = value.legalName;
  item.website = value.website;
  item.region = value.region;
  item.industry = value.industry;
  item.verification = value.verification;
  item.verificationRef = value.verificationRef;
  return { customer: clone(item) };
}
