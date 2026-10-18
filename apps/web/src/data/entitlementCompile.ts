/**
 * EntitlementCompile projection.
 * Prefers Gateway `/v1/acl` (dev-compile) when reachable; otherwise local preview.
 */

import {
  gatewayAbsoluteUrl,
  LOCAL_GATEWAY_DEV_KEY,
  probeGatewayHealth,
} from '@/lib/workConnect';

export type CompileStatus = 'pending' | 'compiled' | 'failed' | 'stale';

export type EntitlementCompileView = {
  compileStatus: CompileStatus;
  generation: number;
  snapshotRev: string | null;
  entitledCount: number;
  lastError: string | null;
  updatedAtEpoch: number;
  /** True when values are local preview, not Cloud / Gateway authority. */
  preview: boolean;
  entitledSkus?: string[];
};

let generation = 3;
let compileStatus: CompileStatus = 'compiled';
let snapshotRev: string | null = 'edge-snap-preview-008';
let lastError: string | null = null;
let updatedAtEpoch = Math.floor(Date.now() / 1000) - 3600;
let gatewayView: EntitlementCompileView | null = null;

export function getEntitlementCompileView(
  entitledCount: number,
): EntitlementCompileView {
  if (gatewayView) {
    return {
      ...gatewayView,
      entitledCount: gatewayView.entitledCount || entitledCount,
    };
  }
  return {
    compileStatus,
    generation,
    snapshotRev,
    entitledCount,
    lastError,
    updatedAtEpoch,
    preview: true,
  };
}

/** Simulate admin entitle/revoke → pending → compiled (preview only). */
export function bumpEntitlementCompile(opts?: {
  fail?: boolean;
  stale?: boolean;
}): EntitlementCompileView {
  gatewayView = null;
  updatedAtEpoch = Math.floor(Date.now() / 1000);
  if (opts?.fail) {
    compileStatus = 'failed';
    lastError = 'preview: route binding missing for listing';
    return getEntitlementCompileView(0);
  }
  if (opts?.stale) {
    compileStatus = 'stale';
    lastError = null;
    return getEntitlementCompileView(0);
  }
  compileStatus = 'pending';
  lastError = null;
  snapshotRev = null;
  generation += 1;
  compileStatus = 'compiled';
  snapshotRev = `edge-snap-preview-${String(generation).padStart(3, '0')}`;
  return getEntitlementCompileView(0);
}

type GatewayAclJson = {
  compileStatus?: string;
  generation?: number;
  snapshotRev?: string;
  entitled_skus?: string[];
  source?: string;
};

export async function refreshEntitlementFromGateway(
  capabilityKey = LOCAL_GATEWAY_DEV_KEY,
): Promise<EntitlementCompileView | null> {
  void capabilityKey;
  const up = await probeGatewayHealth();
  if (!up) {
    gatewayView = null;
    return null;
  }
  try {
    const res = await fetch(gatewayAbsoluteUrl('/acl'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const acl = (await res.json()) as GatewayAclJson;
    const status = (acl.compileStatus ?? 'compiled') as CompileStatus;
    gatewayView = {
      compileStatus: ['pending', 'compiled', 'failed', 'stale'].includes(status)
        ? status
        : 'compiled',
      generation: acl.generation ?? 1,
      snapshotRev: acl.snapshotRev ?? null,
      entitledCount: acl.entitled_skus?.length ?? 0,
      lastError: null,
      updatedAtEpoch: Math.floor(Date.now() / 1000),
      preview: acl.source === 'dev-compile',
      entitledSkus: acl.entitled_skus,
    };
    return gatewayView;
  } catch {
    return null;
  }
}
