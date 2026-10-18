import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ConsoleDialog, ConsoleEmptyState, Input, Switch, useToast } from '@a3s-lab/ui';
import { DetailPageNav } from '@/components/DetailPageNav';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import {
  IconChevronDown,
  IconPlus,
  IconRotateCcw,
  IconSearch,
  IconSettings,
  IconX,
} from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  listSuppliers,
  probeSupplier,
  updateSupplier,
  type Supplier,
  type SupplierProtocol,
  type SupplierWrite,
} from '@/lib/modelServiceApi';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { protocolKey, supplierKindKey } from './labels';
import { SupplierDialog } from './SupplierDialog';
import { matchesQuery } from './surface';

const BACK_TO = '/admin/suppliers?tab=models';

function IconEye({ off, ...props }: SVGProps<SVGSVGElement> & { off?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M2.5 12S6.5 6.5 12 6.5 21.5 12 21.5 12 17.5 17.5 12 17.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.5" />
      {off ? <path d="M4 4.5 20 19.5" /> : null}
    </svg>
  );
}

function IconMinus(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden {...props}>
      <path d="M6 12h12" />
    </svg>
  );
}

/** Full supplier replace. An omitted models field would clear the catalog. */
function writeOf(supplier: Supplier, patch: Partial<SupplierWrite> = {}): SupplierWrite {
  return {
    name: supplier.name,
    kind: supplier.kind,
    protocol: supplier.protocol,
    baseUrl: supplier.baseUrl,
    dataRegion: supplier.dataRegion ?? undefined,
    retainsData: supplier.retainsData ?? undefined,
    originVendors: supplier.originVendors,
    enabled: supplier.enabled,
    models: supplier.models ?? [],
    ...patch,
  };
}

function endpointPreview(baseUrl: string, protocol: SupplierProtocol): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  if (!base) return '';
  const suffix = protocol === 'anthropic' ? '/messages' : '/chat/completions';
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

/** `vendor/model` groups by vendor. Otherwise the token before the first hyphen. */
function modelGroup(id: string): { group: string; label: string } {
  const slash = id.indexOf('/');
  if (slash > 0) return { group: id.slice(0, slash), label: id.slice(slash + 1) || id };
  const dash = id.indexOf('-');
  if (dash > 1) return { group: id.slice(0, dash), label: id };
  return { group: '', label: id };
}

type ModelGroup = { key: string; label: string; models: { id: string; label: string }[] };

function groupModels(ids: string[], otherLabel: string): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const id of ids) {
    const parsed = modelGroup(id);
    const key = parsed.group || '__other__';
    const label = parsed.group || otherLabel;
    const group = groups.get(key) ?? { key, label, models: [] };
    group.models.push({ id, label: parsed.label });
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Model-service supplier desk: pick a supplier, then its key, address, and models. */
export function SupplierModelsPage() {
  const { supplierId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [modelInput, setModelInput] = useState('');
  const [addingOpen, setAddingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<string[] | null>(null);
  const [probeQuery, setProbeQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [baseDraft, setBaseDraft] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<{ supplier?: Supplier } | null>(null);
  const writing = useRef(false);
  const suppliersRef = useRef(suppliers);
  suppliersRef.current = suppliers;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listSuppliers();
      setSuppliers(rows);
      suppliersRef.current = rows;
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const supplier = suppliers.find((item) => item.id === supplierId) ?? null;

  useEffect(() => {
    setKeyDraft(null);
    setRevealKey(false);
    setBaseDraft(supplier?.baseUrl ?? '');
    setModelQuery('');
    setSearchOpen(false);
    setAddingOpen(false);
    setModelInput('');
    setCollapsed({});
    setProbe(null);
  }, [supplier?.id]);

  const failed = (err: unknown) => toast.push({ tone: 'danger', title: errorMessage(err) });

  const commit = async (id: string, patch: Partial<SupplierWrite>) => {
    const current = suppliersRef.current.find((item) => item.id === id);
    if (!current || writing.current) return null;
    writing.current = true;
    setSaving(true);
    try {
      const saved = await updateSupplier(id, writeOf(current, patch));
      const next = suppliersRef.current.map((item) => (item.id === saved.id ? saved : item));
      suppliersRef.current = next;
      setSuppliers(next);
      return saved;
    } catch (err) {
      failed(err);
      return null;
    } finally {
      writing.current = false;
      setSaving(false);
    }
  };

  const saveModels = async (models: string[]) => {
    if (!supplier) return null;
    return commit(supplier.id, { models });
  };

  const addModel = async (value: string) => {
    const model = value.trim();
    if (!supplier || !model) return;
    if ((supplier.models ?? []).includes(model)) {
      setModelInput('');
      setAddingOpen(false);
      return;
    }
    const saved = await saveModels([...(supplier.models ?? []), model]);
    if (saved) {
      setModelInput('');
      setAddingOpen(false);
    }
  };

  const removeModels = async (ids: string[]) => {
    if (!supplier || ids.length === 0) return;
    const drop = new Set(ids);
    await saveModels((supplier.models ?? []).filter((item) => !drop.has(item)));
  };

  const addProbedModel = async (upstream: string) => {
    if (!supplier || (supplier.models ?? []).includes(upstream)) return;
    setAdding(upstream);
    try {
      await saveModels([...(supplier.models ?? []), upstream]);
    } finally {
      setAdding(null);
    }
  };

  const runProbe = async (mode: 'check' | 'sync') => {
    if (!supplier) return;
    if (mode === 'check') setChecking(true);
    else setProbing(true);
    try {
      const result = await probeSupplier(supplier.id);
      if (mode === 'check') {
        toast.push({
          tone: 'success',
          title: t('modelService.supplier.connected').replace('{count}', String(result.models.length)),
        });
      } else {
        setProbeQuery('');
        setProbe(result.models);
      }
    } catch (err) {
      failed(err);
    } finally {
      if (mode === 'check') setChecking(false);
      else setProbing(false);
    }
  };

  const saveBaseUrl = async () => {
    if (!supplier) return;
    const next = baseDraft.trim();
    if (!next || next === supplier.baseUrl) {
      setBaseDraft(supplier.baseUrl);
      return;
    }
    const saved = await commit(supplier.id, { baseUrl: next });
    if (!saved) setBaseDraft(supplier.baseUrl);
  };

  const saveKey = async () => {
    if (!supplier) return;
    const next = keyDraft?.trim() ?? '';
    setKeyDraft(null);
    setRevealKey(false);
    if (!next || next === (supplier.keyHint ?? '')) return;
    await commit(supplier.id, { apiKey: next });
  };

  const listed = useMemo(
    () =>
      suppliers
        .filter((item) => matchesQuery(listQuery, [item.name]))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'zh')),
    [suppliers, listQuery],
  );

  const groups = useMemo(() => {
    const ids = (supplier?.models ?? []).filter((id) => matchesQuery(modelQuery, [id]));
    return groupModels(ids, t('modelService.supplier.otherGroup'));
  }, [supplier?.models, modelQuery, t]);

  const allCollapsed = groups.length > 0 && groups.every((group) => collapsed[group.key]);
  const anthropic = supplier?.protocol === 'anthropic';
  const preview = supplier ? endpointPreview(baseDraft || supplier.baseUrl, supplier.protocol) : '';
  const keyShown = keyDraft !== null ? keyDraft : (supplier?.keyHint ?? '');

  const selectSupplier = (id: string) => {
    if (id === supplierId) return;
    navigate(`/admin/suppliers/${id}/models`, { replace: true });
  };

  return (
    <div className="space-y-3">
      <DetailPageNav
        backTo={BACK_TO}
        crumbs={[
          { label: t('nav.suppliers'), to: BACK_TO },
          { label: t('modelService.supplier.models') },
        ]}
      />
      {error ? <AppErrorBanner message={error} onRetry={() => void reload()} /> : null}
      <div className="flex h-[calc(100dvh-5.5rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-divider bg-white sm:flex-row">
        <aside className="flex max-h-52 w-full shrink-0 flex-col border-b border-divider sm:max-h-none sm:w-60 sm:border-r sm:border-b-0">
          <div className="p-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2.5 inline-flex items-center text-ink-faint">
                <IconSearch width={14} height={14} />
              </span>
              <Input
                size="sm"
                value={listQuery}
                placeholder={t('modelService.supplier.searchList')}
                aria-label={t('modelService.supplier.searchList')}
                className="w-full !pl-8"
                onChange={(event) => setListQuery(event.target.value)}
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label={t('nav.suppliers')}>
            {listed.map((item) => {
              const selected = item.id === supplierId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={selected ? 'page' : undefined}
                    className={
                      selected
                        ? 'flex w-full items-center gap-2 rounded-lg bg-[#f4f4f5] px-2 py-1.5 text-left'
                        : 'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--spec-quiet-button-hover)]'
                    }
                    onClick={() => selectSupplier(item.id)}
                  >
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-[#f0f0f1] text-[11px] font-medium text-ink">
                      {item.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.name}</span>
                    {item.enabled ? <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-divider p-2">
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => setEditor({})}>
              <IconPlus width={14} height={14} />
              {t('modelService.supplier.create')}
            </Button>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {!loading && !supplier ? (
            <div className="p-6">
              <ConsoleEmptyState title={t(suppliers.length ? 'modelService.supplier.missing' : 'modelService.supplier.empty')} />
            </div>
          ) : null}
          {supplier ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-5">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-ink">{supplier.name}</h1>
                <span
                  className="inline-flex size-4 items-center justify-center rounded-full text-[11px] text-ink-faint"
                  title={`${t(supplierKindKey(supplier.kind))} · ${t(protocolKey(supplier.protocol))}`}
                >
                  i
                </span>
                <div className="ml-auto">
                  <Switch
                    checked={supplier.enabled}
                    disabled={saving}
                    aria-label={t('modelService.supplier.enabled')}
                    onCheckedChange={(enabled) => void commit(supplier.id, { enabled })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-[13px] font-medium text-ink">{t('modelService.supplier.apiKey')}</div>
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    className="min-w-0 flex-1"
                    type={revealKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={keyShown}
                    placeholder={supplier.hasKey ? t('modelService.supplier.noKey') : t('modelService.supplier.keyOptional')}
                    disabled={saving}
                    aria-label={t('modelService.supplier.apiKey')}
                    onFocus={() => {
                      if (keyDraft === null) setKeyDraft('');
                    }}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    onBlur={() => void saveKey()}
                  />
                  <button
                    type="button"
                    className="inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5]"
                    aria-label={revealKey ? t('modelService.supplier.apiKey') : t('modelService.supplier.apiKey')}
                    onClick={() => setRevealKey((value) => !value)}
                  >
                    <IconEye off={revealKey} />
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={checking || saving}
                    onClick={() => void runProbe('check')}
                  >
                    {checking ? t('modelService.supplier.checking') : t('modelService.supplier.check')}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-ink">
                    {t(anthropic ? 'modelService.supplier.addressAnthropic' : 'modelService.supplier.addressOpenAI')}
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5]"
                    aria-label={t('modelService.supplier.edit')}
                    onClick={() => setEditor({ supplier })}
                  >
                    <IconSettings width={14} height={14} />
                  </button>
                </div>
                <Input
                  size="sm"
                  value={baseDraft}
                  disabled={saving}
                  aria-label={t(anthropic ? 'modelService.supplier.addressAnthropic' : 'modelService.supplier.addressOpenAI')}
                  onChange={(event) => setBaseDraft(event.target.value)}
                  onBlur={() => void saveBaseUrl()}
                />
                {preview ? (
                  <p className="truncate text-xs text-ink-muted">
                    {t(anthropic ? 'modelService.supplier.previewAnthropic' : 'modelService.supplier.previewOpenAI')}
                    {'： '}
                    {preview}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[13px] font-medium text-ink">{t('modelService.supplier.models')}</h2>
                  <button
                    type="button"
                    className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5] disabled:opacity-40"
                    aria-label={t(allCollapsed ? 'modelService.supplier.expandGroups' : 'modelService.supplier.collapseGroups')}
                    disabled={groups.length === 0}
                    onClick={() => {
                      if (allCollapsed) setCollapsed({});
                      else setCollapsed(Object.fromEntries(groups.map((group) => [group.key, true])));
                    }}
                  >
                    <IconChevronDown className={allCollapsed ? '-rotate-90' : undefined} width={14} height={14} />
                  </button>
                  {searchOpen || modelQuery ? (
                    <div className="relative w-44">
                      <Input
                        size="sm"
                        value={modelQuery}
                        autoFocus
                        placeholder={t('modelService.search.models')}
                        aria-label={t('modelService.search.models')}
                        onChange={(event) => setModelQuery(event.target.value)}
                        onBlur={() => {
                          if (!modelQuery) setSearchOpen(false);
                        }}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5]"
                      aria-label={t('modelService.search.models')}
                      onClick={() => setSearchOpen(true)}
                    >
                      <IconSearch width={14} height={14} />
                    </button>
                  )}
                  {modelQuery ? (
                    <button
                      type="button"
                      className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5]"
                      aria-label={t('assets.action.cancel')}
                      onClick={() => {
                        setModelQuery('');
                        setSearchOpen(false);
                      }}
                    >
                      <IconX width={14} height={14} />
                    </button>
                  ) : null}
                  <div className="ml-auto inline-flex items-center overflow-hidden rounded-md border border-divider">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1 px-2.5 text-[13px] text-ink hover:bg-[var(--spec-quiet-button-hover)] disabled:opacity-40"
                      disabled={probing || saving}
                      onClick={() => void runProbe('sync')}
                    >
                      <IconRotateCcw width={14} height={14} />
                      {probing ? t('modelService.action.probing') : t('modelService.supplier.sync')}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center border-l border-divider text-ink hover:bg-[var(--spec-quiet-button-hover)] disabled:opacity-40"
                      aria-label={t('modelService.supplier.addModel')}
                      disabled={saving}
                      onClick={() => setAddingOpen(true)}
                    >
                      <IconPlus width={14} height={14} />
                    </button>
                  </div>
                </div>

                {addingOpen ? (
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      className="max-w-sm"
                      autoFocus
                      value={modelInput}
                      placeholder={t('modelService.supplier.modelPlaceholder')}
                      disabled={saving}
                      aria-label={t('modelService.supplier.modelPlaceholder')}
                      onChange={(event) => setModelInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void addModel(modelInput);
                        }
                        if (event.key === 'Escape') setAddingOpen(false);
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!modelInput.trim() || saving}
                      onClick={() => void addModel(modelInput)}
                    >
                      {t('modelService.supplier.addModel')}
                    </Button>
                  </div>
                ) : null}

                {groups.length === 0 ? (
                  <p className="px-1 text-sm text-ink-muted">
                    {t(modelQuery ? 'modelService.emptyFiltered' : 'modelService.supplier.modelsPageEmpty')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => {
                      const open = !collapsed[group.key];
                      return (
                        <div key={group.key} className="overflow-hidden rounded-lg border border-divider">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <button
                              type="button"
                              className="inline-flex min-w-0 flex-1 items-center gap-2 text-left"
                              aria-expanded={open}
                              onClick={() => setCollapsed((current) => ({ ...current, [group.key]: open }))}
                            >
                              <IconChevronDown className={open ? undefined : '-rotate-90'} width={14} height={14} />
                              <span className="truncate text-sm text-ink">{group.label}</span>
                            </button>
                            <button
                              type="button"
                              className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5] disabled:opacity-40"
                              aria-label={t('modelService.supplier.removeGroup')}
                              disabled={saving}
                              onClick={() => void removeModels(group.models.map((model) => model.id))}
                            >
                              <IconMinus />
                            </button>
                          </div>
                          {open ? (
                            <ul>
                              {group.models.map((model) => (
                                <li key={model.id} className="flex items-center gap-2.5 px-4 py-2">
                                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-white">
                                    {model.label.slice(0, 1).toUpperCase()}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-sm text-ink" title={model.id}>
                                    {model.label}
                                  </span>
                                  <button
                                    type="button"
                                    className="inline-flex size-6 items-center justify-center rounded-md text-ink-muted hover:bg-[#f4f4f5] disabled:opacity-40"
                                    aria-label={t('modelService.supplier.removeModel')}
                                    disabled={saving}
                                    onClick={() => void removeModels([model.id])}
                                  >
                                    <IconMinus />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <SupplierDialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        supplier={editor?.supplier}
        onSaved={(saved) => {
          const next = suppliersRef.current.some((item) => item.id === saved.id)
            ? suppliersRef.current.map((item) => (item.id === saved.id ? saved : item))
            : [...suppliersRef.current, saved];
          suppliersRef.current = next;
          setSuppliers(next);
          if (!editor?.supplier) navigate(`/admin/suppliers/${saved.id}/models`, { replace: true });
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
        }}
      />

      <ConsoleDialog
        open={probe !== null}
        onOpenChange={(open) => {
          if (!open) setProbe(null);
        }}
        size="md"
        title={t('modelService.probe.title').replace('{name}', supplier?.name ?? '')}
        description={t('modelService.probe.desc').replace('{count}', String(probe?.length ?? 0))}
      >
        <Input
          size="sm"
          value={probeQuery}
          placeholder={t('modelService.search.models')}
          aria-label={t('modelService.search.models')}
          onChange={(event) => setProbeQuery(event.target.value)}
        />
        <ul className="max-h-80 space-y-0.5 overflow-y-auto">
          {probe
            ?.filter((upstream) => matchesQuery(probeQuery, [upstream]))
            .map((upstream) => {
              const listedModel = (supplier?.models ?? []).includes(upstream);
              return (
                <li key={upstream} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-[var(--spec-quiet-button-hover)]">
                  <span className="truncate font-mono text-xs text-ink">{upstream}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={listedModel || adding === upstream || saving}
                    onClick={() => void addProbedModel(upstream)}
                  >
                    {listedModel ? t('modelService.probe.added') : t('modelService.probe.import')}
                  </Button>
                </li>
              );
            })}
        </ul>
      </ConsoleDialog>
    </div>
  );
}
