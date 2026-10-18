import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, ConsoleConfirmDialog, ConsoleEmptyState, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  agentFacets,
  deleteAgent,
  searchAgents,
  setAgentEnabled,
  type AgentCard,
  type AgentSort,
} from '@/lib/agentHubApi';
import {
  AssetHubLayout,
  AssetMark,
  AssetSegment,
  FacetSection,
  facetOptions,
  type AssetTableRow,
} from '@/pages/assets/shared/AssetHub';
import { formatDate } from '@/pages/assets/shared/format';
import { categoryLabel } from '@/pages/assets/shared/taxonomy';
import { useAssetListQuery } from '@/pages/assets/shared/useAssetListQuery';
import { settleIds, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { AcpCloudAgentCase } from './AcpCloudAgentCase';
import { AgentDialog } from './AgentDialog';

const PAGE_SIZE = 50;
export const AGENTS_PATH = '/admin/assets/agents';
const AGENT_SORTS = ['recommended', 'updated', 'name'] as const;
const AGENT_FILTERS = ['category', 'tag', 'status'] as const;

type Filters = { category: string; tag: string; status: string };

export function AgentHubPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const listQuery = useAssetListQuery({
    sort: 'recommended',
    sorts: AGENT_SORTS,
    filterKeys: AGENT_FILTERS,
  });
  const filters = listQuery.filters as Filters;
  const sort = listQuery.sort as AgentSort;
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AgentCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = { q: listQuery.q, ...filters, sort, page: listQuery.page, pageSize: PAGE_SIZE };
  const list = useAssetQuery(JSON.stringify(query), () => searchAgents(query));
  const facets = useAssetQuery('agent-facets', agentFacets);
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
    report(await settleIds(ids, (id) => deleteAgent(id)), 'assets.batch.deleted');
  };
  const disableMany = async (ids: string[]) => {
    report(await settleIds(ids, (id) => setAgentEnabled(id, false)), 'assets.batch.disabled');
  };
  const detailHref = (slug: string) => {
    const queryText = listQuery.query;
    return `${AGENTS_PATH}/${encodeURIComponent(slug)}${queryText ? `?${queryText}` : ''}`;
  };
  const rows: AssetTableRow[] = items.map((agent) => ({
    id: agent.slug,
    href: detailHref(agent.slug),
    title: agent.name,
    description: agent.description.trim(),
    badges:
      agent.featured || !agent.enabled ? (
        <>
          {agent.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
          {!agent.enabled ? <Badge tone="neutral">{t('assets.status.disabled')}</Badge> : null}
        </>
      ) : undefined,
    mark: <AssetMark name={agent.emoji || agent.name} color={agent.color} size={32} />,
    cells: [categoryLabel(agent.category, locale), formatDate(agent.updatedAt, locale)],
    menu: [
      {
        id: 'status',
        label: t(agent.enabled ? 'assets.action.disable' : 'assets.action.enable'),
        onSelect: () => {
          void setAgentEnabled(agent.slug, !agent.enabled)
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
        onSelect: () => setPendingDelete(agent),
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
        title={t('assets.field.tags')}
        options={facetOptions(facets.data?.tags)}
        value={filters.tag}
        onChange={(tag) => update({ tag })}
      />
    </>
  );

  return (
    <AdminPageShell
      title={t('assets.agents.title')}
      description={t('assets.agents.desc')}
      actions={
        <>
          <AcpCloudAgentCase onRegistered={refresh} />
          <Button size="sm" onClick={() => setCreating(true)}>
            <IconPlus />
            {t('assets.agents.create')}
          </Button>
        </>
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
        searchPlaceholder={t('assets.agents.search')}
        sort={sort}
        sortOptions={[
          { value: 'recommended', label: t('assets.sort.recommended') },
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
            title={hasFilters ? t('assets.empty.filtered') : t('assets.agents.empty')}
            action={
              hasFilters ? undefined : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  {t('assets.agents.create')}
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
          { id: 'category', header: t('assets.field.category'), className: 'w-[140px]' },
          { id: 'updated', header: t('assets.stat.updated'), className: 'w-[140px]' },
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
            await deleteAgent(pendingDelete.slug);
            toast.push({ tone: 'success', title: t('assets.action.delete') });
            setPendingDelete(null);
            refresh();
          } finally {
            setDeleting(false);
          }
        }}
      />
      <AgentDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(agent) => {
          toast.push({ tone: 'success', title: t('assets.toast.created') });
          navigate(`${AGENTS_PATH}/${encodeURIComponent(agent.slug)}`);
        }}
      />
    </AdminPageShell>
  );
}
