import { bumpEntitlementCompile } from './entitlementCompile';

export type ListingKind = 'model' | 'tool' | 'api' | 'feed';
export type ProviderHealth = 'healthy' | 'degraded' | 'down';
export type PricingMode = 'per_call' | 'per_mtoken' | 'included';

export type MarketProvider = {
  id: string;
  name: string;
  adapter: string;
  health: ProviderHealth;
  trust: 'trusted' | 'untrusted';
  listingCount: number;
};

export type MarketListing = {
  id: string;
  sku: string;
  name: string;
  kind: ListingKind;
  providerId: string;
  summary: string;
  priceLabel: string;
  pricingMode: PricingMode;
  health: ProviderHealth;
  upstream: string;
  unitPriceUsd: number;
  /** English buyer copy. Chinese stays on name / summary. */
  en?: { name: string; summary: string };
};

/** Mutable entitlement set. No upstream SKUs are shipped. */
const entitledSku = new Set<string>();

export const marketProviders: MarketProvider[] = [];

export const marketListings: MarketListing[] = [];

export function listingText(
  listing: MarketListing,
  locale: 'zh' | 'en',
  field: 'name' | 'summary',
): string {
  if (locale === 'en' && listing.en?.[field]) return listing.en[field];
  return listing[field];
}

export function providerById(id: string): MarketProvider | undefined {
  return marketProviders.find((p) => p.id === id);
}

export function listingById(id: string): MarketListing | undefined {
  return marketListings.find((l) => l.id === id);
}

export function listingBySku(sku: string): MarketListing | undefined {
  return marketListings.find((l) => l.sku === sku);
}

export function isListingEntitled(sku: string): boolean {
  return entitledSku.has(sku);
}

export function entitleListing(sku: string): void {
  entitledSku.add(sku);
  bumpEntitlementCompile();
}

export function revokeListing(sku: string): void {
  entitledSku.delete(sku);
  bumpEntitlementCompile();
}

export function entitledListings(): MarketListing[] {
  return marketListings.filter((l) => entitledSku.has(l.sku));
}
