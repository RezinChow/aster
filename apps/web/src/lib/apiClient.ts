import { API_BASE } from '@/lib/apiBase';
import { ApiRequestError, unwrapApiEnvelope } from '@/lib/apiEnvelope';
import { tryCloudControl } from '@/lib/cloudControl';
import { clearUserSession, getUserToken } from '@/lib/userSession';

export type ApiRequestInit = RequestInit & {
  /**
   * Attach the console user session. Default true.
   * Login and other anonymous calls pass false.
   */
  auth?: boolean;
};

/**
 * Console calls to a3s-api.
 * Request headers and the JSON envelope are handled here, not in each client.
 */
export async function apiRequest<T>(
  path: string,
  init?: ApiRequestInit,
): Promise<T> {
  const { auth = true, headers: callerHeaders, ...rest } = init ?? {};
  if (auth) {
    const direct = await tryCloudControl<T>(path, { headers: callerHeaders, ...rest });
    if (direct.ok) return direct.data;
  }
  const token = auth ? getUserToken() : null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: applyRequestHeaders(callerHeaders, token, rest.body),
  });
  return readResponse<T>(response, token);
}

function applyRequestHeaders(
  callerHeaders: HeadersInit | undefined,
  token: string | null,
  body?: BodyInit | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    // The browser sets the multipart boundary itself.
    ...(body instanceof FormData ? {} : { 'content-type': 'application/json' }),
    ...asHeaderRecord(callerHeaders),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

async function readResponse<T>(
  response: Response,
  sentToken: string | null,
): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(text || `HTTP ${response.status}`);
    }
  }

  try {
    return unwrapApiEnvelope<T>(payload, response.status);
  } catch (err) {
    if (sentToken && isUnauthorized(err, response.status)) {
      clearUserSession();
      redirectToLogin();
    }
    throw err;
  }
}

function isUnauthorized(err: unknown, httpStatus: number): boolean {
  if (httpStatus === 401) return true;
  return err instanceof ApiRequestError && (err.code === 401 || err.code === 40100);
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/admin/login') return;
  window.location.assign('/admin/login');
}

function asHeaderRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}
