/**
 * Unified JSON envelope unwrap for Console clients.
 * - a3s-api: `code === 0` on success
 * - A3S Cloud: `code` is the HTTP status (2xx) on success
 */
export type ApiErrorDetail = {
  field: string;
  message: string;
};

export type ApiEnvelope<T> = {
  success?: boolean;
  code: number;
  message: string;
  data: T;
  errors?: ApiErrorDetail[] | null;
  request_id: string;
  timestamp: string;
};

export class ApiRequestError extends Error {
  readonly code: number;
  readonly requestId?: string;
  readonly errors?: ApiErrorDetail[] | null;

  constructor(
    message: string,
    opts: { code: number; requestId?: string; errors?: ApiErrorDetail[] | null },
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = opts.code;
    this.requestId = opts.requestId;
    this.errors = opts.errors;
  }
}

export function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'code' in v && 'message' in v && 'data' in v;
}

/** a3s-api uses 0; Cloud uses HTTP 2xx as the business code. */
export function isApiSuccessCode(code: number): boolean {
  return code === 0 || (code >= 200 && code < 300);
}

/** Unwrap success data or throw {@link ApiRequestError}. */
export function unwrapApiEnvelope<T>(payload: unknown, httpStatus: number): T {
  if (isApiEnvelope(payload)) {
    if (!isApiSuccessCode(payload.code) || payload.success === false) {
      throw new ApiRequestError(
        typeof payload.message === 'string' && payload.message
          ? payload.message
          : `API error ${payload.code}`,
        {
          code: payload.code,
          requestId:
            typeof payload.request_id === 'string' ? payload.request_id : undefined,
          errors: payload.errors,
        },
      );
    }
    return payload.data as T;
  }
  if (httpStatus >= 400) {
    throw new ApiRequestError(`HTTP ${httpStatus}`, { code: httpStatus });
  }
  return payload as T;
}
