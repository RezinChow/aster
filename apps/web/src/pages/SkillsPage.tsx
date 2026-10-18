import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  ConsoleDialog,
  ConsoleEmptyState,
  FilterChip,
  ConsoleFormField,
  Input,
  ListToolbar,
  ConsoleTextarea,
  useToast,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import {
  latestSkillArtifact,
  listSkills,
  skillBuildState,
  type Skill,
  type SkillBuildState,
} from '@/data/skills';
import { findSourceRepo, shortSha } from '@/data/sources';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  cloudSkillBuildState,
  createCloudSkill,
  listCloudSkills,
  type CloudSkillSummary,
} from '@/lib/skillsApi';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';
import { SkillDetailPage } from './SkillDetailPage';

const STATE_FILTERS: Array<{
  value: 'all' | SkillBuildState;
  labelKey: MessageKey;
}> = [
  { value: 'all', labelKey: 'skills.state.all' },
  { value: 'built', labelKey: 'skills.state.built' },
  { value: 'source', labelKey: 'skills.state.source' },
  { value: 'archived', labelKey: 'skills.state.archived' },
];

const STATE_LABEL: Record<SkillBuildState, MessageKey> = {
  built: 'skills.state.built',
  source: 'skills.state.source',
  archived: 'skills.state.archived',
};

function stateTone(state: SkillBuildState): BadgeTone {
  switch (state) {
    case 'built':
      return 'primary';
    case 'source':
      return 'warn';
    case 'archived':
      return 'neutral';
  }
}

export function SkillsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const scope = useCloudScopeContext();
  const previewMode = !scope.cloudReady;
  const [cloudRows, setCloudRows] = useState<CloudSkillSummary[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [items, setItems] = useState(() => listSkills());
  const [q, setQ] = useState('');
  const [state, setState] = useState<'all' | SkillBuildState>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  const counts = useMemo(() => {
    if (!previewMode) {
      const states = cloudRows.map((s) => cloudSkillBuildState(s));
      return {
        all: cloudRows.length,
        built: states.filter((s) => s === 'built').length,
        source: states.filter((s) => s === 'source').length,
        archived: states.filter((s) => s === 'archived').length,
      };
    }
    const states = items.map((s) => skillBuildState(s));
    return {
      all: items.length,
      built: states.filter((s) => s === 'built').length,
      source: states.filter((s) => s === 'source').length,
      archived: states.filter((s) => s === 'archived').length,
    };
  }, [cloudRows, items, previewMode]);

  const reloadCloud = useCallback(async () => {
    if (previewMode) return;
    setCloudLoading(true);
    setCloudError(null);
    try {
      setCloudRows(await listCloudSkills());
    } catch (err) {
      setCloudRows([]);
      setCloudError(
        err instanceof ApiRequestError ? err.message : t('skills.loadFailed'),
      );
    } finally {
      setCloudLoading(false);
    }
  }, [previewMode, t]);

  useEffect(() => {
    void reloadCloud();
  }, [reloadCloud]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!previewMode) {
      return cloudRows.filter((skill) => {
        if (state !== 'all' && cloudSkillBuildState(skill) !== state) return false;
        if (!needle) return true;
        return (
          skill.name.toLowerCase().includes(needle) ||
          skill.assetId.toLowerCase().includes(needle)
        );
      });
    }
    return items.filter((skill) => {
      if (state !== 'all' && skillBuildState(skill) !== state) return false;
      if (!needle) return true;
      const repo = findSourceRepo(skill.repoId);
      return (
        skill.name.toLowerCase().includes(needle) ||
        skill.slug.toLowerCase().includes(needle) ||
        skill.description.toLowerCase().includes(needle) ||
        (repo?.fullName.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [cloudRows, items, previewMode, q, state]);

  const filtersActive = q.trim() !== '' || state !== 'all';
  const canCreate = Boolean(name.trim());

  const refresh = () => {
    if (previewMode) {
      setItems(listSkills());
      return;
    }
    return reloadCloud();
  };

  const closeEditor = () => {
    setEditingId(null);
    refresh();
  };

  const onCreate = async () => {
    if (!canCreate) return;
    if (previewMode) {
      toast.push({ title: t('skills.toast.previewReadOnly'), tone: 'danger' });
      return;
    }
    try {
      const created = await createCloudSkill({
        name: name.trim(),
        markdown: `# ${name.trim()}\n\n${description.trim() || 'Describe this skill.'}\n`,
      });
      await reloadCloud();
      setCreateOpen(false);
      setName('');
      setSlug('');
      setDescription('');
      toast.push({ title: t('skills.toast.created'), tone: 'success' });
      setEditingId(created.assetId);
    } catch (err) {
      toast.push({
        title: t('skills.toast.createFailed'),
        description:
          err instanceof ApiRequestError ? err.message : undefined,
        tone: 'danger',
      });
    }
  };

  return (
    <AdminPageShell
      title={t('skills.title')}
      description={t('skills.description')}
    >
      {previewMode ? (
        <p className="text-sm text-ink-muted">{t('skills.previewBanner')}</p>
      ) : null}
      {cloudError ? (
        <AppErrorBanner message={cloudError} onRetry={() => void reloadCloud()} />
      ) : null}
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('skills.search')}
        secondaryActions={
          <Button size="sm" variant="outline" to="/admin/sources">
            {t('skills.openSources')}
          </Button>
        }
        primaryAction={
          <Button
            size="sm"
            type="button"
            disabled={previewMode}
            title={previewMode ? t('skills.toast.previewReadOnly') : undefined}
            onClick={() => setCreateOpen(true)}
          >
            {t('skills.create')}
          </Button>
        }
        filters={
          <div
            className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
            role="group"
            aria-label={t('skills.filterState')}
          >
            {STATE_FILTERS.map((item) => (
              <FilterChip
                key={item.value}
                inset
                label={t(item.labelKey)}
                count={counts[item.value === 'all' ? 'all' : item.value]}
                active={state === item.value}
                onClick={() => setState(item.value)}
              />
            ))}
          </div>
        }
      />

      {previewMode ? (
      <I18nDataTable
        rows={rows as Skill[]}
        rowKey={(skill) => skill.id}
        onRefresh={refresh}
        onRowClick={(skill) => setEditingId(skill.id)}
        columns={[
          {
            id: 'name',
            header: t('skills.col.name'),
            sortable: true,
            getSortValue: (skill) => skill.name,
            cell: (skill) => (
              <div>
                <button
                  type="button"
                  className="font-medium text-ink hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(skill.id);
                  }}
                >
                  {skill.name}
                </button>
                <div className="font-mono text-[11px] text-ink-faint">
                  {skill.slug}
                </div>
              </div>
            ),
          },
          {
            id: 'repo',
            header: t('skills.col.repo'),
            cell: (skill) => {
              const repo = findSourceRepo(skill.repoId);
              return (
                <div>
                  <Link
                    to="/admin/sources"
                    className="font-mono text-[12px] text-ink hover:opacity-80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {repo?.fullName ?? skill.repoId}
                  </Link>
                  {repo ? (
                    <div className="font-mono text-[11px] text-ink-faint">
                      {shortSha(repo.latestRevision)}
                    </div>
                  ) : null}
                </div>
              );
            },
          },
          {
            id: 'state',
            header: t('skills.col.state'),
            sortable: true,
            getSortValue: (skill) => skillBuildState(skill),
            cell: (skill) => {
              const build = skillBuildState(skill);
              return (
                <Badge tone={stateTone(build)}>{t(STATE_LABEL[build])}</Badge>
              );
            },
          },
          {
            id: 'version',
            header: t('skills.col.version'),
            cell: (skill) => {
              const artifact = latestSkillArtifact(skill.id);
              return artifact ? (
                <span className="font-mono text-sm">{artifact.version}</span>
              ) : (
                <span className="text-ink-faint">—</span>
              );
            },
          },
          {
            id: 'updated',
            header: t('skills.col.updated'),
            sortable: true,
            getSortValue: (skill) => skill.updatedAt,
            cell: (skill) => skill.updatedAt,
          },
          {
            id: 'actions',
            header: t('skills.col.actions'),
            cell: () => (
              <span className="text-xs text-ink-faint">
                {t('skills.toast.previewReadOnly')}
              </span>
            ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            variant={items.length > 0 && filtersActive ? 'no-match' : 'no-data'}
            title={
              items.length === 0
                ? t('skills.empty.title')
                : t('admin.empty.title')
            }
            description={
              items.length === 0
                ? t('skills.empty.description')
                : t('admin.empty.description')
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={
              filtersActive
                ? () => {
                    setQ('');
                    setState('all');
                  }
                : undefined
            }
            action={
              items.length === 0 ? (
                <Button
                  size="sm"
                  type="button"
                  onClick={() => setCreateOpen(true)}
                >
                  {t('skills.create')}
                </Button>
              ) : undefined
            }
          />
        }
      />
      ) : (
      <I18nDataTable
        rows={rows as CloudSkillSummary[]}
        rowKey={(skill) => skill.assetId}
        onRefresh={refresh}
        onRowClick={(skill) => setEditingId(skill.assetId)}
        columns={[
          {
            id: 'name',
            header: t('skills.col.name'),
            sortable: true,
            getSortValue: (skill) => skill.name,
            cell: (skill) => (
              <div>
                <button
                  type="button"
                  className="font-medium text-ink hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(skill.assetId);
                  }}
                >
                  {skill.name}
                </button>
                <div className="font-mono text-[11px] text-ink-faint">
                  {skill.assetId.slice(0, 8)}
                </div>
              </div>
            ),
          },
          {
            id: 'repo',
            header: t('skills.col.repo'),
            cell: (skill) => (
              <div className="font-mono text-[12px] text-ink-faint">
                Cloud Asset Git
                {skill.latestRelease ? (
                  <div className="text-[11px]">
                    {shortSha(skill.latestRelease.commitSha)}
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            id: 'state',
            header: t('skills.col.state'),
            sortable: true,
            getSortValue: (skill) => cloudSkillBuildState(skill),
            cell: (skill) => {
              const build = cloudSkillBuildState(skill);
              return (
                <Badge tone={stateTone(build)}>{t(STATE_LABEL[build])}</Badge>
              );
            },
          },
          {
            id: 'version',
            header: t('skills.col.version'),
            cell: (skill) =>
              skill.latestRelease ? (
                <span className="font-mono text-sm">
                  {skill.latestRelease.version}
                </span>
              ) : (
                <span className="text-ink-faint">—</span>
              ),
          },
          {
            id: 'updated',
            header: t('skills.col.updated'),
            sortable: true,
            getSortValue: (skill) => skill.updatedAt,
            cell: (skill) => skill.updatedAt.slice(0, 10),
          },
          {
            id: 'actions',
            header: t('skills.col.actions'),
            cell: () => <span className="text-ink-faint">—</span>,
          },
        ]}
        empty={
          <ConsoleEmptyState
            variant={
              cloudRows.length > 0 && filtersActive ? 'no-match' : 'no-data'
            }
            title={
              cloudLoading
                ? t('skills.loadFailed')
                : cloudRows.length === 0
                  ? t('skills.empty.title')
                  : t('admin.empty.title')
            }
            description={
              cloudRows.length === 0 && !cloudLoading
                ? t('skills.empty.description')
                : t('admin.empty.description')
            }
            clearFiltersLabel={t('admin.empty.clearFilters')}
            onClearFilters={
              filtersActive
                ? () => {
                    setQ('');
                    setState('all');
                  }
                : undefined
            }
            action={
              cloudRows.length === 0 && !cloudLoading ? (
                <Button
                  size="sm"
                  type="button"
                  onClick={() => setCreateOpen(true)}
                >
                  {t('skills.create')}
                </Button>
              ) : undefined
            }
          />
        }
      />
      )}

      <ConsoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('skills.create')}
        description={t('skills.createHint')}
        size="md"
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              {t('skills.cancel')}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!canCreate}
              onClick={onCreate}
            >
              {t('skills.createSubmit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ConsoleFormField label={t('skills.field.name')} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('skills.field.namePlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField
            label={t('skills.field.slug')}
            hint={t('skills.field.slugHint')}
          >
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('skills.field.slugPlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('skills.field.description')}>
            <ConsoleTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('skills.field.descriptionPlaceholder')}
              rows={3}
            />
          </ConsoleFormField>
        </div>
      </ConsoleDialog>

      <ConsoleDialog
        open={editingId !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
        title={t('skills.title')}
        size="full"
        hideHeader
      >
        {editingId ? (
          <SkillDetailPage
            key={editingId}
            skillId={editingId}
            onClose={closeEditor}
            cloudMode={!previewMode}
          />
        ) : null}
      </ConsoleDialog>
    </AdminPageShell>
  );
}
