import type { BadgeTone } from '@a3s-lab/ui';
import type { MessageKey } from '@/i18n/messages';
import type {
  ModelCapability,
  ModelState,
  ServiceModel,
  SupplierKind,
  SupplierProtocol,
} from '@/lib/modelServiceApi';
import type { ReasoningEffortLevel } from './modelEffort';

export function protocolKey(protocol: SupplierProtocol): MessageKey {
  return protocol === 'anthropic' ? 'modelService.protocol.anthropic' : 'modelService.protocol.openai';
}

export function supplierKindKey(kind: SupplierKind): MessageKey {
  if (kind === 'self_hosted') return 'modelService.kind.self_hosted';
  if (kind === 'relay') return 'modelService.kind.relay';
  return 'modelService.kind.vendor';
}

export function capabilityKey(capability: ModelCapability): MessageKey {
  return `modelService.capability.${capability}` as MessageKey;
}

export function effortKey(level: ReasoningEffortLevel): MessageKey {
  return `modelService.model.effort.${level}` as MessageKey;
}

export function stateKey(state: ModelState): MessageKey {
  return `modelService.state.${state}` as MessageKey;
}

export function stateTone(state: ModelState): BadgeTone {
  if (state === 'published') return 'success';
  if (state === 'suspended') return 'warn';
  return 'neutral';
}

/** What members experience: serving, unpublished, or published with no usable supplier. */
export function availabilityKey(model: ServiceModel): MessageKey {
  if (model.source) return 'modelService.availability.serving';
  if (model.unavailableReason === 'no_routable_supplier') return 'modelService.availability.noSupplier';
  return 'modelService.availability.hidden';
}
