import { apiRequest as request } from '@/lib/apiClient';
import type {
  ChannelPartner,
  ChannelPlan,
  ChannelStatus,
} from '@/data/channels';

export type OemPartnerDto = {
  id: string;
  name: string;
  code: string;
  status: string;
  plan: string;
  owner: string;
  owner_email: string;
  org_id: string;
  org_name: string;
  brand_name: string;
  brand_host_note: string;
  notes: string;
  created_at_epoch: number;
  customer_count: number;
};

export type CreateOemPartnerInput = {
  name: string;
  code: string;
  notes?: string;
  owner_name?: string;
  owner_email: string;
  brand_name?: string;
  brand_host_note?: string;
  plan?: ChannelPlan;
  org_mode: 'new' | 'bind';
  org_id?: string;
};

function asStatus(raw: string): ChannelStatus {
  if (raw === 'frozen' || raw === 'archived' || raw === 'active') return raw;
  return 'active';
}

function asPlan(raw: string): ChannelPlan {
  if (raw === 'growth' || raw === 'enterprise' || raw === 'starter') return raw;
  return 'starter';
}

export function toChannelPartner(dto: OemPartnerDto): ChannelPartner {
  return {
    id: dto.id,
    name: dto.name,
    code: dto.code,
    status: asStatus(dto.status),
    customerCount: dto.customer_count ?? 0,
    plan: asPlan(dto.plan),
    owner: dto.owner || '—',
    ownerEmail: dto.owner_email,
    orgId: dto.org_id,
    orgName: dto.org_name,
    brandName: dto.brand_name,
    brandHostNote: dto.brand_host_note,
    notes: dto.notes,
    createdAt: new Date(dto.created_at_epoch * 1000).toISOString().slice(0, 10),
    credentials: [],
    customerIds: [],
  };
}

export function listOemPartners() {
  return request<OemPartnerDto[]>('/oem/partners').then((items) =>
    items.map(toChannelPartner),
  );
}

export function listBoundOemOrgIds() {
  return request<string[]>('/oem/partners/bound-org-ids');
}

export function getOemPartner(id: string) {
  return request<OemPartnerDto>(`/oem/partners/${id}`).then(toChannelPartner);
}

export function createOemPartner(input: CreateOemPartnerInput) {
  return request<OemPartnerDto>('/oem/partners', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(toChannelPartner);
}

export function updateOemBrand(
  id: string,
  input: { brand_name: string; brand_host_note?: string },
) {
  return request<OemPartnerDto>(`/oem/partners/${id}/brand`, {
    method: 'PUT',
    body: JSON.stringify(input),
  }).then(toChannelPartner);
}

export function freezeOemPartner(id: string) {
  return request<OemPartnerDto>(`/oem/partners/${id}/frozen`, {
    method: 'PUT',
  }).then(toChannelPartner);
}

export function unfreezeOemPartner(id: string) {
  return request<OemPartnerDto>(`/oem/partners/${id}/frozen`, {
    method: 'DELETE',
  }).then(toChannelPartner);
}

export function archiveOemPartner(id: string) {
  return request<OemPartnerDto>(`/oem/partners/${id}/archived`, {
    method: 'PUT',
  }).then(toChannelPartner);
}
