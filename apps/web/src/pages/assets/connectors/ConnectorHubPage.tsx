import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, ConsoleConfirmDialog, ConsoleEmptyState, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  connectorFacets,
  deleteConnector,
  searchConnectors,
  setConnectorEnabled,
  type ConnectorCard,
  type ConnectorSort,
} from '@/lib/connectorHubApi';
import {
  AssetHubLayout,
  AssetMark,
  AssetSegment,
  FacetSection,
  facetOptions,
  type AssetTableRow,
} from '@/pages/assets/shared/AssetHub';
import { formatCount, formatDate } from '@/pages/assets/shared/format';
import { categoryLabel, deploymentLabel, transportLabel } from '@/pages/assets/shared/taxonomy';
import { useAssetListQuery } from '@/pages/assets/shared/useAssetListQuery';
import { settleIds, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { ConnectorDialog } from './ConnectorDialog';

const PAGE_SIZE = 50;
export const CONNECTORS_PATH = '/admin/assets/connectors';
const CONNECTOR_SORTS = ['recommended', 'installs', 'updated', 'name'] as const;
const CONNECTOR_FILTERS = ['category', 'deployment', 'transport', 'tag', 'status'] as const;

type Filters = { category: string; deployment: string; transport: string; tag: string; status: string };

export function ConnectorHubPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const listQuery = useAssetListQuery({
    sort: 'recommended',
    sorts: CONNECTOR_SORTS,
    filterKeys: CONNECTOR_FILTERS,
  });
  const filters = listQuery.filters as Filters;
  const sort = listQuery.sort as ConnectorSort;
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ConnectorCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = { q: listQuery.q, ...filters, sort, page: listQuery.page, pageSize: PAGE_SIZE };
  const list = useAssetQuery(JSON.stringify(query), () => searchConnectors(query));
  const facets = useAssetQuery('facets', connectorFacets);
  const update = (patch: Partial<Filters>) => listQuery.updateFilters(patch);

  const items = list.data?.items ?? [];
  const hasFilters = Boolean(listQuery.q) || Object.values(filters).some(Boolean);
  const refresh = () => {
    list.reload();
    facets.reload();
  };
  const report = (result: { ok: number; failed: number }, doneKey: 'assets.batch.deleted' | 'assets.batch.disabled') => {
    if (result.ok > 0) {
      toast.push({ tone: 'success', title: t(doneKey).replace('{count}', String(result.ok)) });
    }
    if (result.failed > 0) {
      toast.push({ tone: 'danger', title: t('assets.batch.failed').replace('{count}', String(result.failed)) });
    }
    refresh();
  };
  const removeMany = async (ids: string[]) => {
    report(await settleIds(ids, (id) => deleteConnector(id)), 'assets.batch.deleted');
  };
  const disableMany = async (ids: string[]) => {
    report(await settleIds(ids, (id) => setConnectorEnabled(id, false)), 'assets.batch.disabled');
  };
  const detailHref = (slug: string) => {
    const queryText = listQuery.query;
    return `${CONNECTORS_PATH}/${encodeURIComponent(slug)}${queryText ? `?${queryText}` : ''}`;
  };
  const rows: AssetTableRow[] = items.map((connector) => ({
    id: connector.slug,
    href: detailHref(connector.slug),
    title: connector.name,
    description: connector.description.trim(),
    badges:
      connector.featured || !connector.enabled ? (
        <>
          {connector.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
          {!connector.enabled ? <Badge tone="neutral">{t('assets.status.disabled')}</Badge> : null}
        </>
      ) : undefined,
    mark: (
      <AssetMark name={connector.name} color={connector.color} iconUrl={connector.iconUrl} size={32} />
    ),
    cells: [
      connector.provider || '—',
      categoryLabel(connector.category, locale),
      deploymentLabel(connector.deployment, locale),
      transportLabel(connector.transport, locale),
      formatCount(connector.installs, locale),
      formatDate(connector.updatedAt, locale),
    ],
    menu: [
      {
        id: 'status',
        label: t(connector.enabled ? 'assets.action.disable' : 'assets.action.enable'),
        onSelect: () => {
          void setConnectorEnabled(connector.slug, !connector.enabled)
            .then(refresh)
            .catch((err: unknown) => {
              toast.push({ tone: 'danger', title: err instanceof Error ? err.message : String(err) });
            });
        },
      },
      {
        id: 'delete',
        label: t('assets.action.delete'),
        tone: 'danger',
        separator: true,
        onSelect: () => setPendingDelete(connector),
      },
    ],
  }));

  const rail = (
    <>
      <FacetSection
        title={t('assets.field.category')}
        options={facetOptions(facets.data?.categories, (value) => categoryLabel(value, locale))}
        value={filters.category}
        onChange={(category) => update({ category })}
        limit={11}
      />
      <FacetSection
        title={t('assets.connectors.facet.deployment')}
        options={facetOptions(facets.data?.deployments, (value) => deploymentLabel(value, locale))}
        value={filters.deployment}
        onChange={(deployment) => update({ deployment })}
      />
      <FacetSection
        title={t('assets.connectors.field.transport')}
        options={facetOptions(facets.data?.transports, (value) => transportLabel(value, locale))}
        value={filters.transport}
        onChange={(transport) => update({ transport })}
      />
      <FacetSection
        title={t('assets.field.tags')}
        options={facetOptions(facets.data?.tags)}
        value={filters.tag}
        onChange={(tag) => update({ tag })}
      />
    </>
  );

  return (
    <AdminPageShell
      title={t('assets.connectors.title')}
      description={t('assets.connectors.desc')}
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <IconPlus />
          {t('assets.connectors.create')}
        </Button>
      }
    >
      <AssetHubLayout
        rail={rail}
        segment={
          <AssetSegment
            label={t('assets.facet.status')}
            value={filters.status}
            onChange={(status) => update({ status })}
            options={[
              { value: '', label: t('assets.facet.all') },
              { value: 'enabled', label: t('assets.status.enabled') },
              { value: 'disabled', label: t('assets.status.disabled') },
            ]}
          />
        }
        search={listQuery.search}
        onSearchChange={listQuery.setSearch}
        searchPlaceholder={t('assets.connectors.search')}
        sort={sort}
        sortOptions={[
          { value: 'recommended', label: t('assets.sort.recommended') },
          { value: 'installs', label: t('assets.sort.installs') },
          { value: 'updated', label: t('assets.sort.updated') },
          { value: 'name', label: t('assets.sort.name') },
        ]}
        onSortChange={(value) => listQuery.setSort(value || 'recommended')}
        total={list.data?.total ?? 0}
        loading={list.loading}
        error={list.error}
        isEmpty={items.length === 0}
        empty={
          <ConsoleEmptyState
            title={hasFilters ? t('assets.empty.filtered') : t('assets.connectors.empty')}
            action={
              hasFilters ? undefined : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  {t('assets.connectors.create')}
                </Button>
              )
            }
          />
        }
        page={listQuery.page}
        pageSize={PAGE_SIZE}
        onPageChange={listQuery.setPage}
        onReload={refresh}
        filtered={hasFilters}
        onReset={listQuery.reset}
        confirmHint={t('assets.batch.confirmHint')}
        columns={[
          { id: 'provider', header: t('assets.connectors.field.provider'), className: 'w-[140px]' },
          { id: 'category', header: t('assets.field.category'), className: 'w-[120px]' },
          { id: 'deployment', header: t('assets.connectors.facet.deployment'), className: 'w-[160px]' },
          { id: 'transport', header: t('assets.connectors.field.transport'), className: 'w-[140px]' },
          { id: 'installs', header: t('assets.stat.installs'), className: 'w-[88px]', align: 'right' },
          { id: 'updated', header: t('assets.stat.updated'), className: 'w-[120px]' },
        ]}
        rows={rows}
        batchActions={[
          {
            id: 'disable',
            label: t('assets.action.disable'),
            onClick: disableMany,
          },
          {
            id: 'delete',
            label: t('assets.action.delete'),
            danger: true,
            icon: <IconTrash className="size-4" />,
            onClick: removeMany,
          },
        ]}
      />
      <ConsoleConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        tone="danger"
        title={t('assets.danger.confirmTitle').replace('{name}', pendingDelete?.name ?? '')}
        description={t('assets.danger.confirmDesc')}
        confirmText={pendingDelete?.name}
        confirmHint={t('assets.danger.confirmHint').replace('{name}', pendingDelete?.name ?? '')}
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={deleting}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleting(true);
          try {
            await deleteConnector(pendingDelete.slug);
            toast.push({ tone: 'success', title: t('assets.action.delete') });
            setPendingDelete(null);
            refresh();
          } finally {
            setDeleting(false);
          }
        }}
      />
      <ConnectorDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(connector) => {
          toast.push({ tone: 'success', title: t('assets.toast.created') });
          navigate(`${CONNECTORS_PATH}/${encodeURIComponent(connector.slug)}`);
        }}
      />
    </AdminPageShell>
  );
}
