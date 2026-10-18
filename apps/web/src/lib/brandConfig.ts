import { getConfig, putConfig } from '@/lib/configApi';
import { applyBrandPrefs } from '@/prefs/store';

export const CONSOLE_BRAND_NAMESPACE = 'default';
export const CONSOLE_BRAND_KEY = 'console.brand';

export type ConsoleBrandConfig = {
  name: string;
  logo_data_url: string | null;
};

export function parseConsoleBrand(value: unknown): ConsoleBrandConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { name: '', logo_data_url: null };
  }
  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name : '';
  const logo =
    typeof record.logo_data_url === 'string' &&
    record.logo_data_url.startsWith('data:image/')
      ? record.logo_data_url
      : null;
  return { name, logo_data_url: logo };
}

export async function fetchConsoleBrand(): Promise<ConsoleBrandConfig> {
  try {
    const entry = await getConfig(CONSOLE_BRAND_NAMESPACE, CONSOLE_BRAND_KEY);
    return parseConsoleBrand(entry.value);
  } catch {
    return { name: '', logo_data_url: null };
  }
}

export async function saveConsoleBrand(
  brand: ConsoleBrandConfig,
  updatedBy = 'console',
): Promise<ConsoleBrandConfig> {
  const value = {
    name: brand.name.trim(),
    logo_data_url: brand.logo_data_url,
  };
  const entry = await putConfig(CONSOLE_BRAND_NAMESPACE, CONSOLE_BRAND_KEY, {
    value,
    updated_by: updatedBy,
  });
  const parsed = parseConsoleBrand(entry.value);
  applyBrandPrefs(parsed.name, parsed.logo_data_url);
  return parsed;
}

/** Pull brand from config center into local prefs (cache). */
export async function hydrateBrandFromConfig(): Promise<void> {
  const brand = await fetchConsoleBrand();
  applyBrandPrefs(brand.name, brand.logo_data_url);
}
