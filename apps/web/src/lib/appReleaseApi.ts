import { API_BASE } from '@/lib/apiBase';
import { apiRequest } from '@/lib/apiClient';
import { unwrapApiEnvelope } from '@/lib/apiEnvelope';
import { getUserToken } from '@/lib/userSession';

export type AppChannel = 'desktop' | 'mobile';
export type AppReleaseStatus = 'draft' | 'published' | 'archived';

export type AppRelease = {
  id: string;
  channel: AppChannel;
  platform: string;
  version: string;
  notes: string;
  file_name: string;
  size_bytes: number;
  status: AppReleaseStatus;
  created_at: string;
  published_at: string | null;
};

export const APP_RELEASE_MAX_BYTES = 512 * 1024 * 1024;

export function listAppReleases(channel: AppChannel) {
  return apiRequest<AppRelease[]>(
    `/app-releases?channel=${encodeURIComponent(channel)}`,
  );
}

export function publishAppRelease(id: string) {
  return apiRequest<AppRelease>(`/app-releases/${encodeURIComponent(id)}/publication`, {
    method: 'PUT',
  });
}

export function withdrawAppRelease(id: string) {
  return apiRequest<AppRelease>(`/app-releases/${encodeURIComponent(id)}/publication`, {
    method: 'DELETE',
  });
}

export function deleteAppRelease(id: string) {
  return apiRequest<{ ok: boolean }>(`/app-releases/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function uploadAppRelease(input: {
  channel: AppChannel;
  platform: string;
  version: string;
  notes: string;
  file: File;
}): Promise<AppRelease> {
  const body = new FormData();
  body.set('channel', input.channel);
  body.set('platform', input.platform);
  body.set('version', input.version);
  body.set('notes', input.notes);
  body.set('file', input.file, input.file.name);
  const token = getUserToken();
  const response = await fetch(`${API_BASE}/app-releases`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return unwrapApiEnvelope<AppRelease>(payload, response.status);
}

export async function downloadAppRelease(row: Pick<AppRelease, 'id' | 'file_name'>): Promise<void> {
  const token = getUserToken();
  const response = await fetch(`${API_BASE}/app-releases/${encodeURIComponent(row.id)}/file`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    unwrapApiEnvelope(payload, response.status);
    throw new Error(`HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = row.file_name;
  link.click();
  URL.revokeObjectURL(url);
}
