import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge, Button, ConsoleConfirmDialog, ConsoleEmptyState, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  PLUGIN_CATEGORIES,
  currentNamespace,
  deletePlugin,
  pluginCategoryKey,
  pluginFacets,
  pluginId,
  searchPlugins,
  setPluginEnabled,
  type PluginCard,
  type PluginSort,
} from '@/lib/pluginHubApi';
import {
  AssetHubLayout,
  AssetMark,
  AssetSegment,
  FacetSection,
  facetOptions,
  type AssetTableRow,
} from '@/pages/assets/shared/AssetHub';
import { formatCount, formatDate } from '@/pages/assets/shared/format';
import { useAssetListQuery } from '@/pages/assets/shared/useAssetListQuery';
import { settleIds, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { PluginDialog } from '@/pages/assets/plugins/PluginDialog';

const PAGE_SIZE = 50;
const APPLET_SURFACE = 'ui';
const APPLET_SURFACES = [APPLET_SURFACE] as const;
export const APPLETS_PATH = '/admin/assets/applets';
const APPLET_SORTS = ['recommended', 'installs', 'updated', 'name'] as const;
const APPLET_FILTERS = ['category', 'status'] as const;

type Filters = { category: string; status: string };

function isCategory(value: string): value is PluginCard['category'] {
  return (PLUGIN_CATEGORIES as readonly string[]).includes(value);
}

function categoryName(value: string, t: ReturnType<typeof useI18n>['t']): string {
  return isCategory(value) ? t(pluginCategoryKey(value)) : value;
}

export function AppletHubPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const namespaceScope = params.get('scope') === 'member' ? 'member' : 'org';
  const toast = useToast();
  const listQuery = useAssetListQuery({
    sort: 'recommended',
    sorts: APPLET_SORTS,
    filterKeys: APPLET_FILTERS,
  });
  const filters = listQuery.filters as Filters;
  const sort = listQuery.sort as PluginSort;
  const [creating, setCreating] = useState(false);
  const [home, setHome] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PluginCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = {
    q: listQuery.q,
    category: filters.category,
    status: filters.status,
    surface: APPLET_SURFACE,
    sort,
    page: listQuery.page,
    pageSize: PAGE_SIZE,
  };
  const list = useAssetQuery(JSON.stringify(query), () => searchPlugins(query));
  const facets = useAssetQuery('applet-facets', () => pluginFacets(APPLET_SURFACE));
  const update = (patch: Partial<Filters>) => listQuery.updateFilters(patch);

  useEffect(() => {
    let live = true;
    currentNamespace(namespaceScope)
      .then((row) => {
        if (live) setHome(row.name ?? null);
      })
      .catch(() => {
        if (live) setHome(null);
      });
    return () => {
      live = false;
    };
  }, [namespaceScope]);
  const items = (list.data?.items ?? []).filter((plugin) => !home || plugin.publisher === home);
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
    report(
      await settleIds(ids, (id) => {
        const plugin = items.find((item) => pluginId(item) === id);
        return plugin ? deletePlugin(plugin.publisher, plugin.name) : Promise.reject(new Error(id));
      }),
      'assets.batch.deleted',
    );
  };
  const disableMany = async (ids: string[]) => {
    report(
      await settleIds(ids, (id) => {
        const plugin = items.find((item) => pluginId(item) === id);
        return plugin ? setPluginEnabled(plugin.publisher, plugin.name, false) : Promise.reject(new Error(id));
      }),
      'assets.batch.disabled',
    );
  };
  const detailHref = (plugin: PluginCard) => {
    const queryText = listQuery.query;
    return `${APPLETS_PATH}/${encodeURIComponent(plugin.publisher)}/${encodeURIComponent(plugin.name)}${queryText ? `?${queryText}` : ''}`;
  };
  const rows: AssetTableRow[] = items.map((plugin) => ({
    id: pluginId(plugin),
    href: detailHref(plugin),
    title: plugin.title?.trim() || plugin.name,
    description: plugin.description.trim(),
    badges:
      plugin.featured || !plugin.enabled ? (
        <>
          {plugin.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
          {!plugin.enabled ? <Badge tone="neutral">{t('assets.status.disabled')}</Badge> : null}
        </>
      ) : undefined,
    mark: <AssetMark name={plugin.title?.trim() || plugin.name} color={plugin.color} iconUrl={plugin.logoUrl} size={32} />,
    cells: [
      plugin.publisher,
      plugin.version,
      categoryName(plugin.category, t),
      formatCount(plugin.installs, locale),
      formatDate(plugin.updatedAt, locale),
    ],
    menu: [
      {
        id: 'status',
        label: t(plugin.enabled ? 'assets.action.disable' : 'assets.action.enable'),
        onSelect: () => {
          void setPluginEnabled(plugin.publisher, plugin.name, !plugin.enabled)
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
        onSelect: () => setPendingDelete(plugin),
      },
    ],
  }));

  const rail = (
    <FacetSection
      title={t('assets.plugins.field.category')}
      options={facetOptions(facets.data?.categories, (value) => categoryName(value, t))}
      value={filters.category}
      onChange={(category) => update({ category })}
    />
  );

  return (
    <AdminPageShell
      title={t('assets.applets.title')}
      description={t('assets.applets.desc')}
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <IconPlus />
          {t('assets.applets.create')}
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
        searchPlaceholder={t('assets.applets.search')}
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
            title={hasFilters ? t('assets.empty.filtered') : t('assets.applets.empty')}
            action={
              hasFilters ? undefined : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  {t('assets.applets.create')}
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
          { id: 'publisher', header: t('assets.plugins.field.publisher'), className: 'w-[140px]' },
          { id: 'version', header: t('assets.plugins.field.version'), className: 'w-[120px]' },
          { id: 'category', header: t('assets.plugins.field.category'), className: 'w-[140px]' },
          { id: 'installs', header: t('assets.stat.installs'), className: 'w-[88px]', align: 'right' },
          { id: 'updated', header: t('assets.stat.updated'), className: 'w-[120px]' },
        ]}
        rows={rows}
        batchActions={[
          { id: 'disable', label: t('assets.action.disable'), onClick: disableMany },
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
        title={t('assets.danger.confirmTitle').replace('{name}', pendingDelete ? pluginId(pendingDelete) : '')}
        description={t('assets.applets.danger.desc')}
        confirmText={pendingDelete ? pluginId(pendingDelete) : ''}
        confirmHint={t('assets.danger.confirmHint').replace('{name}', pendingDelete ? pluginId(pendingDelete) : '')}
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={deleting}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleting(true);
          try {
            await deletePlugin(pendingDelete.publisher, pendingDelete.name);
            toast.push({ tone: 'success', title: t('assets.action.delete') });
            setPendingDelete(null);
            refresh();
          } finally {
            setDeleting(false);
          }
        }}
      />
      <PluginDialog
        open={creating}
        namespaceScope={namespaceScope}
        onOpenChange={setCreating}
        fixedSurfaces={APPLET_SURFACES}
        labels={{
          create: t('assets.applets.create'),
          edit: t('assets.applets.edit'),
          description: t('assets.applets.createDesc'),
        }}
        onSaved={(plugin) => {
          toast.push({ tone: 'success', title: t('assets.toast.created') });
          navigate(detailHref(plugin));
        }}
      />
    </AdminPageShell>
  );
}
