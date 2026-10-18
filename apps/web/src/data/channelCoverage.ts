import { cityOf, placeName, provinceOf } from '@/data/chinaRegions';
import type { ChannelTerritory } from '@/data/channelPartners';
import { divisionName } from '@/data/divisions';

export function channelCoverageLabel(
  partner: {
    nationwide: boolean;
    territories: ChannelTerritory[];
    province: string;
    city: string;
    county: string;
    region: string;
  },
  locale: 'zh' | 'en',
  nationwideLabel: string,
): string {
  if (partner.nationwide) return nationwideLabel;
  const items = partner.territories.length > 0
    ? partner.territories
    : partner.province
      ? [{ province: partner.province, city: partner.city, county: partner.county }]
      : [];
  const labels = items
    .map((item) => {
      const names = [
        divisionName(item.province) || placeName(provinceOf(item.province), locale),
        divisionName(item.city) || placeName(cityOf(item.province, item.city), locale),
        divisionName(item.county),
      ].filter(Boolean);
      return names.join(' / ');
    })
    .filter(Boolean);
  return labels.join('、') || partner.region;
}
