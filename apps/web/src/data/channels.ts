export type ChannelStatus = 'active' | 'frozen' | 'archived';
export type ChannelPlan = 'starter' | 'growth' | 'enterprise';

export type ChannelCredential = {
  id: string;
  name: string;
  createdAt: string;
  lastUsed: string;
  status: 'active' | 'revoked';
};

export type ChannelPartner = {
  id: string;
  name: string;
  code: string;
  status: ChannelStatus;
  customerCount: number;
  plan: ChannelPlan;
  owner: string;
  ownerEmail: string;
  orgId: string;
  orgName?: string;
  brandName: string;
  brandHostNote: string;
  notes: string;
  createdAt: string;
  credentials: ChannelCredential[];
  customerIds: string[];
};

/** Customers channel badge — deferred until Customer.channel_ref lands. */
export function channelByCustomerId(
  _customerId: string,
): ChannelPartner | undefined {
  return undefined;
}
