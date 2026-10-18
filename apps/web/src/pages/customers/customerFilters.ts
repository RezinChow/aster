import type { ChannelPartner, ChannelTerritory } from '@/data/channelPartners';
import type { Customer } from '@/lib/identityApi';

/** Organization customer this channel was created from. */
export function partnersForCustomer(
  customer: Customer,
  partners: ChannelPartner[],
): ChannelPartner[] {
  return partners.filter((partner) => {
    if (partner.customerId) return partner.customerId === customer.id;
    return customer.kind === 'organization' && partner.name === customer.name;
  });
}

function territoryPath(item: ChannelTerritory): string[] {
  return [item.province, item.city, item.county].filter((part) => part.length > 0);
}

/** A selected region matches coverage when either path is nested in the other. */
function pathsOverlap(covered: string[], selected: string[]): boolean {
  const length = Math.min(covered.length, selected.length);
  for (let index = 0; index < length; index += 1) {
    if (covered[index] !== selected[index]) return false;
  }
  return length > 0;
}

export function partnerCoversRegion(partner: ChannelPartner, path: string[]): boolean {
  if (path.length === 0) return true;
  if (partner.nationwide) return true;
  const territories =
    partner.territories.length > 0
      ? partner.territories
      : partner.province
        ? [{ province: partner.province, city: partner.city, county: partner.county }]
        : [];
  return territories.some((item) => pathsOverlap(territoryPath(item), path));
}

export function customerInChannel(
  customer: Customer,
  partners: ChannelPartner[],
  channelId: string,
): boolean {
  if (channelId === 'all') return true;
  return partnersForCustomer(customer, partners).some((partner) => partner.id === channelId);
}

export function customerInRegion(
  customer: Customer,
  partners: ChannelPartner[],
  path: string[],
): boolean {
  if (path.length === 0) return true;
  return partnersForCustomer(customer, partners).some((partner) => partnerCoversRegion(partner, path));
}
