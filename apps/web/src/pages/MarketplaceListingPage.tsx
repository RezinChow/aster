import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Checkbox,
  ConsoleConfirmDialog,
  DescriptionList,
  ConsoleDialog,
  ResourceMetaHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BadgeTone,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import {
  entitleListing,
  isListingEntitled,
  listingById,
  listingText,
  providerById,
  revokeListing,
  type ProviderHealth,
} from '@/data/marketplace';
import { gatewayInvokeListing } from '@/data/gatewayInvoke';
import { isA3sMonitorSku } from '@/data/a3sMonitor';
import { upstreamOpForSku } from '@/data/worldMonitorUpstream';
import { useI18n } from '@/i18n/useI18n';

type Tab = 'overview' | 'contract' | 'pricing' | 'probe';

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

export function MarketplaceListingPage() {
  const { id = '' } = useParams();
  const { t, locale } = useI18n();
  const listing = listingById(id);
  const [tab, setTab] = useState<Tab>('overview');
  const [tick, setTick] = useState(0);
  const [probeOut, setProbeOut] = useState<string | null>(null);
  const [tos, setTos] = useState(false);
  const [entitleOpen, setEntitleOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const entitled = useMemo(() => {
    void tick;
    return listing ? isListingEntitled(listing.sku) : false;
  }, [listing, tick]);

  if (!listing) {
    return <Navigate to="/admin/marketplace" replace />;
  }

  const listingName = listingText(listing, locale, 'name');
  const listingSummary = listingText(listing, locale, 'summary');

  const provider = providerById(listing.providerId);

  function onRevokeConfirm() {
    if (!listing) return;
    revokeListing(listing.sku);
    setTick((n) => n + 1);
    setRevokeOpen(false);
  }

  return (
    <AdminPageShell
      title={listingName}
      description={`${provider?.name ?? '—'} · ${listing.sku}`}
      backTo="/admin/marketplace"
      crumbs={[
        { label: t('nav.marketplace'), to: '/marketplace' },
        { label: listingName },
      ]}
      actions={
        <>
          {entitled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="!border-[color:var(--color-error)] !text-[color:var(--color-error)]"
              onClick={() => setRevokeOpen(true)}
            >
              {t('market.revoke')}
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => setEntitleOpen(true)}>
              {t('market.entitle')}
            </Button>
          )}
        </>
      }
    >
      <ResourceMetaHeader
        title={listingName}
        badge={
          <>
            <Badge tone="neutral">{t(`market.kind.${listing.kind}`)}</Badge>
            <Badge tone={healthTone(listing.health)}>
              {t(`market.health.${listing.health}`)}
            </Badge>
            {entitled ? (
              <Badge tone="success">{t('market.badge.entitled')}</Badge>
            ) : (
              <Badge tone="neutral">{t('market.badge.notEntitled')}</Badge>
            )}
          </>
        }
        summary={[
          {
            id: 'provider',
            label: t('market.col.provider'),
            value: provider?.name ?? '—',
          },
          {
            id: 'price',
            label: t('market.col.price'),
            value: listing.priceLabel,
          },
          { id: 'sku', label: 'SKU', value: listing.sku },
        ]}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList aria-label={listingName}>
          <TabsTrigger value="overview">{t('market.tab.overview')}</TabsTrigger>
          <TabsTrigger value="contract">{t('market.tab.contract')}</TabsTrigger>
          <TabsTrigger value="pricing">{t('market.tab.pricing')}</TabsTrigger>
          <TabsTrigger value="probe">{t('market.tab.probe')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3 space-y-3">
          <DescriptionList
            items={[
              { label: t('market.tab.overview'), value: listingSummary },
              { label: t('market.field.upstream'), value: listing.upstream },
              {
                label: t('market.field.provider'),
                value: `${provider?.name ?? '—'} (${provider?.adapter ?? '—'})`,
              },
            ]}
          />
          {listing.kind === 'model' && entitled ? (
            <Link
              to="/admin/assets/models"
              className="text-sm hover:opacity-80"
            >
              {t('market.linkInference')}
            </Link>
          ) : null}
        </TabsContent>

        <TabsContent value="contract" className="mt-3">
          <pre className="os-market-code">{`// MCP / OpenAPI sketch
tool: ${listingName}
sku: ${listing.sku}
provider: ${provider?.name}
envelope: source | as_of | confidence
`}</pre>
        </TabsContent>

        <TabsContent value="pricing" className="mt-3 space-y-2 text-sm">
          <p>{t('market.pricing.hint')}</p>
          <p>
            <strong>{listing.priceLabel}</strong>
          </p>
          <p className="text-ink-muted">{t('market.pricing.noWallet')}</p>
        </TabsContent>

        <TabsContent value="probe" className="mt-3 space-y-3">
          <p className="text-sm text-ink-muted">
            {isA3sMonitorSku(listing.sku)
              ? t('market.probe.hintGateway')
              : t('market.probe.hint')}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={!entitled}
            title={entitled ? undefined : t('market.probe.needEntitle')}
            onClick={() => {
              void (async () => {
                if (isA3sMonitorSku(listing.sku)) {
                  const res = await gatewayInvokeListing({
                    sku: listing.sku,
                    input: upstreamOpForSku(listing.sku).sampleInput,
                    credentialPrefix: 'a3s_sk_work',
                  });
                  setProbeOut(JSON.stringify(res, null, 2));
                  return;
                }
                setProbeOut(
                  JSON.stringify(
                    {
                      ok: true,
                      sku: listing.sku,
                      billed: listing.pricingMode === 'per_call' ? 1 : 'tokens',
                      as_of: new Date().toISOString(),
                      source: provider?.name,
                    },
                    null,
                    2,
                  ),
                );
              })();
            }}
          >
            {t('market.probe.send')}
          </Button>
          {probeOut ? <pre className="os-market-code">{probeOut}</pre> : null}
        </TabsContent>
      </Tabs>

      <ConsoleDialog
        open={entitleOpen}
        onOpenChange={(open) => {
          setEntitleOpen(open);
          if (!open) setTos(false);
        }}
        title={t('market.entitleTitle')}
        footer={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEntitleOpen(false);
                setTos(false);
              }}
            >
              {t('market.cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!tos}
              onClick={() => {
                entitleListing(listing.sku);
                setEntitleOpen(false);
                setTos(false);
                setTick((n) => n + 1);
              }}
            >
              {t('market.entitleConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {t('market.entitleBody')} {listingName} · {listing.priceLabel}
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
          <Checkbox checked={tos} onCheckedChange={(checked) => setTos(checked === true)} />
          {t('market.entitleTos')}
        </label>
      </ConsoleDialog>

      <ConsoleConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
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
