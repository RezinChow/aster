import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  ConsoleConfirmDialog,
  ConsoleEmptyState,
  ListToolbar,
  useToast,
} from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { I18nDataTable } from '@/components/I18nDataTable';
import { IconPlus } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { deleteSupplier, listSuppliers, type Supplier } from '@/lib/modelServiceApi';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { protocolKey, supplierKindKey } from './labels';
import { SupplierDialog } from './SupplierDialog';
import { matchesQuery } from './surface';

/** Model-service suppliers. Member relay models are published on the suppliers page. */
export function ModelSuppliersPanel() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierDialog, setSupplierDialog] = useState<{ supplier?: Supplier } | null>(null);
  const [pending, setPending] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSuppliers(await listSuppliers());
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

  const failed = (err: unknown) => toast.push({ tone: 'danger', title: errorMessage(err) });
  const visible = suppliers.filter((supplier) =>
    matchesQuery(query, [
      supplier.name,
      supplier.baseUrl,
      supplier.kind,
      supplier.protocol,
      ...supplier.originVendors,
      ...(supplier.models ?? []),
    ]),
  );
  const searching = query.trim().length > 0;

  return (
    <div className="space-y-3">
      {error ? <AppErrorBanner message={error} onRetry={() => void reload()} /> : null}
      <ListToolbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder={t('modelService.search.suppliers')}
        primaryAction={
          <Button type="button" size="sm" onClick={() => setSupplierDialog({})}>
            <IconPlus />
            {t('modelService.supplier.create')}
          </Button>
        }
      />
      <I18nDataTable
        rows={visible}
        rowKey={(supplier) => supplier.id}
        aria-label={t('suppliers.tab.models')}
        loading={loading}
        onRefresh={() => reload()}
        columns={[
          {
            id: 'name',
            header: t('modelService.supplier.name'),
            cell: (supplier) => (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{supplier.name}</div>
                <div className="truncate font-mono text-xs text-ink-muted">{supplier.baseUrl}</div>
              </div>
            ),
          },
          {
            id: 'models',
            header: t('modelService.supplier.models'),
            cell: (supplier) =>
              supplier.models?.length ? (
                <span className="text-sm text-ink-muted">{supplier.models.join('、')}</span>
              ) : (
                <span className="text-sm text-ink-muted">{t('modelService.supplier.modelsEmpty')}</span>
              ),
          },
          {
            id: 'protocol',
            header: t('modelService.supplier.protocol'),
            cell: (supplier) => <Badge tone="neutral">{t(protocolKey(supplier.protocol))}</Badge>,
          },
          {
            id: 'kind',
            header: t('modelService.supplier.kind'),
            cell: (supplier) => (
              <span className="text-sm">
                {t(supplierKindKey(supplier.kind))}
                {supplier.kind === 'relay' && supplier.originVendors.length ? (
                  <span className="text-ink-muted"> · {supplier.originVendors.join(', ')}</span>
                ) : null}
              </span>
            ),
          },
          {
            id: 'key',
            header: 'API Key',
            cell: (supplier) => (
              <span className="font-mono text-xs text-ink-muted">
                {supplier.hasKey ? supplier.keyHint : t('modelService.supplier.noKey')}
              </span>
            ),
          },
          {
            id: 'status',
            header: t('modelService.supplier.status'),
            cell: (supplier) =>
              supplier.routable ? (
                <Badge tone="success">{t('modelService.supplier.routable')}</Badge>
              ) : (
                <Badge tone="neutral">
                  {supplier.enabled ? t('modelService.supplier.needsKey') : t('assets.status.disabled')}
                </Badge>
              ),
          },
          {
            id: 'actions',
            header: '',
            cell: (supplier) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/admin/suppliers/${supplier.id}/models`)}
                >
                  {t('modelService.action.models')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSupplierDialog({ supplier })}>
                  {t('modelService.action.edit')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPending(supplier)}>
                  {t('assets.action.delete')}
                </Button>
              </div>
            ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            title={t(searching ? 'modelService.emptyFiltered' : 'modelService.supplier.empty')}
            description={t(searching ? 'modelService.emptyFilteredHint' : 'modelService.supplier.emptyBody')}
            action={
              searching ? undefined : (
                <Button size="sm" onClick={() => setSupplierDialog({})}>
                  {t('modelService.supplier.create')}
                </Button>
              )
            }
          />
        }
      />
      <SupplierDialog
        open={supplierDialog !== null}
        onOpenChange={(open) => {
          if (!open) setSupplierDialog(null);
        }}
        supplier={supplierDialog?.supplier}
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
        description={t('modelService.supplier.deleteDesc')}
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={deleting}
        onConfirm={async () => {
          if (!pending) return;
          setDeleting(true);
          try {
            await deleteSupplier(pending.id);
            setPending(null);
            await reload();
          } catch (err) {
            failed(err);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
