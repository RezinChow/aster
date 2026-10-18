import { useEffect, useState, type FormEvent } from 'react';
import { FormDialog, ConsoleFormField, Input, SearchSelect, Switch, useToast } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import {
  createSupplier,
  SUPPLIER_KINDS,
  updateSupplier,
  type Supplier,
  type SupplierKind,
  type SupplierProtocol,
  type SupplierWrite,
} from '@/lib/modelServiceApi';
import { splitList } from '@/pages/assets/shared/format';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { protocolKey, supplierKindKey } from './labels';

type Draft = {
  name: string;
  kind: SupplierKind;
  protocol: SupplierProtocol;
  baseUrl: string;
  dataRegion: string;
  retainsData: boolean;
  originVendors: string;
  enabled: boolean;
  apiKey: string;
  clearKey: boolean;
};

const EMPTY: Draft = {
  name: '',
  kind: 'vendor',
  protocol: 'openai',
  baseUrl: '',
  dataRegion: '',
  retainsData: false,
  originVendors: '',
  enabled: true,
  apiKey: '',
  clearKey: false,
};

function draftOf(supplier: Supplier): Draft {
  return {
    name: supplier.name,
    kind: supplier.kind,
    protocol: supplier.protocol,
    baseUrl: supplier.baseUrl,
    dataRegion: supplier.dataRegion ?? '',
    retainsData: supplier.retainsData ?? false,
    originVendors: supplier.originVendors.join(', '),
    enabled: supplier.enabled,
    apiKey: '',
    clearKey: false,
  };
}

function writeOf(draft: Draft, supplier: Supplier | undefined): SupplierWrite {
  const apiKey = draft.apiKey.trim();
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    protocol: draft.protocol,
    baseUrl: draft.baseUrl.trim(),
    dataRegion: draft.dataRegion.trim() || undefined,
    retainsData: draft.retainsData,
    originVendors: draft.kind === 'relay' ? splitList(draft.originVendors) : [],
    // The catalog lives on its own page. An edit here must send the current list
    // because an omitted models field replaces the catalog with empty.
    models: supplier?.models ?? [],
    enabled: draft.enabled,
    apiKey: apiKey || (supplier && draft.clearKey ? '' : undefined),
  };
}

export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent → create. */
  supplier?: Supplier;
  onSaved: (supplier: Supplier) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const patch = (next: Partial<Draft>) => setDraft((current) => ({ ...current, ...next }));

  useEffect(() => {
    if (open) setDraft(supplier ? draftOf(supplier) : EMPTY);
  }, [open, supplier]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const write = writeOf(draft, supplier);
      const saved = supplier ? await updateSupplier(supplier.id, write) : await createSupplier(write);
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const selfHosted = draft.kind === 'self_hosted';
  const keyHint = supplier?.hasKey
    ? t('modelService.supplier.keyKeep').replace('{hint}', supplier.keyHint ?? '')
    : selfHosted
      ? t('modelService.supplier.keyOptional')
      : undefined;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={supplier ? t('modelService.supplier.edit') : t('modelService.supplier.create')}
      description={t('modelService.supplier.createDesc')}
      cancelLabel={t('assets.action.cancel')}
      submitLabel={supplier ? t('assets.action.save') : t('assets.action.create')}
      submitting={submitting}
      submitDisabled={!draft.name.trim() || !draft.baseUrl.trim()}
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('modelService.supplier.name')} required>
          <Input
            value={draft.name}
            placeholder="DeepSeek"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.supplier.kind')} required>
          <SearchSelect
            value={draft.kind}
            searchable={false}
            allowClear={false}
            options={SUPPLIER_KINDS.map((kind) => ({ value: kind, label: t(supplierKindKey(kind)) }))}
            onChange={(kind) => patch({ kind: (kind || 'vendor') as SupplierKind })}
          />
        </ConsoleFormField>
        <ConsoleFormField label={t('modelService.supplier.protocol')} required>
          <SearchSelect
            value={draft.protocol}
            searchable={false}
            allowClear={false}
            options={[
              { value: 'openai', label: t(protocolKey('openai')) },
              { value: 'anthropic', label: t(protocolKey('anthropic')) },
            ]}
            onChange={(protocol) => patch({ protocol: (protocol || 'openai') as SupplierProtocol })}
          />
        </ConsoleFormField>
      </div>
      <ConsoleFormField label="Base URL" required hint={t('modelService.supplier.baseUrlHint')}>
        <Input
          value={draft.baseUrl}
          placeholder={selfHosted ? 'http://vllm.internal:8000/v1' : 'https://api.deepseek.com/v1'}
          onChange={(event) => patch({ baseUrl: event.target.value })}
        />
      </ConsoleFormField>
      <ConsoleFormField label="API Key" hint={keyHint}>
        <Input
          type="password"
          autoComplete="off"
          value={draft.apiKey}
          placeholder={supplier?.hasKey ? (supplier.keyHint ?? '') : 'sk-…'}
          onChange={(event) => patch({ apiKey: event.target.value, clearKey: false })}
        />
      </ConsoleFormField>
      {supplier?.hasKey ? (
        <Switch
          checked={draft.clearKey}
          onCheckedChange={(clearKey) => patch({ clearKey, apiKey: clearKey ? '' : draft.apiKey })}
          label={t('modelService.supplier.clearKey')}
        />
      ) : null}

      <h3 className="pt-2 text-sm font-medium text-ink">{t('modelService.supplier.trust')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <ConsoleFormField label={t('modelService.supplier.dataRegion')}>
          <Input
            value={draft.dataRegion}
            placeholder="cn"
            onChange={(event) => patch({ dataRegion: event.target.value })}
          />
        </ConsoleFormField>
        {draft.kind === 'relay' ? (
          <ConsoleFormField label={t('modelService.supplier.originVendors')} hint={t('assets.field.listHint')}>
            <Input
              value={draft.originVendors}
              placeholder="openai, anthropic"
              onChange={(event) => patch({ originVendors: event.target.value })}
            />
          </ConsoleFormField>
        ) : null}
      </div>
      <Switch
        checked={draft.retainsData}
        onCheckedChange={(retainsData) => patch({ retainsData })}
        label={t('modelService.supplier.retainsData')}
      />
      <Switch
        checked={draft.enabled}
        onCheckedChange={(enabled) => patch({ enabled })}
        label={t('modelService.supplier.enabled')}
      />
    </FormDialog>
  );
}
