import { apiRequest } from '@/lib/apiClient';

export type PublicationKind = 'terms' | 'privacy' | 'copyright' | 'support';
export type PublicationStatus = 'draft' | 'published';

export type Publication = {
  id: string;
  kind: PublicationKind;
  slug: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  summaryZh: string;
  summaryEn: string;
  coverUrl: string;
  author: string;
  contactEmail: string;
  contactHours: string;
  contactTicketUrl: string;
  status: PublicationStatus;
  effectiveOn: string;
  publishedAt: string | null;
  path: string;
};

export type PublicationWrite = {
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  effectiveOn: string;
  contactEmail: string;
  contactHours: string;
  contactTicketUrl: string;
};

export function listPublications() {
  return apiRequest<Publication[]>('/publications');
}

export function savePublication(kind: PublicationKind, body: PublicationWrite) {
  return apiRequest<Publication>(`/publications/${kind}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function publishPublication(kind: PublicationKind) {
  return apiRequest<Publication>(`/publications/${kind}/publication`, {
    method: 'PUT',
  });
}

export function withdrawPublication(kind: PublicationKind) {
  return apiRequest<Publication>(`/publications/${kind}/publication`, {
    method: 'DELETE',
  });
}

export function publicationErrorKey(message: string): string | null {
  if (message.includes('effective date')) return 'settings.notices.error.effective';
  if (message.includes('both locales')) return 'settings.notices.error.body';
  if (message.includes('support details')) return 'settings.notices.error.support';
  return null;
}
