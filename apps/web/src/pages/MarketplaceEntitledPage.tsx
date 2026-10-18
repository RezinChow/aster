import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Card,
  Badge,
  Button,
  ConsoleConfirmDialog,
  ConsoleEmptyState,
  ListToolbar,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import {
  entitledListings,
  isListingEntitled,
  providerById,
  revokeListing,
  type MarketListing,
  type ProviderHealth,
} from '@/data/marketplace';
import {
  getEntitlementCompileView,
  type CompileStatus,
} from '@/data/entitlementCompile';
import { isA3sMonitorSku } from '@/data/a3sMonitor';
import { useI18n } from '@/i18n/useI18n';
import { gatewayBaseUrl } from '@/lib/workConnect';

function healthTone(health: ProviderHealth): BadgeTone {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warn';
    case 'down':
      return 'danger';
  }
}

function compileTone(status: CompileStatus): BadgeTone {
  switch (status) {
    case 'compiled':
      return 'success';
    case 'pending':
      return 'warn';
    case 'stale':
      return 'warn';
    case 'failed':
      return 'danger';
  }
}

export function MarketplaceEntitledPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tick, setTick] = useState(0);
  const [pendingRevoke, setPendingRevoke] = useState<MarketListing | null>(
    null,
  );

  const allRows = useMemo(() => {
    void tick;
    return entitledListings();
  }, [tick]);

  const compile = useMemo(() => {
    void tick;
    return getEntitlementCompileView(allRows.length);
  }, [tick, allRows.length]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return allRows.filter((listing) => {
      if (!needle) return true;
      const provider = providerById(listing.providerId);
      return (
        listing.name.toLowerCase().includes(needle) ||
        listing.sku.toLowerCase().includes(needle) ||
        (provider?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [q, allRows]);

  const filteredEmpty = rows.length === 0 && q.trim() !== '';

  function onRevokeConfirm() {
    const listing = pendingRevoke;
    if (!listing || !isListingEntitled(listing.sku)) return;
    revokeListing(listing.sku);
    setTick((n) => n + 1);
    setPendingRevoke(null);
  }

  return (
    <AdminPageShell
      title={t('market.entitledTitle')}
      description={t('market.entitledDescription')}
      backTo="/admin/marketplace"
      crumbs={[
        { label: t('nav.marketplace'), to: '/marketplace' },
        { label: t('market.entitledTitle') },
      ]}
      actions={
        <Badge tone="warn">{t('market.compile.previewBadge')}</Badge>
      }
    >
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-ink">
            {t('market.compile.title')}
          </h2>
          <Badge tone={compileTone(compile.compileStatus)}>
            {t(`market.compile.status.${compile.compileStatus}`)}
          </Badge>
        </div>
        <dl className="mt-2 grid gap-1 text-xs text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-ink-faint">{t('market.compile.generation')}</dt>
            <dd className="font-mono text-ink">{compile.generation}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">{t('market.compile.snapshot')}</dt>
            <dd className="font-mono text-ink">
              {compile.snapshotRev ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">{t('market.compile.count')}</dt>
            <dd className="font-mono text-ink">{compile.entitledCount}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Gateway</dt>
            <dd className="truncate font-mono text-ink">{gatewayBaseUrl()}</dd>
          </div>
        </dl>
        {compile.lastError ? (
          <p className="mt-2 text-xs text-[color:var(--color-error)]">
            {compile.lastError}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-ink-faint">
          {t('market.compile.hint')}
        </p>
      </Card>

      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('market.search')}
        secondaryActions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate('/admin/assets/models')}
          >
            {t('market.compile.openConnect')}
          </Button>
        }
      />
      <I18nDataTable
        rows={rows}
        rowKey={(listing) => listing.id}
        onRefresh={() => setTick((n) => n + 1)}
        onRowClick={(listing) =>
          navigate(`/admin/marketplace/listings/${listing.id}`)
        }
        columns={[
          {
            id: 'name',
            header: t('market.col.name'),
            sortable: true,
            getSortValue: (listing) => listing.name,
            cell: (listing) => (
              <div>
                <Link
                  to={`/admin/marketplace/listings/${listing.id}`}
                  className="font-medium text-ink hover:opacity-80"
                  onClick={(e) => e.stopPropagation()}
                >
                  {listing.name}
                </Link>
                <div className="font-mono text-xs text-ink-muted">
                  {listing.sku}
                </div>
              </div>
            ),
          },
          {
            id: 'provider',
            header: t('market.col.provider'),
            cell: (listing) =>
              providerById(listing.providerId)?.name ?? '—',
          },
          {
            id: 'kind',
            header: t('market.col.kind'),
            cell: (listing) => (
              <Badge tone="neutral">{t(`market.kind.${listing.kind}`)}</Badge>
            ),
          },
          {
            id: 'price',
            header: t('market.col.price'),
            cell: (listing) => listing.priceLabel,
          },
          {
            id: 'health',
            header: t('market.col.health'),
            cell: (listing) => (
              <Badge tone={healthTone(listing.health)}>
                {t(`market.health.${listing.health}`)}
              </Badge>
            ),
          },
        ]}
        rowActions={(listing) => (
          <div className="flex flex-wrap items-center gap-1">
            {isA3sMonitorSku(listing.sku) ? (
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/admin/gateway');
                }}
              >
                {t('market.invokeGateway')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              type="button"
              className="!border-[color:var(--color-error)] !text-[color:var(--color-error)]"
              onClick={(e) => {
                e.stopPropagation();
                setPendingRevoke(listing);
              }}
            >
              {t('market.revoke')}
            </Button>
          </div>
        )}
        empty={
          <ConsoleEmptyState
            variant={filteredEmpty ? 'no-match' : 'no-data'}
            title={t('market.entitledEmpty.title')}
            description={t('market.entitledEmpty.description')}
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={filteredEmpty ? () => setQ('') : undefined}
            action={
              !filteredEmpty ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate('/admin/marketplace')}
                >
                  {t('market.backBrowse')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ConsoleConfirmDialog
        open={Boolean(pendingRevoke)}
        onOpenChange={(open) => {
          if (!open) setPendingRevoke(null);
        }}
        title={t('market.revoke')}
        description={t('market.revokeConfirm')}
        confirmLabel={t('market.revoke')}
        cancelLabel={t('market.cancel')}
        tone="danger"
        onConfirm={onRevokeConfirm}
      />
    </AdminPageShell>
  );
}
