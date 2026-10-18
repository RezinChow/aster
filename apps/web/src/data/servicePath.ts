/**
 * Work Gateway path for listings — opaque sku only:
 *   /v1/api/services/{kind}/invoke/{sku}
 *
 * Subdivided interfaces are not path suffixes; Runtime maps sku → upstream.
 */

import type { ListingKind } from '@/data/marketplace';

function toServiceKind(kind: ListingKind): 'model' | 'tool' | 'api' | 'feed' {
  if (kind === 'model' || kind === 'tool' || kind === 'api' || kind === 'feed') {
    return kind;
  }
  return 'api';
}

/** Path under /v1. Callers that prepend /v1 produce /v1/api/services/... */
export function gatewayRelativePathForSku(
  listingSku: string,
  kind: ListingKind,
): string {
  return `/api/services/${toServiceKind(kind)}/invoke/${listingSku.trim()}`;
}
