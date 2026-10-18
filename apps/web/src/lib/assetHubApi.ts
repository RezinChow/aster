import { API_BASE } from '@/lib/apiBase';
import { ApiRequestError, unwrapApiEnvelope } from '@/lib/apiEnvelope';
import { getUserToken } from '@/lib/userSession';

/** One page of a 资产 catalog (`/v1/api/admin/assets/*`). */
export type AssetPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type FacetCount = { value: string; count: number };

export type AssetCategory =
  | 'office'
  | 'creative'
  | 'design'
  | 'code'
  | 'business'
  | 'productivity'
  | 'science'
  | 'education'
  | 'search'
  | 'data'
  | 'other';

export const ASSET_CATEGORIES: AssetCategory[] = [
  'office',
  'creative',
  'design',
  'code',
  'business',
  'productivity',
  'science',
  'education',
  'search',
  'data',
  'other',
];

/** `?a=1&b=x`, skipping blank values. */
export function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export type AssetDownload =
  | { kind: 'file'; blob: Blob; fileName: string }
  | { kind: 'link'; url: string };

function fileNameOf(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

/** Raw (non-envelope) download endpoints: file bytes, or `{ url }` for hub files. */
export async function fetchAssetDownload(path: string, fallbackName: string): Promise<AssetDownload> {
  const token = getUserToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const payload: unknown = await response.json();
    if (!response.ok) unwrapApiEnvelope(payload, response.status);
    const body = (payload as { url?: string; data?: { url?: string } }) ?? {};
    const url = body.url ?? body.data?.url;
    if (url) return { kind: 'link', url };
    throw new ApiRequestError('unexpected download response', { code: response.status });
  }
  if (!response.ok) {
    throw new ApiRequestError(`HTTP ${response.status}`, { code: response.status });
  }
  return { kind: 'file', blob: await response.blob(), fileName: fileNameOf(response, fallbackName) };
}

export function saveDownload(download: AssetDownload) {
  if (download.kind === 'link') {
    window.open(download.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const url = URL.createObjectURL(download.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = download.fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
