import { apiRequest as request } from '@/lib/apiClient';

export type ConfigEntry = {
  namespace: string;
  key: string;
  value: unknown;
  revision: number;
  updated_at_epoch: number;
  updated_by: string;
};

export type ConfigStatus = {
  revision: number;
  publisher_id: string;
  subject: string;
};

export type IntegerUnit = 'megabytes' | 'seconds' | 'hours' | 'items';

/** Value shape declared by the config service for each runtime builtin. */
export type ValueSchema =
  | { type: 'boolean' }
  | { type: 'integer'; min: number; max: number; unit?: IntegerUnit }
  | {
      type: 'text';
      max_len: number;
      multiline?: boolean;
      placeholder?: string;
      pattern?: ValuePattern;
    }
  | { type: 'url'; placeholder?: string }
  | { type: 'secret'; max_len: number; pattern?: ValuePattern }
  | { type: 'enum'; options: { value: string; label: string }[] }
  | { type: 'image_data_url'; max_bytes: number }
  | { type: 'object'; fields: FieldSchema[] };

/** JavaScript-compatible regular expression checked on non-empty text, with its message. */
export type ValuePattern = { regex: string; message: string };

export type FieldSchema = {
  name: string;
  label: string;
  description?: string;
  /** Shown only while this sibling boolean field is true. */
  visible_when?: string;
  /** Must be non-empty while this sibling boolean field is true. */
  required_when?: string;
  schema: ValueSchema;
};

export type CatalogItem = {
  key: string;
  label: string;
  description: string;
  value: unknown;
  sensitive: boolean;
  namespace?: string;
  revision?: number;
  updated_by?: string;
  configured?: boolean;
  schema?: ValueSchema;
};

export type CatalogGroup = {
  id: string;
  label: string;
  items: CatalogItem[];
};

export function getConfigStatus() {
  return request<ConfigStatus>('/configs/status');
}

export type BootstrapItem = {
  /** Primary environment variable. */
  key: string;
  label: string;
  description: string;
  /** Effective value; secrets arrive masked, `null` when unset and optional. */
  value: unknown;
  sensitive: boolean;
  /** Set in the environment (false: the built-in default applies). */
  configured: boolean;
  /** Fallback variables read when the primary one is unset. */
  aliases?: string[];
  required?: boolean;
};

export type BootstrapGroup = {
  id: string;
  label: string;
  items: BootstrapItem[];
};

export type BootstrapService = {
  id: string;
  label: string;
  groups: BootstrapGroup[];
  /** Set when the process could not be asked. */
  error?: string;
};

export function getBootstrapCatalog() {
  return request<BootstrapService[]>('/configs/bootstrap');
}

export function getRuntimeBuiltins() {
  return request<CatalogGroup[]>('/configs/builtins');
}

/** Third-party sign-in providers (授权登录); secrets arrive masked. */
export function getLoginBuiltins() {
  return request<CatalogGroup[]>('/configs/builtins?surface=login');
}

export function listConfigs(namespace: string) {
  return request<ConfigEntry[]>(
    `/configs/${encodeURIComponent(namespace)}`,
  );
}

export function getConfig(namespace: string, key: string) {
  return request<ConfigEntry>(
    `/configs/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
  );
}

export function putConfig(
  namespace: string,
  key: string,
  input: { value: unknown; updated_by?: string },
) {
  return request<ConfigEntry>(
    `/configs/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function deleteConfig(namespace: string, key: string) {
  return request<{ ok: boolean }>(
    `/configs/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    { method: 'DELETE' },
  );
}
