import { useEffect, useState, type ComponentProps, type FormEvent } from 'react';
import { FormDialog, ConsoleFormField, Input, SearchSelect, ConsoleTextarea, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  createServiceModel,
  MODEL_CAPABILITIES,
  updateServiceModel,
  type ModelCapability,
  type ModelRoute,
  type ServiceModel,
  type ServiceModelWrite,
  type Supplier,
} from '@/lib/modelServiceApi';
import { splitList } from '@/pages/assets/shared/format';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { capabilityKey, effortKey, supplierKindKey } from './labels';
import { orderedReasoningEfforts, REASONING_EFFORT_LEVELS, type ReasoningEffortLevel } from './modelEffort';
import { parseModelRate, parsePriceMultiplier, type ModelRate, type ModelRateErrors, type ModelRateField } from './modelRate';

type Draft = {
  id: string;
  name: string;
  brand: string;
  catalogKey: string;
  description: string;
  capabilities: ModelCapability[];
  effortEnabled: boolean;
  efforts: ReasoningEffortLevel[];
  contextWindow: string;
  outputLimit: string;
  inputPrice: string;
  cacheReadPrice: string;
  cacheWritePrice: string;
  outputPrice: string;
  priceMultiplier: string;
  tags: string;
  supplierId: string;
  upstreamModel: string;
};

/** Seeds a new model from a supplier's upstream id (the 导入 flow). */
export type ModelPreset = { supplierId: string; upstreamModel: string };

const text = (value: number | null | undefined) => (value == null ? '' : String(value));

/** The offering stores one supplier and one of that supplier's models. */
function bindingOf(model: ServiceModel): { supplierId: string; upstreamModel: string } {
  const route = [...model.routes].sort((a, b) => a.priority - b.priority || a.upstreamModel.localeCompare(b.upstreamModel))[0];
  return { supplierId: route?.supplierId ?? '', upstreamModel: route?.upstreamModel ?? '' };
}

function MoneyInput({ id, 'aria-invalid': invalid, 'aria-describedby': describedBy, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-ink-muted">
        $
      </span>
      <Input id={id} aria-invalid={invalid} aria-describedby={describedBy} className="pl-6" {...props} />
    </div>
  );
}

function emptyDraft(preset?: ModelPreset): Draft {
  const upstream = preset?.upstreamModel ?? '';
  return {
    id: upstream.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(0, 64),
    name: upstream,
    brand: '',
    catalogKey: '',
    description: '',
    capabilities: ['tool_call'],
    effortEnabled: false,
    efforts: [],
    contextWindow: '',
    outputLimit: '',
    inputPrice: '',
    cacheReadPrice: '',
    cacheWritePrice: '',
    outputPrice: '',
    priceMultiplier: '1',
    tags: '',
    supplierId: preset?.supplierId ?? '',
    upstreamModel: preset?.upstreamModel ?? '',
  };
}

function draftOf(model: ServiceModel): Draft {
  return {
    id: model.id,
    name: model.name,
    brand: model.brand ?? '',
    catalogKey: model.catalogKey ?? '',
    description: model.description,
    capabilities: model.capabilities,
    effortEnabled: orderedReasoningEfforts(model.reasoningEfforts ?? []).length > 0,
    efforts: orderedReasoningEfforts(model.reasoningEfforts ?? []),
    contextWindow: text(model.contextWindow),
    outputLimit: text(model.outputLimit),
    inputPrice: text(model.inputPrice),
    cacheReadPrice: text(model.cacheReadPrice),
    cacheWritePrice: text(model.cacheWritePrice),
    outputPrice: text(model.outputPrice),
    priceMultiplier: text(model.priceMultiplier ?? 1),
    tags: model.tags.join(', '),
    ...bindingOf(model),
  };
}

const count = (value: string) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function routesOf(draft: Draft): ModelRoute[] {
  const upstreamModel = draft.upstreamModel.trim();
  if (!draft.supplierId || !upstreamModel) return [];
  return [{ supplierId: draft.supplierId, upstreamModel, priority: 0, weight: 1 }];
}

function writeOf(draft: Draft, rate: ModelRate, priceMultiplier: number): ServiceModelWrite {
  return {
    id: draft.id.trim(),
    name: draft.name.trim(),
    brand: draft.brand.trim() || undefined,
    catalogKey: draft.catalogKey.trim() || undefined,
    description: draft.description.trim(),
    capabilities: draft.capabilities,
    reasoningEfforts: draft.effortEnabled ? orderedReasoningEfforts(draft.efforts) : [],
    contextWindow: count(draft.contextWindow),
    outputLimit: count(draft.outputLimit),
    inputPrice: rate.input,
    cacheReadPrice: rate.cacheRead,
    cacheWritePrice: rate.cacheWrite,
    outputPrice: rate.output,
    priceMultiplier,
    tags: splitList(draft.tags),
    routes: routesOf(draft),
  };
}

export function ModelDialog({
  open,
  onOpenChange,
  model,
  preset,
  suppliers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent → create. */
  model?: ServiceModel;
  preset?: ModelPreset;
  suppliers: Supplier[];
  onSaved: (model: ServiceModel) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [rateErrors, setRateErrors] = useState<ModelRateErrors>({});
  const [multiplierError, setMultiplierError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));
  const patchPrice = (field: 'inputPrice' | 'cacheReadPrice' | 'cacheWritePrice' | 'outputPrice', errorField: ModelRateField, value: string) => {
    patch({ [field]: value });
    setRateErrors((current) => {
      if (!current[errorField]) return current;
      const next = { ...current };
      delete next[errorField];
      return next;
    });
  };
  useEffect(() => {
    if (open) {
      setDraft(model ? draftOf(model) : emptyDraft(preset));
      setRateErrors({});
      setMultiplierError(false);
    }
  }, [open, model, preset]);

  const rateError = (field: ModelRateField) => {
    const code = rateErrors[field];
    if (code === 'invalid') return t('modelService.model.priceInvalid');
    if (code === 'cacheReadAboveInput') return t('modelService.model.cacheReadAboveInput');
    return undefined;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseModelRate({
      input: draft.inputPrice,
      cacheRead: draft.cacheReadPrice,
      cacheWrite: draft.cacheWritePrice,
      output: draft.outputPrice,
    });
    const priceMultiplier = parsePriceMultiplier(draft.priceMultiplier);
    setRateErrors(parsed.errors);
    setMultiplierError(priceMultiplier === 'invalid');
    if (Object.keys(parsed.errors).length > 0 || priceMultiplier === 'invalid') return;
    setSubmitting(true);
    try {
      const write = writeOf(draft, parsed.rate, priceMultiplier);
      const saved = model ? await updateServiceModel(model.id, write) : await createServiceModel(write);
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find((supplier) => supplier.id === draft.supplierId);
  const catalog = selectedSupplier?.models ?? [];
  const modelOptions = (draft.upstreamModel && !catalog.includes(draft.upstreamModel)
    ? [draft.upstreamModel, ...catalog]
    : catalog
  ).map((model) => ({ value: model, label: model, keywords: model }));
  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: `${supplier.name} · ${t(supplierKindKey(supplier.kind))}`,
    keywords: `${supplier.name} ${supplier.baseUrl} ${(supplier.models ?? []).join(' ')}`,
  }));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={model ? t('modelService.model.edit') : t('modelService.model.create')}
      description={t('modelService.model.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={model ? t('assets.action.save') : t('assets.action.create')}
      submitting={submitting}
      submitDisabled={
        !draft.id.trim() ||
        !draft.name.trim() ||
        !draft.supplierId ||
        !draft.upstreamModel.trim() ||
        (draft.effortEnabled && draft.efforts.length === 0)
      }
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('modelService.route.supplier')} required>
          <SearchSelect
            value={draft.supplierId}
            allowClear={false}
            placeholder={t('modelService.route.supplierPlaceholder')}
            options={supplierOptions}
            onChange={(supplierId) => {
              const next = suppliers.find((supplier) => supplier.id === supplierId);
              const models = next?.models ?? [];
              const upstreamModel = models.includes(draft.upstreamModel) ? draft.upstreamModel : '';
              patch({ supplierId, upstreamModel });
            }}
          />
        </ConsoleFormField>
        <ConsoleFormField
          label={t('modelService.model.bindingModel')}
          required
          hint={draft.supplierId && modelOptions.length === 0 ? t('modelService.model.bindingModelEmpty') : undefined}
        >
          <SearchSelect
            value={draft.upstreamModel}
            allowClear={false}
            disabled={!draft.supplierId || modelOptions.length === 0}
            placeholder={t('modelService.model.bindingModelPlaceholder')}
            options={modelOptions}
            onChange={(upstreamModel) => patch({ upstreamModel })}
          />
        </ConsoleFormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('modelService.model.name')} required>
          <Input
            value={draft.name}
            placeholder="DeepSeek V3"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.id')} required hint={t('modelService.model.idHint')}>
          <Input
            value={draft.id}
            disabled={Boolean(model)}
            placeholder="deepseek-v3"
            onChange={(event) => patch({ id: event.target.value })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.brand')} hint={t('modelService.model.brandHint')}>
          <Input value={draft.brand} placeholder="DeepSeek" onChange={(event) => patch({ brand: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.catalogKey')} hint={t('modelService.model.catalogKeyHint')}>
          <Input
            value={draft.catalogKey}
            placeholder="deepseek/deepseek-chat"
            onChange={(event) => patch({ catalogKey: event.target.value })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.field.description')}>
        <ConsoleTextarea rows={2} value={draft.description} onChange={(event) => patch({ description: event.target.value })} />
      </ConsoleFormField>
      <ConsoleFormField label={t('modelService.model.capabilities')}>
        <SearchSelect
          multiple
          searchable={false}
          value={draft.capabilities}
          options={MODEL_CAPABILITIES.map((capability) => ({ value: capability, label: t(capabilityKey(capability)) }))}
          onChange={(capabilities) => patch({ capabilities: capabilities as ModelCapability[] })}
        />
      </ConsoleFormField>
      <div>
        <div className="flex items-center gap-2 text-sm text-ink">
          <button
            type="button"
            role="checkbox"
            aria-checked={draft.effortEnabled}
            aria-label={t('modelService.model.effortEnabled')}
            data-on={draft.effortEnabled ? 'true' : undefined}
            className="ui-check"
            onClick={() => patch({ effortEnabled: !draft.effortEnabled })}
          >
            {draft.effortEnabled ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M3.2 8.3 6.3 11.4 12.8 4.7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : null}
          </button>
          <span>{t('modelService.model.effortEnabled')}</span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">{t('modelService.model.effortHint')}</p>
      </div>
      {draft.effortEnabled ? (
        <ConsoleFormField label={t('modelService.model.effortLevels')} hint={t('modelService.model.effortLevelsHint')}>
          <SearchSelect
            multiple
            searchable={false}
            value={draft.efforts}
            options={REASONING_EFFORT_LEVELS.map((level) => ({
              value: level,
              label: t(effortKey(level)),
            }))}
            onChange={(efforts) => patch({ efforts: orderedReasoningEfforts(efforts) })}
          />
        </ConsoleFormField>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('modelService.model.contextWindow')}>
          <Input inputMode="numeric" value={draft.contextWindow} placeholder="131072" onChange={(event) => patch({ contextWindow: event.target.value })} />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.outputLimit')}>
          <Input inputMode="numeric" value={draft.outputLimit} placeholder="8192" onChange={(event) => patch({ outputLimit: event.target.value })} />
        </ConsoleFormField>
      </div>
      <div className="pt-1">
        <h3 className="text-sm font-medium text-ink">{t('modelService.model.rates')}</h3>
        <p className="text-xs text-ink-muted">{t('modelService.model.ratesHint')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <ConsoleFormField label={t('modelService.model.inputPrice')} hint={t('modelService.model.inputPriceHint')} error={rateError('input')}>
          <MoneyInput inputMode="decimal" placeholder="0.30" value={draft.inputPrice} onChange={(event) => patchPrice('inputPrice', 'input', event.target.value)} />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.cacheReadPrice')} hint={t('modelService.model.cacheReadHint')} error={rateError('cacheRead')}>
          <MoneyInput inputMode="decimal" placeholder="0.03" value={draft.cacheReadPrice} onChange={(event) => patchPrice('cacheReadPrice', 'cacheRead', event.target.value)} />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.cacheWritePrice')} hint={t('modelService.model.cacheWriteHint')} error={rateError('cacheWrite')}>
          <MoneyInput inputMode="decimal" placeholder="0.375" value={draft.cacheWritePrice} onChange={(event) => patchPrice('cacheWritePrice', 'cacheWrite', event.target.value)} />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.model.outputPrice')} hint={t('modelService.model.outputPriceHint')} error={rateError('output')}>
          <MoneyInput inputMode="decimal" placeholder="1.20" value={draft.outputPrice} onChange={(event) => patchPrice('outputPrice', 'output', event.target.value)} />
        </ConsoleFormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <ConsoleFormField
          label={t('modelService.model.priceMultiplier')}
          hint={t('modelService.model.priceMultiplierHint')}
          error={multiplierError ? t('modelService.model.priceMultiplierInvalid') : undefined}
        >
          <Input
            inputMode="decimal"
            placeholder="1"
            value={draft.priceMultiplier}
            onChange={(event) => {
              patch({ priceMultiplier: event.target.value });
              setMultiplierError(false);
            }}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label={t('assets.field.tags')} hint={t('assets.field.listHint')}>
        <Input value={draft.tags} onChange={(event) => patch({ tags: event.target.value })} />
      </ConsoleFormField>
    </FormDialog>
  );
}
