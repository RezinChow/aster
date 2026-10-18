/** Same default as identity/config/models clients — proxied to a3s-api 管理后台 plane. */
export const API_BASE = (
  import.meta.env.PUBLIC_A3S_API_BASE ?? '/v1/api/admin'
).replace(/\/$/, '');

/** 用户中心（前台 Member plane）API prefix — same a3s-api host. */
export const ORG_API_BASE = '/v1/api/org';

/** OpenAPI 3 document served by a3s-api. */
export const OPENAPI_SPEC_URL = `${API_BASE}/docs/openapi.json`;

/** In-app Mintlify-style API reference (not Scalar/Swagger). */
export const API_DOCS_PATH = '/docs';
