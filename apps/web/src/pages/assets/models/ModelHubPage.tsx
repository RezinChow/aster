import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, ConsoleConfirmDialog, ConsoleEmptyState, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconDownload, IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  deleteModel,
  modelFacets,
  modelTasks,
  searchModels,
  type HubModelCard,
  type ModelSort,
} from '@/lib/modelHubApi';
import {
  AssetHubLayout,
  AssetMark,
  AssetSegment,
  FacetSection,
  facetOptions,
  type AssetTableRow,
} from '@/pages/assets/shared/AssetHub';
import { formatBytes, formatCount, formatDate } from '@/pages/assets/shared/format';
import {
  TASK_DOMAIN_ORDER,
  hubLabel,
  modelDomainColor,
  taskDomainLabel,
  taskLabel,
} from '@/pages/assets/shared/taxonomy';
import { useAssetListQuery } from '@/pages/assets/shared/useAssetListQuery';
import { settleIds, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { ModelCreateDialog, ModelImportDialog } from './ModelDialogs';

const PAGE_SIZE = 50;
const MODEL_SORTS = ['popular', 'downloads', 'likes', 'updated', 'created'] as const;
const MODEL_FILTERS = ['domain', 'task', 'framework', 'license', 'language', 'origin', 'visibility'] as const;

type Filters = {
  domain: string;
  task: string;
  framework: string;
  license: string;
  language: string;
  origin: string;
  visibility: string;
};

export function modelDetailPath(model: Pick<HubModelCard, 'owner' | 'name'>): string {
  return `/admin/assets/models/${encodeURIComponent(model.owner)}/${encodeURIComponent(model.name)}`;
}

export function ModelHubPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const listQuery = useAssetListQuery({
    sort: 'popular',
    sorts: MODEL_SORTS,
    filterKeys: MODEL_FILTERS,
  });
  const filters = listQuery.filters as Filters;
  const sort = listQuery.sort as ModelSort;
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HubModelCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = { q: listQuery.q, ...filters, sort, page: listQuery.page, pageSize: PAGE_SIZE };
  const list = useAssetQuery(JSON.stringify(query), () => searchModels(query));
  const facets = useAssetQuery('facets', modelFacets);
  const tasks = useAssetQuery('tasks', modelTasks);

  const update = (patch: Partial<Filters>) => listQuery.updateFilters(patch);

  const taskCounts = useMemo(
    () => new Map((facets.data?.tasks ?? []).map((facet) => [facet.value, facet.count])),
    [facets.data],
  );

  const taskOptions = useMemo(() => {
    const groups = tasks.data ?? [];
    const visible = filters.domain
      ? groups.filter((group) => group.domain === filters.domain)
      : groups;
    return visible
      .flatMap((group) => group.tasks)
      .filter((task) => taskCounts.has(task) || task === filters.task)
      .map((task) => ({ value: task, label: taskLabel(task, locale), count: taskCounts.get(task) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [tasks.data, filters.domain, filters.task, taskCounts, locale]);

  const sortOptions = [
    { value: 'popular', label: t('assets.models.sort.popular') },
    { value: 'downloads', label: t('assets.models.sort.downloads') },
    { value: 'likes', label: t('assets.models.sort.likes') },
    { value: 'updated', label: t('assets.models.sort.updated') },
    { value: 'created', label: t('assets.models.sort.created') },
  ];

  const items = list.data?.items ?? [];
  const hasFilters = Boolean(listQuery.q) || Object.values(filters).some(Boolean);
  const refresh = () => {
    list.reload();
    facets.reload();
  };
  const removeMany = async (ids: string[]) => {
    const result = await settleIds(ids, (id) => {
      const model = items.find((item) => item.id === id);
      return model ? deleteModel(model.owner, model.name) : Promise.reject(new Error('missing'));
    });
    if (result.ok > 0) {
      toast.push({ tone: 'success', title: t('assets.batch.deleted').replace('{count}', String(result.ok)) });
    }
    if (result.failed > 0) {
      toast.push({ tone: 'danger', title: t('assets.batch.failed').replace('{count}', String(result.failed)) });
    }
    refresh();
  };
  const detailHref = (model: HubModelCard) => {
    const queryText = listQuery.query;
    return `${modelDetailPath(model)}${queryText ? `?${queryText}` : ''}`;
  };
  const rows: AssetTableRow[] = items.map((model) => ({
    id: model.id,
    href: detailHref(model),
    title: `${model.owner}/${model.name}`,
    description: model.summary.trim(),
    badges:
      model.visibility === 'private' ? (
        <Badge tone="neutral">{t('assets.models.visibility.private')}</Badge>
      ) : undefined,
    mark: <AssetMark name={model.name} color={modelDomainColor(model.domain)} size={32} />,
    cells: [
      taskLabel(model.task, locale) || '—',
      model.license || '—',
      model.source ? hubLabel(model.source.hub, locale) : t('assets.models.origin.local'),
      formatCount(model.downloads, locale),
      formatBytes(model.size),
      formatDate(model.updatedAt, locale),
    ],
    menu: [
      {
        id: 'delete',
        label: t('assets.action.delete'),
        tone: 'danger',
        onSelect: () => setPendingDelete(model),
      },
    ],
  }));

  const rail = (
    <>
      <FacetSection
        title={t('assets.models.facet.domain')}
        options={TASK_DOMAIN_ORDER.map((domain) => ({
          value: domain,
          label: taskDomainLabel(domain, locale),
        }))}
        value={filters.domain}
        onChange={(domain) => update({ domain, task: '' })}
      />
      <FacetSection
        title={t('assets.models.facet.task')}
        options={taskOptions}
        value={filters.task}
        onChange={(task) => update({ task })}
      />
      <FacetSection
        title={t('assets.models.facet.framework')}
        options={facetOptions(facets.data?.frameworks)}
        value={filters.framework}
        onChange={(framework) => update({ framework })}
      />
      <FacetSection
        title={t('assets.models.facet.license')}
        options={facetOptions(facets.data?.licenses)}
        value={filters.license}
        onChange={(license) => update({ license })}
      />
      <FacetSection
        title={t('assets.models.facet.language')}
        options={facetOptions(facets.data?.languages)}
        value={filters.language}
        onChange={(language) => update({ language })}
      />
      <FacetSection
        title={t('assets.models.facet.origin')}
        options={[
          { value: 'huggingface', label: hubLabel('huggingface', locale) },
          { value: 'modelscope', label: hubLabel('modelscope', locale) },
          { value: 'local', label: t('assets.models.origin.local') },
        ]}
        value={filters.origin}
        onChange={(origin) => update({ origin })}
      />
    </>
  );

  return (
    <AdminPageShell
      title={t('assets.models.title')}
      description={t('assets.models.desc')}
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
            <IconDownload />
            {t('assets.models.import')}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <IconPlus />
            {t('assets.models.create')}
          </Button>
        </>
      }
    >
      <AssetHubLayout
        rail={rail}
        segment={
          <AssetSegment
            label={t('assets.models.facet.visibility')}
            value={filters.visibility}
            onChange={(visibility) => update({ visibility })}
            options={[
              { value: '', label: t('assets.facet.all') },
              { value: 'public', label: t('assets.models.visibility.public') },
              { value: 'private', label: t('assets.models.visibility.private') },
            ]}
          />
        }
        search={listQuery.search}
        onSearchChange={listQuery.setSearch}
        searchPlaceholder={t('assets.models.search')}
        sort={sort}
        sortOptions={sortOptions}
        onSortChange={(value) => listQuery.setSort(value || 'popular')}
        total={list.data?.total ?? 0}
        loading={list.loading}
        error={list.error}
        isEmpty={items.length === 0}
        empty={
          <ConsoleEmptyState
            title={hasFilters ? t('assets.empty.filtered') : t('assets.models.empty')}
            description={hasFilters ? undefined : t('assets.models.emptyHint')}
            action={
              hasFilters ? undefined : (
                <Button size="sm" onClick={() => setImporting(true)}>
                  {t('assets.models.import')}
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
          { id: 'task', header: t('assets.models.facet.task'), className: 'w-[140px]' },
          { id: 'license', header: t('assets.models.facet.license'), className: 'w-[120px]' },
          { id: 'origin', header: t('assets.models.facet.origin'), className: 'w-[140px]' },
          { id: 'downloads', header: t('assets.stat.downloads'), className: 'w-[88px]', align: 'right' },
          { id: 'size', header: t('assets.stat.size'), className: 'w-[88px]', align: 'right' },
          { id: 'updated', header: t('assets.stat.updated'), className: 'w-[120px]' },
        ]}
        rows={rows}
        batchActions={[
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
        title={t('assets.danger.confirmTitle').replace('{name}', pendingDelete ? `${pendingDelete.owner}/${pendingDelete.name}` : '')}
        description={t('assets.danger.confirmDesc')}
        confirmText={pendingDelete ? `${pendingDelete.owner}/${pendingDelete.name}` : undefined}
        confirmHint={
          pendingDelete
            ? t('assets.danger.confirmHint').replace('{name}', `${pendingDelete.owner}/${pendingDelete.name}`)
            : undefined
        }
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        loading={deleting}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setDeleting(true);
          try {
            await deleteModel(pendingDelete.owner, pendingDelete.name);
            toast.push({ tone: 'success', title: t('assets.action.delete') });
            setPendingDelete(null);
            refresh();
          } finally {
            setDeleting(false);
          }
        }}
      />
      <ModelCreateDialog
        open={creating}
        onOpenChange={setCreating}
        taskGroups={tasks.data ?? []}
        onCreated={(model) => {
          toast.push({ tone: 'success', title: t('assets.toast.created') });
          navigate(modelDetailPath(model));
        }}
      />
      <ModelImportDialog
        open={importing}
        onOpenChange={setImporting}
        onImported={(model) => {
          toast.push({ tone: 'success', title: t('assets.models.toast.imported') });
          navigate(modelDetailPath(model));
        }}
      />
    </AdminPageShell>
  );
}
