import { apiRequest as request } from '@/lib/apiClient';

const BASE = '/model-service';

export type SupplierKind = 'self_hosted' | 'vendor' | 'relay';
export type SupplierProtocol = 'openai' | 'anthropic';
export type ModelState = 'draft' | 'published' | 'suspended';
export type ModelCapability =
  | 'reasoning'
  | 'tool_call'
  | 'vision'
  | 'web_search'
  | 'embedding'
  | 'rerank'
  | 'image_generation';

export const SUPPLIER_KINDS: readonly SupplierKind[] = ['vendor', 'relay', 'self_hosted'];
export const MODEL_CAPABILITIES: readonly ModelCapability[] = [
  'reasoning',
  'tool_call',
  'vision',
  'web_search',
  'embedding',
  'rerank',
  'image_generation',
];

export type Supplier = {
  id: string;
  name: string;
  kind: SupplierKind;
  protocol: SupplierProtocol;
  baseUrl: string;
  hasKey: boolean;
  keyHint?: string | null;
  dataRegion?: string | null;
  retainsData?: boolean | null;
  originVendors: string[];
  /** Model ids configured for this supplier. Inference picks from this list. */
  models: string[];
  enabled: boolean;
  /** Enabled and holding a key (self-hosted needs none). */
  routable: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SupplierWrite = {
  name: string;
  kind: SupplierKind;
  protocol: SupplierProtocol;
  baseUrl: string;
  dataRegion?: string;
  retainsData?: boolean;
  originVendors: string[];
  /** Model ids this supplier serves. */
  models: string[];
  enabled?: boolean;
  /** Omit to keep the stored key; `''` clears it. */
  apiKey?: string;
};

export type ModelRoute = {
  supplierId: string;
  upstreamModel: string;
  priority: number;
  weight: number;
};

export type ServiceModel = {
  id: string;
  name: string;
  brand?: string | null;
  description: string;
  catalogKey?: string | null;
  capabilities: ModelCapability[];
  contextWindow?: number | null;
  outputLimit?: number | null;
  inputPrice?: number | null;
  cacheReadPrice?: number | null;
  cacheWritePrice?: number | null;
  outputPrice?: number | null;
  /** Billing coefficient. 1 charges the published rate. */
  priceMultiplier: number;
  tags: string[];
  /** Empty means members cannot choose an intensity. */
  reasoningEfforts: string[];
  routes: ModelRoute[];
  state: ModelState;
  position: number;
  /** Kind of the supplier members would reach; null when unavailable. */
  source?: SupplierKind | null;
  unavailableReason?: 'not_published' | 'no_routable_supplier' | null;
  createdAt: number;
  updatedAt: number;
};

export type ServiceModelWrite = {
  id?: string;
  name: string;
  brand?: string;
  description: string;
  catalogKey?: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  outputLimit?: number;
  inputPrice?: number | null;
  cacheReadPrice?: number | null;
  cacheWritePrice?: number | null;
  outputPrice?: number | null;
  priceMultiplier: number;
  tags: string[];
  /** Empty turns the intensity control off. */
  reasoningEfforts: string[];
  routes: ModelRoute[];
  position?: number;
};

export type ModelServiceSettings = { defaultModel?: string | null };

export type GatewayRoute = {
  alias: string;
  targets: (ModelRoute & {
    supplierName: string;
    kind: SupplierKind;
    protocol: SupplierProtocol;
    baseUrl: string;
  })[];
};

const json = (body: unknown) => JSON.stringify(body);
const supplierPath = (id: string) => `${BASE}/suppliers/${encodeURIComponent(id)}`;
const modelPath = (id: string) => `${BASE}/models/${encodeURIComponent(id)}`;

export const listSuppliers = (): Promise<Supplier[]> => request(`${BASE}/suppliers`);

export const createSupplier = (write: SupplierWrite): Promise<Supplier> =>
  request(`${BASE}/suppliers`, { method: 'POST', body: json(write) });

export const updateSupplier = (id: string, write: SupplierWrite): Promise<Supplier> =>
  request(supplierPath(id), { method: 'PUT', body: json(write) });

export const deleteSupplier = (id: string): Promise<{ ok: boolean }> =>
  request(supplierPath(id), { method: 'DELETE' });

/** Tests the connection and lists the upstream model ids. */
export const probeSupplier = (id: string): Promise<{ models: string[] }> =>
  request(`${supplierPath(id)}/probes`, { method: 'POST' });

export const listServiceModels = (): Promise<ServiceModel[]> => request(`${BASE}/models`);

export const createServiceModel = (write: ServiceModelWrite): Promise<ServiceModel> =>
  request(`${BASE}/models`, { method: 'POST', body: json(write) });

export const updateServiceModel = (id: string, write: ServiceModelWrite): Promise<ServiceModel> => {
  const { id: _id, ...rest } = write;
  return request(modelPath(id), { method: 'PUT', body: json(rest) });
};

export const setServiceModelState = (id: string, state: ModelState): Promise<ServiceModel> =>
  request(`${modelPath(id)}/state`, { method: 'PUT', body: json({ state }) });

export const deleteServiceModel = (id: string): Promise<{ ok: boolean }> =>
  request(modelPath(id), { method: 'DELETE' });

export const getModelServiceSettings = (): Promise<ModelServiceSettings> =>
  request(`${BASE}/settings`);

export const updateModelServiceSettings = (
  settings: ModelServiceSettings,
): Promise<ModelServiceSettings> =>
  request(`${BASE}/settings`, { method: 'PUT', body: json(settings) });

export const listGatewayRoutes = (): Promise<GatewayRoute[]> => request(`${BASE}/routes`);
