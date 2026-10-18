import { gatewayOrigin } from './workConnect';
import { buildWorkOpenApiDocument } from '@/data/workOpenApi';
import type { Locale } from '@/prefs/store';

/** @deprecated Console management OpenAPI — not used by Work docs. */
export const OPENAPI_SPEC_URL = '/v1/api/admin/docs/openapi.json';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export type OpenApiParameter = {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
};

export type OpenApiSchema = {
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  $ref?: string;
  example?: unknown;
  description?: string;
  enum?: unknown[];
  /** OpenAPI 3: free-form object / map value schema */
  additionalProperties?: boolean | OpenApiSchema;
  nullable?: boolean;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  title?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
};

export type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    description?: string;
    content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: OpenApiSchema; example?: unknown }>;
    }
  >;
  security?: Array<Record<string, string[]>>;
};

export type OpenApiDocument = {
  openapi?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: Array<{ url: string; description?: string }>;
  paths?: Record<string, Partial<Record<HttpMethod | string, OpenApiOperation>>>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    securitySchemes?: Record<string, unknown>;
  };
  tags?: Array<{ name: string; description?: string }>;
};

export type ApiOperation = {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  group: string;
  parameters: OpenApiParameter[];
  requestBody?: OpenApiOperation['requestBody'];
  responses: NonNullable<OpenApiOperation['responses']>;
  security: OpenApiOperation['security'];
  hasBearerAuth: boolean;
};

const METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
];

export function operationId(method: string, path: string): string {
  const slug = path
    .replace(/^\//, '')
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${method.toLowerCase()}-${slug || 'root'}`;
}

function pathParts(path: string): string[] {
  let parts = path.replace(/^\//, '').split('/').filter(Boolean);
  if (
    parts[0] === 'v1' &&
    parts[1] === 'api' &&
    parts[2] === 'admin' &&
    parts[3] === 'v1' &&
    parts[4] === 'api' &&
    parts[5] === 'admin'
  ) {
    parts = ['v1', 'api', 'admin', ...parts.slice(6)];
  }
  return parts;
}

function groupForPath(path: string, tags?: string[]): string {
  if (tags?.[0]) return tags[0];
  if (path === '/v1/api/admin') return 'platform';
  const parts = pathParts(path);
  if (
    parts[0] === 'v1' &&
    parts[1] === 'api' &&
    (parts[2] === 'admin' || parts[2] === 'org') &&
    parts[3]
  ) {
    return `${parts[2]}/${parts[3]}`;
  }
  return parts[0] ?? 'api';
}

function isLikelyAuthedPath(path: string): boolean {
  if (path.includes('/docs/openapi.json')) return false;
  if (path === '/health' || path === '/live' || path.endsWith('/health') || path.endsWith('/live')) {
    return false;
  }
  if (path.endsWith('/login') || path.includes('/captcha')) return false;
  if (path.startsWith('/v1/api/admin') || path.startsWith('/v1/api/org')) return true;
  // Work Gateway paths — with or without /v1 prefix
  const p = path.startsWith('/v1/') ? path.slice(3) : path;
  if (p.startsWith('/chat')) return true;
  if (p.startsWith('/embeddings')) return true;
  if (p.startsWith('/models')) return true;
  if (p.startsWith('/tools')) return true;
  return false;
}

export function resolveRef(
  schema: OpenApiSchema | undefined,
  doc: OpenApiDocument,
  depth = 0,
): OpenApiSchema | undefined {
  if (!schema || depth > 8) return schema;
  if (!schema.$ref) return schema;
  const name = schema.$ref.replace('#/components/schemas/', '');
  const resolved = doc.components?.schemas?.[name];
  if (!resolved) return schema;
  return resolveRef(resolved, doc, depth + 1);
}

export function parseOpenApiDocument(doc: OpenApiDocument): ApiOperation[] {
  const ops: ApiOperation[] = [];

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    if (!item) continue;
    for (const method of METHODS) {
      const op = item[method] as OpenApiOperation | undefined;
      if (!op) continue;
      const id = op.operationId
        ? op.operationId.replace(/[^a-zA-Z0-9_-]/g, '-')
        : operationId(method, path);
      const summary = op.summary?.trim() ?? '';
      ops.push({
        id,
        method,
        path,
        summary,
        description: op.description?.trim() ?? '',
        group: groupForPath(path, op.tags),
        parameters: op.parameters ?? [],
        requestBody: op.requestBody,
        responses: op.responses ?? {},
        security: op.security,
        hasBearerAuth:
          op.security?.some((scheme) =>
            Object.prototype.hasOwnProperty.call(scheme, 'bearerAuth'),
          ) || isLikelyAuthedPath(path),
      });
    }
  }

  ops.sort((a, b) => {
    const g = a.group.localeCompare(b.group);
    if (g !== 0) return g;
    return a.path.localeCompare(b.path) || a.method.localeCompare(b.method);
  });

  // Ensure unique ids
  const seen = new Map<string, number>();
  for (const op of ops) {
    const n = seen.get(op.id) ?? 0;
    seen.set(op.id, n + 1);
    if (n > 0) op.id = `${op.id}-${n + 1}`;
  }

  return ops;
}

/** Generated catalog of every a3s-api HTTP route. */
export const PLATFORM_OPENAPI_URL = '/v1/api/admin/docs/openapi.json';

export async function fetchPlatformOpenApiDocument(): Promise<OpenApiDocument> {
  const response = await fetch(PLATFORM_OPENAPI_URL);
  if (!response.ok) {
    throw new Error(`OpenAPI HTTP ${response.status}`);
  }
  return unwrapOpenApiDocument(await response.json());
}

/** a3s-api may wrap the document in the JSON envelope until the raw skip matches this path. */
export function unwrapOpenApiDocument(payload: unknown): OpenApiDocument {
  if (!payload || typeof payload !== 'object') {
    throw new Error('OpenAPI 文档格式无法识别');
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.openapi === 'string' || record.paths) {
    return record as OpenApiDocument;
  }
  const data = record.data;
  if (data && typeof data === 'object') {
    const inner = data as Record<string, unknown>;
    if (typeof inner.openapi === 'string' || inner.paths) {
      return inner as OpenApiDocument;
    }
  }
  throw new Error('OpenAPI 文档格式无法识别');
}

export async function fetchOpenApiDocument(
  locale: Locale = 'zh',
): Promise<OpenApiDocument> {
  // Work-facing Gateway contract only — never the a3s-api management OpenAPI.
  const doc = buildWorkOpenApiDocument(locale);
  if (!doc.servers?.length) {
    doc.servers = [{ url: gatewayOrigin(), description: 'Gateway' }];
  }
  return doc;
}

/** Control-plane contract. Same bytes as `GET /api/v1/openapi.json`. */
export const CLOUD_OPENAPI_SPEC_URL =
  import.meta.env.PUBLIC_A3S_CLOUD_OPENAPI_URL ?? '/cloud-openapi/openapi.json';

export const CLOUD_API_ORIGIN = (
  import.meta.env.PUBLIC_A3S_CLOUD_API_ORIGIN ?? 'http://127.0.0.1:18080'
).replace(/\/$/, '');

/**
 * Browser Console → Cloud.
 * Default `/cloud-api` (rsbuild proxy → :18080/api/v1) so fetch is same-origin;
 * Cloud has no CORS. Set PUBLIC_A3S_CLOUD_API_ORIGIN to call Cloud directly.
 */
export const CLOUD_API_BASE = import.meta.env.PUBLIC_A3S_CLOUD_API_ORIGIN
  ? `${CLOUD_API_ORIGIN}/api/v1`
  : '/cloud-api';

export async function fetchCloudOpenApiDocument(): Promise<OpenApiDocument> {
  const response = await fetch(CLOUD_OPENAPI_SPEC_URL);
  if (!response.ok) {
    throw new Error(`Cloud OpenAPI HTTP ${response.status}`);
  }
  return (await response.json()) as OpenApiDocument;
}

export function groupOperations(
  ops: ApiOperation[],
): Array<{ group: string; items: ApiOperation[] }> {
  const map = new Map<string, ApiOperation[]>();
  for (const op of ops) {
    const list = map.get(op.group) ?? [];
    list.push(op);
    map.set(op.group, list);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

export function schemaTypeLabel(
  schema: OpenApiSchema | undefined,
  doc: OpenApiDocument,
): string {
  const resolved = resolveRef(schema, doc);
  if (!resolved) return 'any';
  if (resolved.$ref) {
    return resolved.$ref.replace('#/components/schemas/', '');
  }
  if (resolved.type === 'array') {
    const item = schemaTypeLabel(resolved.items, doc);
    return `${item}[]`;
  }
  if (resolved.enum?.length) return 'enum';
  return resolved.format ? `${resolved.type ?? 'object'}(${resolved.format})` : (resolved.type ?? 'object');
}

export function exampleFromSchema(
  schema: OpenApiSchema | undefined,
  doc: OpenApiDocument,
  depth = 0,
): unknown {
  const resolved = resolveRef(schema, doc);
  if (!resolved || depth > 6) return null;
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.enum?.length) return resolved.enum[0];
  switch (resolved.type) {
    case 'string':
      return resolved.format === 'uuid'
        ? '3fa85f64-5717-4562-b3fc-2c963f66afa6'
        : resolved.format === 'date-time'
          ? '2026-09-18T06:42:00.123Z'
          : '<string>';
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'array':
      return [exampleFromSchema(resolved.items, doc, depth + 1)];
    case 'object':
    default: {
      if (!resolved.properties) return {};
      const out: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(resolved.properties)) {
        out[key] = exampleFromSchema(prop, doc, depth + 1);
      }
      return out;
    }
  }
}
