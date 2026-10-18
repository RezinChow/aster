import type { ChannelPartnerInput } from '@/data/channelPartners';
import type { Customer } from '@/lib/identityApi';

/** Channel contact defaults to the organization creator. */
export function fieldsFromOrganization(
  customer: Customer,
): Pick<
  ChannelPartnerInput,
  'customerId' | 'name' | 'industry' | 'logoUrl' | 'phone' | 'contactName' | 'contactEmail'
> {
  const phone = customer.owner_phone ?? customer.phone ?? '';
  return {
    customerId: customer.id,
    name: customer.name,
    industry: customer.industry,
    logoUrl: customer.logo,
    phone,
    contactName: customer.owner_name.trim() || phone,
    contactEmail: '',
  };
}
