import { tenantInfoFromRecord, type TenantInfo } from './tenantInfo';

export type TenantRecord = {
  slug: string;
  info: TenantInfo | null;
  error: string | null;
};

export type TenantIndex = {
  launch: string;
  tenant: TenantRecord | null;
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(String(response.status));
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'string' && error.trim()) return error;
  }
  return String(status);
}

export async function fetchTenantIndex(): Promise<TenantIndex> {
  const response = await fetch('/__tenant', { cache: 'no-store' });
  const body = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid tenant index');
  }
  const record = body as { launch?: unknown; tenant?: unknown };
  const launch = typeof record.launch === 'string' ? record.launch : '';
  const entry = record.tenant && typeof record.tenant === 'object' ? (record.tenant as Record<string, unknown>) : null;
  if (!entry) return { launch, tenant: null };
  const slug = typeof entry.slug === 'string' ? entry.slug : launch;
  let info: TenantInfo | null = null;
  let error = typeof entry.error === 'string' ? entry.error : null;
  if (entry.info) {
    try {
      info = tenantInfoFromRecord(entry.info);
    } catch (err) {
      info = null;
      error = err instanceof Error ? err.message : String(err);
    }
  }
  return { launch, tenant: { slug, info, error } };
}

export async function saveTenantRecord(
  info: TenantInfo,
  logos?: { light?: string | null; dark?: string | null },
): Promise<TenantInfo> {
  const response = await fetch(`/__tenant/${info.slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      info,
      logos: {
        ...(logos?.light ? { light: logos.light } : {}),
        ...(logos?.dark ? { dark: logos.dark } : {}),
      },
    }),
  });
  const body = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  const saved = body && typeof body === 'object' ? (body as { info?: unknown }).info : null;
  return tenantInfoFromRecord(saved);
}

export async function repairTenantRecord(slug: string): Promise<TenantInfo> {
  const response = await fetch(`/__tenant/${slug}/repair`, { method: 'POST' });
  const body = await readJson(response);
  if (!response.ok) throw new Error(errorMessage(body, response.status));
  const info = body && typeof body === 'object' ? (body as { info?: unknown }).info : null;
  return tenantInfoFromRecord(info);
}
