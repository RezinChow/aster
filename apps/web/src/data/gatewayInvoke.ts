/**
 * Work → Gateway data-plane invoke.
 * Path: POST /v1/api/services/{kind}/invoke/{sku}
 */

import {
  isListingEntitled,
  listingBySku,
  type ListingKind,
} from '@/data/marketplace';
import {
  isA3sMonitorSku,
  runA3sMonitorFunction,
  type MonitorInvokeError,
  type MonitorInvokeResult,
} from '@/data/a3sMonitor';
import { recordUsage, type UsageKind } from '@/data/usageLedger';
import {
  gatewayAbsoluteUrl,
  LOCAL_GATEWAY_DEV_KEY,
  probeGatewayHealth,
} from '@/lib/workConnect';
import { isApiEnvelope } from '@/lib/apiEnvelope';
import { gatewayRelativePathForSku } from '@/data/servicePath';

function toUsageKind(kind: ListingKind): UsageKind {
  if (kind === 'model' || kind === 'tool' || kind === 'api' || kind === 'feed') {
    return kind;
  }
  return 'api';
}

export { gatewayRelativePathForSku };

export type GatewayInvokeRequest = {
  sku: string;
  input?: Record<string, unknown>;
  /** Capability Key (full secret or prefix for attribution). */
  credentialPrefix?: string;
  /** Full Bearer secret for live Gateway auth. */
  capabilityKey?: string;
  orgId?: string;
  projectId?: string;
  envId?: string;
  /** Force in-process preview even if Gateway is up. */
  forcePreview?: boolean;
};

export type GatewayInvokeResponse =
  | {
      ok: true;
      path: string;
      result: MonitorInvokeResult | Record<string, unknown>;
      usageId: string;
      requestId: string;
      /** True when served by in-process Console adapter, not Gateway. */
      preview?: boolean;
    }
  | {
      ok: false;
      httpStatus: number;
      code: string;
      message: string;
      requestId: string;
      usageId?: string;
      preview?: boolean;
    };

function newRequestId(): string {
  return crypto.randomUUID?.() ?? `req_${Date.now().toString(36)}`;
}

function resolveCapabilityKey(req: GatewayInvokeRequest): string {
  const raw = (req.capabilityKey ?? req.credentialPrefix ?? '').trim();
  if (raw.startsWith('a3s_sk_') && raw.length > 14) return raw;
  return LOCAL_GATEWAY_DEV_KEY;
}

async function invokeLiveGateway(
  req: GatewayInvokeRequest,
  requestId: string,
  path: string,
): Promise<GatewayInvokeResponse | null> {
  const originReachable = await probeGatewayHealth();
  if (!originReachable) return null;

  const key = resolveCapabilityKey(req);
  const listing = listingBySku(req.sku.trim());
  const relative = listing
    ? gatewayRelativePathForSku(req.sku.trim(), listing.kind)
    : `/tools/${encodeURIComponent(req.sku.trim())}/invoke`;
  const url = gatewayAbsoluteUrl(relative);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'x-request-id': requestId,
      },
      body: JSON.stringify(
        listing?.kind === 'model'
          ? req.input ?? {}
          : { input: req.input ?? {} },
      ),
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = { raw: text.slice(0, 2000) };
      }
    }

    if (isApiEnvelope(payload)) {
      const extra = payload as unknown as { error_code?: string };
      const codeStr =
        typeof extra.error_code === 'string'
          ? extra.error_code
          : res.ok
            ? 'ok'
            : `http.${res.status}`;
      if (!res.ok || payload.success === false || payload.code !== 0) {
        return {
          ok: false,
          httpStatus: res.status || 503,
          code: codeStr,
          message:
            typeof payload.message === 'string'
              ? payload.message
              : `Gateway error ${res.status}`,
          requestId:
            typeof payload.request_id === 'string'
              ? payload.request_id
              : requestId,
          preview: false,
        };
      }
      return {
        ok: true,
        path,
        result: (payload.data ?? {}) as Record<string, unknown>,
        usageId: `gw_${requestId}`,
        requestId:
          typeof payload.request_id === 'string'
            ? payload.request_id
            : requestId,
        preview: false,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        httpStatus: res.status,
        code: `http.${res.status}`,
        message: text.slice(0, 200) || res.statusText,
        requestId,
        preview: false,
      };
    }
    return {
      ok: true,
      path,
      result: (payload ?? {}) as Record<string, unknown>,
      usageId: `gw_${requestId}`,
      requestId,
      preview: false,
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 503,
      code: 'route.not_ready',
      message:
        err instanceof Error
          ? `Gateway unreachable: ${err.message}`
          : 'Gateway unreachable',
      requestId,
      preview: false,
    };
  }
}

/**
 * Invoke listing via live Gateway when reachable; otherwise preview adapter.
 */
export async function gatewayInvokeListing(
  req: GatewayInvokeRequest,
): Promise<GatewayInvokeResponse> {
  const requestId = newRequestId();
  const sku = req.sku.trim();
  const listing = listingBySku(sku);
  const path = gatewayAbsoluteUrl(
    listing
      ? gatewayRelativePathForSku(sku, listing.kind)
      : `/tools/${encodeURIComponent(sku)}/invoke`,
  );
  const cred = req.credentialPrefix ?? 'a3s_sk_work';
  const orgId = req.orgId ?? 'org_demo';
  const projectId = req.projectId ?? 'proj_demo';
  const envId = req.envId ?? 'env_demo';

  if (!listing) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'request.invalid',
      message: `unknown listing SKU: ${sku}`,
      requestId,
    };
  }

  if (!isListingEntitled(sku)) {
    const usage = recordUsage({
      orgId,
      projectId,
      envId,
      credentialPrefix: cred.slice(0, 14),
      sku,
      listingKind: toUsageKind(listing.kind),
      units: 0,
      unitPriceUsd: listing.unitPriceUsd,
      route: path,
      requestId,
      status: 'denied',
      detail: 'entitlement.denied',
    });
    return {
      ok: false,
      httpStatus: 403,
      code: 'entitlement.denied',
      message: 'Listing not entitled for this Env / Capability Key',
      requestId,
      usageId: usage.id,
    };
  }

  if (!req.forcePreview) {
    const live = await invokeLiveGateway(req, requestId, path);
    if (live) {
      if (live.ok) {
        const usage = recordUsage({
          orgId,
          projectId,
          envId,
          credentialPrefix: resolveCapabilityKey(req).slice(0, 14),
          sku,
          listingKind: toUsageKind(listing.kind),
          units: 1,
          unitPriceUsd: listing.unitPriceUsd,
          route: path,
          requestId: live.requestId,
          status: 'ok',
          detail: 'gateway:live',
        });
        return { ...live, usageId: usage.id };
      }
      // Live Gateway responded (including 503) — do not silently green via preview.
      if (live.code !== 'route.not_ready') {
        return live;
      }
      // Unreachable → fall through to explicit preview.
    }
  }

  if (!isA3sMonitorSku(sku)) {
    return {
      ok: false,
      httpStatus: 503,
      code: 'route.not_ready',
      message: `Gateway /v1 not ready for SKU ${sku}; Function route unpublished (preview only)`,
      requestId,
      preview: true,
    };
  }

  const fn = await runA3sMonitorFunction({
    sku,
    input: req.input,
  });
  if (!fn.ok) {
    const err = fn as MonitorInvokeError;
    const usage = recordUsage({
      orgId,
      projectId,
      envId,
      credentialPrefix: cred.slice(0, 14),
      sku,
      listingKind: toUsageKind(listing.kind),
      units: 0,
      unitPriceUsd: listing.unitPriceUsd,
      route: path,
      requestId,
      status: 'error',
      detail: err.code,
    });
    const httpStatus =
      err.code === 'request.invalid'
        ? 400
        : err.code === 'provider.credential_missing'
          ? 503
          : err.code === 'auth.invalid_key'
            ? 401
            : err.code === 'upstream.exhausted'
              ? 429
              : 503;
    return {
      ok: false,
      httpStatus,
      code: err.code,
      message: `${err.message} (preview)`,
      requestId,
      usageId: usage.id,
      preview: true,
    };
  }

  const result = fn as MonitorInvokeResult;
  const usage = recordUsage({
    orgId,
    projectId,
    envId,
    credentialPrefix: cred.slice(0, 14),
    sku,
    listingKind: toUsageKind(listing.kind),
    units: result.billableUnits,
    unitPriceUsd: listing.unitPriceUsd,
    route: path,
    requestId,
    status: 'ok',
    detail: `preview:${result.mode}:${result.upstream}`,
  });

  return {
    ok: true,
    path,
    result,
    usageId: usage.id,
    requestId,
    preview: true,
  };
}
