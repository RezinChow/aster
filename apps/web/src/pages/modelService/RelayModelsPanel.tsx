import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Badge,
  Button,
  cn,
  ConsoleConfirmDialog,
  ConsoleEmptyState,
  ListToolbar,
  useToast,
} from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { I18nDataTable } from '@/components/I18nDataTable';
import { IconBan, IconCheck, IconEdit, IconMore, IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  deleteServiceModel,
  getModelServiceSettings,
  listServiceModels,
  listSuppliers,
  setServiceModelState,
  type ServiceModel,
  type Supplier,
} from '@/lib/modelServiceApi';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { ModelDialog, type ModelPreset } from './ModelDialog';
import { availabilityKey, stateKey, stateTone, supplierKindKey } from './labels';
import { formatMultiplier, formatUsd } from './modelRate';
import { scopedRelaySuppliers } from './relayScope';
import { matchesQuery } from './surface';

const rowActionClassName =
  'flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[var(--spec-body)] outline-none hover:bg-[var(--spec-selected-row)] focus-visible:ring-2 focus-visible:ring-black/10';

type MenuBox = { top?: number; bottom?: number; right: number };

function measureMenu(button: HTMLButtonElement): MenuBox {
  const rect = button.getBoundingClientRect();
  const right = Math.max(8, window.innerWidth - rect.right);
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 160 && rect.top > spaceBelow) {
    return { bottom: window.innerHeight - rect.top + 4, right };
  }
  return { top: rect.bottom + 4, right };
}

/** Name-cell actions: icon buttons on row hover, delete inside the more menu. */
function ModelRowActions({
  model,
  editLabel,
  stateLabel,
  deleteLabel,
  moreLabel,
  onEdit,
  onToggleState,
  onDelete,
}: {
  model: ServiceModel;
  editLabel: string;
  stateLabel: string;
  deleteLabel: string;
  moreLabel: string;
  onEdit: () => void;
  onToggleState: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<MenuBox | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const dismiss = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, [open]);

  const menu =
    open && box
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            style={{ position: 'fixed', top: box.top, bottom: box.bottom, right: box.right, zIndex: 80 }}
            className="min-w-[168px] rounded-[10px] border border-[#ebebeb] bg-white py-1 shadow-[0_8px_22px_rgba(20,40,80,0.08)]"
          >
            <button
              type="button"
              role="menuitem"
              className="flex h-8 w-full items-center gap-2 px-3 text-left text-[13px] text-[var(--spec-danger-text)] outline-none hover:bg-[var(--spec-field)] focus-visible:bg-[var(--spec-field)]"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
                onDelete();
              }}
            >
              <IconTrash width={14} height={14} />
              {deleteLabel}
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn(
        'pointer-events-none absolute top-1/2 right-0 z-10 flex -translate-y-1/2 items-center bg-white pr-1 opacity-0 group-focus-within:pointer-events-auto group-focus-within:bg-[var(--spec-hover-row)] group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:bg-[var(--spec-hover-row)] group-hover:opacity-100',
        open && 'pointer-events-auto opacity-100',
      )}
    >
      <button
        type="button"
        className={rowActionClassName}
        aria-label={editLabel}
        title={editLabel}
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
      >
        <IconEdit width={14} height={14} />
      </button>
      <button
        type="button"
        className={rowActionClassName}
        aria-label={stateLabel}
        title={stateLabel}
        onClick={(event) => {
          event.stopPropagation();
          onToggleState();
        }}
      >
        {model.state === 'published' ? <IconBan width={14} height={14} /> : <IconCheck width={14} height={14} />}
      </button>
      <button
        ref={moreRef}
        type="button"
        className={cn(rowActionClassName, open && 'bg-[var(--spec-selected-row)] text-[var(--spec-ink)]')}
        aria-label={moreLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={moreLabel}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => {
            const next = !current;
            if (next && moreRef.current) setBox(measureMenu(moreRef.current));
            return next;
          });
        }}
      >
        <IconMore width={14} height={14} />
      </button>
      {menu}
    </div>
  );
}

/** Member relay models for one commerce supplier. Inference does not list them. */
export function RelayModelsPanel({
  partnerNames,
  onCount,
}: {
  partnerNames: readonly string[];
  onCount?: (count: number) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [models, setModels] = useState<ServiceModel[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelDialog, setModelDialog] = useState<{ model?: ServiceModel; preset?: ModelPreset } | null>(null);
  const [pending, setPending] = useState<ServiceModel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [nextModels, nextSuppliers, settings] = await Promise.all([
        listServiceModels(),
        listSuppliers(),
        getModelServiceSettings(),
      ]);
      setModels(nextModels);
      setSuppliers(nextSuppliers);
      setDefaultModel(settings.defaultModel ?? '');
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

  const supplierName = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );
  const failed = (err: unknown) => toast.push({ tone: 'danger', title: errorMessage(err) });

  const toggleState = async (model: ServiceModel) => {
    try {
      await setServiceModelState(model.id, model.state === 'published' ? 'suspended' : 'published');
      await reload();
    } catch (err) {
      failed(err);
    }
  };

  const scopedSuppliers = useMemo(
    () => scopedRelaySuppliers(suppliers, partnerNames),
    [suppliers, partnerNames],
  );
  const scopedIds = useMemo(
    () => new Set(scopedSuppliers.map((supplier) => supplier.id)),
    [scopedSuppliers],
  );
  const ownedModels = useMemo(
    () => models.filter((model) => model.routes.some((route) => scopedIds.has(route.supplierId))),
    [models, scopedIds],
  );
  useEffect(() => {
    onCount?.(ownedModels.length);
  }, [onCount, ownedModels.length]);
  const visibleModels = ownedModels.filter((model) =>
    matchesQuery(query, [
      model.name,
      model.id,
      model.brand ?? '',
      ...model.routes.flatMap((route) => [
        supplierName.get(route.supplierId) ?? '',
        route.upstreamModel,
      ]),
    ]),
  );
  const searching = query.trim().length > 0;
  const canAdd = scopedSuppliers.length > 0;
  const openCreate = () => {
    const only = scopedSuppliers.length === 1 ? scopedSuppliers[0] : undefined;
    setModelDialog(only ? { preset: { supplierId: only.id, upstreamModel: '' } } : {});
  };

  return (
    <>
      {error ? <AppErrorBanner message={error} onRetry={() => void reload()} /> : null}
      <ListToolbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder={t('modelService.search.models')}
        primaryAction={
          canAdd ? (
            <Button size="sm" onClick={openCreate}>
              <IconPlus />
              {t('modelService.model.create')}
            </Button>
          ) : undefined
        }
      />
      <I18nDataTable
        rows={visibleModels}
        rowKey={(model) => model.id}
        aria-label={t('modelService.tab.models')}
        loading={loading}
        onRefresh={() => reload()}
        columns={[
          {
            id: 'name',
            header: t('modelService.model.name'),
            cell: (model) => (
              <div className="relative min-w-0">
                <div className="min-w-0 pr-20">
                  <div className="truncate text-sm font-medium text-ink">
                    {model.name}
                    {model.id === defaultModel ? (
                      <Badge tone="primary" className="ml-1.5">
                        {t('modelService.badge.default')}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="truncate font-mono text-xs text-ink-muted">{model.id}</div>
                </div>
                <ModelRowActions
                  model={model}
                  editLabel={t('modelService.action.edit')}
                  stateLabel={
                    model.state === 'published'
                      ? t('modelService.action.suspend')
                      : t('modelService.action.publish')
                  }
                  deleteLabel={t('assets.action.delete')}
                  moreLabel={t('assets.action.more')}
                  onEdit={() => setModelDialog({ model })}
                  onToggleState={() => void toggleState(model)}
                  onDelete={() => setPending(model)}
                />
              </div>
            ),
          },
          { id: 'brand', header: t('modelService.model.brand'), cell: (model) => model.brand || '—' },
          {
            id: 'rate',
            header: t('modelService.model.rateColumn'),
            cell: (model) => {
              const parts = (
                [
                  [t('modelService.model.inputPrice'), model.inputPrice],
                  [t('modelService.model.cacheReadPrice'), model.cacheReadPrice],
                  [t('modelService.model.cacheWritePrice'), model.cacheWritePrice],
                  [t('modelService.model.outputPrice'), model.outputPrice],
                ] as const
              ).flatMap(([label, value]) => (value == null ? [] : [`${label} $${formatUsd(value)}`]));
              const multiplier = `×${formatMultiplier(model.priceMultiplier ?? 1)}`;
              const text = parts.length ? `${parts.join(' · ')} · ${multiplier}` : model.priceMultiplier != null && model.priceMultiplier !== 1 ? multiplier : '';
              return (
                <span className={text ? 'text-sm tabular-nums text-ink' : 'text-sm text-ink-muted'}>
                  {text || t('modelService.model.rateUnset')}
                </span>
              );
            },
          },
          {
            id: 'routes',
            header: t('modelService.model.routes'),
            cell: (model) =>
              model.routes.length === 0 ? (
                '—'
              ) : (
                <div className="min-w-0 space-y-1">
                  {model.routes.map((route) => (
                    <div key={`${route.supplierId}:${route.upstreamModel}`} className="min-w-0">
                      <div className="truncate text-sm text-ink">{supplierName.get(route.supplierId) ?? '—'}</div>
                      <div className="truncate font-mono text-xs text-ink-muted">{route.upstreamModel}</div>
                    </div>
                  ))}
                </div>
              ),
          },
          {
            id: 'state',
            header: t('modelService.model.state'),
            cell: (model) => <Badge tone={stateTone(model.state)}>{t(stateKey(model.state))}</Badge>,
          },
          {
            id: 'availability',
            header: t('modelService.model.availability'),
            cell: (model) => (
              <span className={model.source ? 'text-sm text-ink' : 'text-sm text-ink-muted'}>
                {t(availabilityKey(model))}
                {model.source ? ` · ${t(supplierKindKey(model.source))}` : ''}
              </span>
            ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            title={t(
              searching
                ? 'modelService.emptyFiltered'
                : canAdd
                  ? 'modelService.model.empty'
                  : 'suppliers.detail.relayUnlinked',
            )}
            description={t(
              searching
                ? 'modelService.emptyFilteredHint'
                : canAdd
                  ? 'modelService.model.emptyBody'
                  : 'suppliers.detail.relayUnlinkedBody',
            )}
            action={
              searching || !canAdd ? undefined : (
                <Button size="sm" onClick={openCreate}>
                  {t('modelService.model.create')}
                </Button>
              )
            }
          />
        }
      />
      <ModelDialog
        open={modelDialog !== null}
        onOpenChange={(open) => {
          if (!open) setModelDialog(null);
        }}
        model={modelDialog?.model}
        preset={modelDialog?.preset}
        suppliers={scopedSuppliers}
        onSaved={() => {
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
          void reload();
        }}
      />
      <ConsoleConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        tone="danger"
        title={t('assets.danger.confirmTitle').replace('{name}', pending?.name ?? '')}
        description={t('modelService.model.deleteDesc')}
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={deleting}
        onConfirm={async () => {
          if (!pending) return;
          setDeleting(true);
          try {
            await deleteServiceModel(pending.id);
            setPending(null);
            await reload();
          } catch (err) {
            failed(err);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
