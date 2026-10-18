import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, ConsoleConfirmDialog, ConsoleEmptyState, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconDownload, IconPlus, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { saveDownload } from '@/lib/assetHubApi';
import {
  deleteSkill,
  downloadSkillPackage,
  searchSkills,
  setSkillEnabled,
  skillFacets,
  type SkillCard,
  type SkillSort,
} from '@/lib/skillHubApi';
import {
  AssetHubLayout,
  AssetMark,
  AssetSegment,
  FacetSection,
  facetOptions,
  type AssetTableRow,
} from '@/pages/assets/shared/AssetHub';
import { formatBytes, formatCount, formatDate } from '@/pages/assets/shared/format';
import { categoryLabel } from '@/pages/assets/shared/taxonomy';
import { useAssetListQuery } from '@/pages/assets/shared/useAssetListQuery';
import { settleIds, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { SkillDialog } from './SkillDialog';

const PAGE_SIZE = 50;
export const SKILLS_PATH = '/admin/assets/skills';
const SKILL_SORTS = ['recommended', 'installs', 'updated', 'name'] as const;
const SKILL_FILTERS = ['category', 'author', 'tag', 'status'] as const;

type Filters = { category: string; author: string; tag: string; status: string };

export function SkillHubPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const listQuery = useAssetListQuery({
    sort: 'recommended',
    sorts: SKILL_SORTS,
    filterKeys: SKILL_FILTERS,
  });
  const filters = listQuery.filters as Filters;
  const sort = listQuery.sort as SkillSort;
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SkillCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = { q: listQuery.q, ...filters, sort, page: listQuery.page, pageSize: PAGE_SIZE };
  const list = useAssetQuery(JSON.stringify(query), () => searchSkills(query));
  const facets = useAssetQuery('facets', skillFacets);
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
    report(await settleIds(ids, (id) => deleteSkill(id)), 'assets.batch.deleted');
  };
  const disableMany = async (ids: string[]) => {
    report(await settleIds(ids, (id) => setSkillEnabled(id, false)), 'assets.batch.disabled');
  };
  const detailHref = (slug: string) => {
    const queryText = listQuery.query;
    return `${SKILLS_PATH}/${encodeURIComponent(slug)}${queryText ? `?${queryText}` : ''}`;
  };
  const rows: AssetTableRow[] = items.map((skill) => ({
    id: skill.slug,
    href: detailHref(skill.slug),
    title: skill.name,
    description: skill.description.trim(),
    badges:
      skill.featured || !skill.enabled ? (
        <>
          {skill.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
          {!skill.enabled ? <Badge tone="neutral">{t('assets.status.disabled')}</Badge> : null}
        </>
      ) : undefined,
    mark: <AssetMark name={skill.name} color={skill.color} iconUrl={skill.iconUrl} size={32} />,
    cells: [
      [skill.author, skill.version ? `v${skill.version}` : ''].filter(Boolean).join(' · ') || '—',
      categoryLabel(skill.category, locale),
      formatBytes(skill.size),
      formatCount(skill.installs, locale),
      formatDate(skill.updatedAt, locale),
    ],
    inline: [
      {
        id: 'download',
        label: t('assets.action.download'),
        icon: <IconDownload className="size-3.5" />,
        onClick: () => {
          void downloadSkillPackage(skill.slug).then(saveDownload).catch((err: unknown) => {
            toast.push({ tone: 'danger', title: err instanceof Error ? err.message : String(err) });
          });
        },
      },
    ],
    menu: [
      {
        id: 'status',
        label: t(skill.enabled ? 'assets.action.disable' : 'assets.action.enable'),
        onSelect: () => {
          void setSkillEnabled(skill.slug, !skill.enabled).then(refresh).catch((err: unknown) => {
            toast.push({ tone: 'danger', title: err instanceof Error ? err.message : String(err) });
          });
        },
      },
      {
        id: 'delete',
        label: t('assets.action.delete'),
        tone: 'danger',
        separator: true,
        onSelect: () => setPendingDelete(skill),
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
        title={t('assets.skills.field.author')}
        options={facetOptions(facets.data?.authors)}
        value={filters.author}
        onChange={(author) => update({ author })}
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
      title={t('assets.skills.title')}
      description={t('assets.skills.desc')}
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <IconPlus />
          {t('assets.skills.create')}
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
        searchPlaceholder={t('assets.skills.search')}
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
            title={hasFilters ? t('assets.empty.filtered') : t('assets.skills.empty')}
            action={
              hasFilters ? undefined : (
                <Button size="sm" onClick={() => setCreating(true)}>
                  {t('assets.skills.create')}
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
          { id: 'author', header: t('assets.skills.field.author'), className: 'w-[180px]' },
          { id: 'category', header: t('assets.field.category'), className: 'w-[160px]' },
          { id: 'size', header: t('assets.stat.size'), className: 'w-[88px]', align: 'right' },
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
            await deleteSkill(pendingDelete.slug);
            toast.push({ tone: 'success', title: t('assets.action.delete') });
            setPendingDelete(null);
            refresh();
          } finally {
            setDeleting(false);
          }
        }}
      />
      <SkillDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(skill) => {
          toast.push({ tone: 'success', title: t('assets.toast.created') });
          navigate(`${SKILLS_PATH}/${encodeURIComponent(skill.slug)}`);
        }}
      />
    </AdminPageShell>
  );
}
