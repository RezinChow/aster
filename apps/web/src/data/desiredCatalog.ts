/**
 * Cloud desired internal-service catalog (Wave D1 / G2).
 * Live leases remain Boot etcd; this is expectation state only.
 * Fail closed — never invent a healthy catalog.
 */

import { CLOUD_API_BASE } from '@/lib/openapi';
import { isApiEnvelope, unwrapApiEnvelope } from '@/lib/apiEnvelope';

export type InternalServiceExpectation = {
  service: string;
  instanceId: string;
  host: string;
  port: number;
  desiredReady?: boolean;
};

export type DesiredCatalogProbe =
  | { status: 'ok'; services: InternalServiceExpectation[]; ms: number }
  | { status: 'unwired'; reason: string; ms: number | null }
  | { status: 'error'; reason: string; ms: number };

/** Same mount as Cloud SDK `list_internal_services` (under control-plane HTTP root). */
const CATALOG_PATH = '/platform/internal-services';

export function summarizeDesiredCatalog(
  services: InternalServiceExpectation[],
): string {
  const n = services.length;
  if (n === 0) return 'desired catalog empty';
  const names = services
    .map((s) => s.service)
    .filter(Boolean)
    .slice(0, 4);
  const more = n > names.length ? ` +${n - names.length}` : '';
  return `desired ${n}: ${names.join(', ')}${more}`;
}

/**
 * Read-only probe of Cloud desired catalog.
 * Uses Console Cloud base (`/cloud-api` proxy or direct origin+/api/v1).
 */
export async function probeDesiredInternalServices(): Promise<DesiredCatalogProbe> {
  const started = performance.now();
  const base = CLOUD_API_BASE.replace(/\/$/, '');
  try {
    const response = await fetch(`${base}${CATALOG_PATH}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(2500),
    });
    const ms = Math.round(performance.now() - started);
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        return {
          status: 'error',
          reason: `non-JSON HTTP ${response.status}`,
          ms,
        };
      }
    }
    if (response.status === 404) {
      return { status: 'unwired', reason: 'catalog route missing', ms };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'unwired',
        reason: `catalog auth HTTP ${response.status}`,
        ms,
      };
    }
    if (!response.ok) {
      return {
        status: 'error',
        reason: `catalog HTTP ${response.status}`,
        ms,
      };
    }
    const data = isApiEnvelope(payload)
      ? unwrapApiEnvelope<InternalServiceExpectation[]>(payload, response.status)
      : (payload as InternalServiceExpectation[]);
    if (!Array.isArray(data)) {
      return { status: 'error', reason: 'catalog payload not an array', ms };
    }
    return { status: 'ok', services: data, ms };
  } catch (err) {
    return {
      status: 'error',
      reason: err instanceof Error ? err.message : 'catalog unreachable',
      ms: Math.round(performance.now() - started),
    };
  }
}
