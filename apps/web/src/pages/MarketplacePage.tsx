import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  ConsoleEmptyState,
  FilterChip,
  ListToolbar,
  MetaSummary,
  SearchSelect,
  type BadgeTone,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import {
  isListingEntitled,
  listingText,
  marketListings,
  marketProviders,
  providerById,
  type ListingKind,
  type ProviderHealth,
} from '@/data/marketplace';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

const KIND_FILTERS: Array<{ value: 'all' | ListingKind; labelKey: MessageKey }> =
  [
    { value: 'all', labelKey: 'market.kind.all' },
    { value: 'model', labelKey: 'market.kind.model' },
    { value: 'tool', labelKey: 'market.kind.tool' },
    { value: 'api', labelKey: 'market.kind.api' },
    { value: 'feed', labelKey: 'market.kind.feed' },
  ];

const LISTING_KINDS = new Set<ListingKind>([
  'model',
  'tool',
  'api',
  'feed',
]);

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

function kindFromSearch(raw: string | null): 'all' | ListingKind {
  if (raw && LISTING_KINDS.has(raw as ListingKind)) return raw as ListingKind;
  return 'all';
}

export function MarketplacePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | ListingKind>(() =>
    kindFromSearch(searchParams.get('kind')),
  );
  const [providerId, setProviderId] = useState<'all' | string>('all');
  const [entitledOnly, setEntitledOnly] = useState(false);

  function selectKind(next: 'all' | ListingKind) {
    setKind(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('kind');
    else params.set('kind', next);
    setSearchParams(params, { replace: true });
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return marketListings.filter((listing) => {
      if (kind !== 'all' && listing.kind !== kind) return false;
      if (providerId !== 'all' && listing.providerId !== providerId) return false;
      if (entitledOnly && !isListingEntitled(listing.sku)) return false;
      if (!needle) return true;
      const provider = providerById(listing.providerId);
      return (
        listingText(listing, locale, 'name').toLowerCase().includes(needle) ||
        listing.name.toLowerCase().includes(needle) ||
        (listing.en?.name.toLowerCase().includes(needle) ?? false) ||
        listing.sku.toLowerCase().includes(needle) ||
        listingText(listing, locale, 'summary').toLowerCase().includes(needle) ||
        listing.summary.toLowerCase().includes(needle) ||
        (provider?.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [q, kind, providerId, entitledOnly, locale]);

  const filtersActive =
    q.trim() !== '' ||
    kind !== 'all' ||
    providerId !== 'all' ||
    entitledOnly;

  const entitledCount = marketListings.filter((l) =>
    isListingEntitled(l.sku),
  ).length;

  return (
    <AdminPageShell
      title={t('market.title')}
      description={t('market.description')}
    >
      <MetaSummary
        aria-label={t('market.title')}
        items={[
          {
            id: 'listings',
            label: t('market.stat.listings'),
            value: marketListings.length,
          },
          {
            id: 'providers',
            label: t('market.stat.providers'),
            value: marketProviders.length,
          },
          {
            id: 'entitled',
            label: t('market.stat.entitled'),
            value: entitledCount,
          },
        ]}
      />
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('market.search')}
        secondaryActions={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/marketplace/entitled')}
            >
              {t('market.openEntitled')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => navigate('/admin/marketplace/providers/prov_a3s_monitor')}
            >
              {t('market.openMonitorProvider')}
            </Button>
          </>
        }
        primaryAction={
          <Button
            type="button"
            size="sm"
            onClick={() => navigate('/admin/marketplace/providers/new')}
          >
            {t('market.addProvider')}
          </Button>
        }
        filters={
          <>
            <div
              className="inline-flex h-[30px] flex-wrap items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
              role="group"
              aria-label={t('market.filterKind')}
            >
              {KIND_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.value}
                  inset
                  label={t(filter.labelKey)}
                  active={kind === filter.value}
                  onClick={() => selectKind(filter.value)}
                />
              ))}
            </div>
            <SearchSelect
              size="sm"
              className="w-[11rem] shrink-0"
              aria-label={t('market.filterProvider')}
              value={providerId}
              onChange={setProviderId}
              options={[
                {
                  value: 'all',
                  label: t('market.provider.all'),
                },
                ...marketProviders.map((provider) => ({
                  value: provider.id,
                  label: `${provider.name} · ${provider.listingCount}`,
                })),
              ]}
              placeholder={t('market.provider.all')}
            />
            <FilterChip
              label={t('market.filterEntitled')}
              count={entitledCount}
              active={entitledOnly}
              onClick={() => setEntitledOnly((v) => !v)}
            />
          </>
        }
      />

      {rows.length === 0 ? (
        <ConsoleEmptyState
          variant={filtersActive ? 'no-match' : 'no-data'}
          title={t('market.empty.title')}
          description={t('market.empty.description')}
          clearFiltersLabel={t('admin.empty.clearFilters')}
          onClearFilters={
            filtersActive
              ? () => {
                  setQ('');
                  selectKind('all');
                  setProviderId('all');
                  setEntitledOnly(false);
                }
              : undefined
          }
        />
      ) : (
        <div className="os-market-grid">
          {rows.map((listing) => {
            const provider = providerById(listing.providerId);
            const entitled = isListingEntitled(listing.sku);
            return (
              <article key={listing.id} className="ui-card os-market-card">
                <div className="os-market-card__top">
                  <Badge tone="neutral">{t(`market.kind.${listing.kind}`)}</Badge>
                  <Badge tone={healthTone(listing.health)}>
                    {t(`market.health.${listing.health}`)}
                  </Badge>
                </div>
                <h3 className="os-market-card__title">
                  <Link to={`/admin/marketplace/listings/${listing.id}`}>
                    {listingText(listing, locale, 'name')}
                  </Link>
                </h3>
                <p className="os-market-card__sku">{listing.sku}</p>
                <p className="os-market-card__provider">
                  {provider ? (
                    <Link
                      to={`/admin/marketplace/providers/${provider.id}`}
                      className="hover:opacity-80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {provider.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
                <p className="os-market-card__summary">
                  {listingText(listing, locale, 'summary')}
                </p>
                <div className="os-market-card__foot">
                  <span className="os-market-card__price">{listing.priceLabel}</span>
                  {entitled ? (
                    <Badge tone="success">{t('market.badge.entitled')}</Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => navigate(`/admin/marketplace/listings/${listing.id}`)}
                    >
                      {t('market.entitle')}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
