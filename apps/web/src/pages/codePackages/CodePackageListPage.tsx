import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  ConsoleConfirmDialog,
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
import {
  codePackageMarketRelease,
  codePackageMarketState,
  createCodePackage,
  deleteCodePackage,
  listCodePackages,
  type CodePackage,
  type CodePackageKind,
  type CodePackageMarketState,
} from '@/data/codePackages';
import { findSourceRepo, shortSha } from '@/data/sources';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { CodePackageDetailPage } from './CodePackageDetailPage';

const STATE_FILTERS: Array<{
  value: 'all' | CodePackageMarketState;
  labelKey: MessageKey;
}> = [
  { value: 'all', labelKey: 'pkg.state.all' },
  { value: 'listed', labelKey: 'pkg.state.listed' },
  { value: 'built', labelKey: 'pkg.state.built' },
  { value: 'source', labelKey: 'pkg.state.source' },
  { value: 'archived', labelKey: 'pkg.state.archived' },
];

const STATE_LABEL: Record<CodePackageMarketState, MessageKey> = {
  listed: 'pkg.state.listed',
  built: 'pkg.state.built',
  source: 'pkg.state.source',
  archived: 'pkg.state.archived',
};

function stateTone(state: CodePackageMarketState): BadgeTone {
  switch (state) {
    case 'listed':
      return 'success';
    case 'built':
      return 'primary';
    case 'source':
      return 'warn';
    case 'archived':
      return 'neutral';
  }
}

function kindTitleKey(kind: CodePackageKind): MessageKey {
  return `pkg.${kind}.title` as MessageKey;
}

function kindDescKey(kind: CodePackageKind): MessageKey {
  return `pkg.${kind}.description` as MessageKey;
}

function kindCreateHintKey(kind: CodePackageKind): MessageKey {
  return `pkg.${kind}.createHint` as MessageKey;
}

function kindEmptyTitleKey(kind: CodePackageKind): MessageKey {
  return `pkg.${kind}.emptyTitle` as MessageKey;
}

function kindEmptyBodyKey(kind: CodePackageKind): MessageKey {
  return `pkg.${kind}.emptyBody` as MessageKey;
}

function kindNamePlaceholderKey(kind: CodePackageKind): MessageKey {
  return `pkg.${kind}.namePlaceholder` as MessageKey;
}

export function CodePackageListPage({ kind }: { kind: CodePackageKind }) {
  const { t } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState(() => listCodePackages(kind));
  const [q, setQ] = useState('');
  const [state, setState] = useState<'all' | CodePackageMarketState>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CodePackage | null>(null);

  const counts = useMemo(() => {
    const states = items.map((p) => codePackageMarketState(p));
    return {
      all: items.length,
      listed: states.filter((s) => s === 'listed').length,
      built: states.filter((s) => s === 'built').length,
      source: states.filter((s) => s === 'source').length,
      archived: states.filter((s) => s === 'archived').length,
    };
  }, [items]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((pkg) => {
      const market = codePackageMarketState(pkg);
      if (state !== 'all' && market !== state) return false;
      if (!needle) return true;
      const repo = findSourceRepo(pkg.repoId);
      return (
        pkg.name.toLowerCase().includes(needle) ||
        pkg.slug.toLowerCase().includes(needle) ||
        pkg.description.toLowerCase().includes(needle) ||
        (repo?.fullName.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [items, q, state]);

  const filtersActive = q.trim() !== '' || state !== 'all';
  const canCreate = Boolean(name.trim());
  const refresh = () => setItems(listCodePackages(kind));

  const closeEditor = () => {
    setEditingId(null);
    refresh();
  };

  const onCreate = () => {
    if (!canCreate) return;
    const created = createCodePackage(kind, {
      name,
      slug: slug.trim() || undefined,
      description,
    });
    refresh();
    setCreateOpen(false);
    setName('');
    setSlug('');
    setDescription('');
    toast.push({ title: t('pkg.toast.created'), tone: 'success' });
    setEditingId(created.id);
  };

  const onDelete = () => {
    if (!pendingDelete) return;
    deleteCodePackage(kind, pendingDelete.id);
    setPendingDelete(null);
    refresh();
    toast.push({ title: t('pkg.toast.deleted'), tone: 'success' });
  };

  return (
    <AdminPageShell
      title={t(kindTitleKey(kind))}
      description={t(kindDescKey(kind))}
    >
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('pkg.search')}
        secondaryActions={
          <Button size="sm" variant="outline" to="/admin/sources">
            {t('pkg.openSources')}
          </Button>
        }
        primaryAction={
          <Button size="sm" type="button" onClick={() => setCreateOpen(true)}>
            {t('pkg.create')}
          </Button>
        }
        filters={
          <div
            className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
            role="group"
            aria-label={t('pkg.filterState')}
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

      <I18nDataTable
        rows={rows}
        rowKey={(pkg) => pkg.id}
        onRefresh={refresh}
        onRowClick={(pkg) => setEditingId(pkg.id)}
        columns={[
          {
            id: 'name',
            header: t('pkg.col.name'),
            sortable: true,
            getSortValue: (pkg) => pkg.name,
            cell: (pkg) => (
              <div>
                <button
                  type="button"
                  className="font-medium text-ink hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(pkg.id);
                  }}
                >
                  {pkg.name}
                </button>
                <div className="font-mono text-[11px] text-ink-faint">
                  {pkg.slug}
                </div>
              </div>
            ),
          },
          {
            id: 'repo',
            header: t('pkg.col.repo'),
            cell: (pkg) => {
              const repo = findSourceRepo(pkg.repoId);
              return (
                <div>
                  <Link
                    to="/admin/sources"
                    className="font-mono text-[12px] text-ink hover:opacity-80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {repo?.fullName ?? pkg.repoId}
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
            header: t('pkg.col.state'),
            sortable: true,
            getSortValue: (pkg) => codePackageMarketState(pkg),
            cell: (pkg) => {
              const market = codePackageMarketState(pkg);
              return (
                <Badge tone={stateTone(market)}>{t(STATE_LABEL[market])}</Badge>
              );
            },
          },
          {
            id: 'version',
            header: t('pkg.col.marketVersion'),
            cell: (pkg) => {
              const rel = codePackageMarketRelease(pkg.id);
              return rel ? (
                <span className="font-mono text-sm">{rel.version}</span>
              ) : (
                <span className="text-ink-faint">—</span>
              );
            },
          },
          {
            id: 'updated',
            header: t('pkg.col.updated'),
            sortable: true,
            getSortValue: (pkg) => pkg.updatedAt,
            cell: (pkg) => pkg.updatedAt,
          },
          {
            id: 'actions',
            header: t('pkg.col.actions'),
            cell: (pkg) =>
              pkg.system ? (
                <span className="text-ink-faint">—</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(pkg);
                  }}
                >
                  {t('pkg.delete')}
                </Button>
              ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            variant={items.length > 0 && filtersActive ? 'no-match' : 'no-data'}
            title={
              items.length === 0
                ? t(kindEmptyTitleKey(kind))
                : t('admin.empty.title')
            }
            description={
              items.length === 0
                ? t(kindEmptyBodyKey(kind))
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
                  {t('pkg.create')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ConsoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('pkg.create')}
        description={t(kindCreateHintKey(kind))}
        size="md"
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              {t('pkg.cancel')}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!canCreate}
              onClick={onCreate}
            >
              {t('pkg.createSubmit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ConsoleFormField label={t('pkg.field.name')} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(kindNamePlaceholderKey(kind))}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.slug')} hint={t('pkg.field.slugHint')}>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('pkg.field.slugPlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.description')}>
            <ConsoleTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('pkg.field.descriptionPlaceholder')}
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
        title={t(kindTitleKey(kind))}
        size="full"
        hideHeader
      >
        {editingId ? (
          <CodePackageDetailPage
            key={editingId}
            kind={kind}
            packageId={editingId}
            onClose={closeEditor}
          />
        ) : null}
      </ConsoleDialog>

      <ConsoleConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t('pkg.deleteConfirmTitle')}
        description={t('pkg.deleteConfirmBody')}
        confirmLabel={t('pkg.delete')}
        cancelLabel={t('pkg.cancel')}
        tone="danger"
        onConfirm={onDelete}
      />
    </AdminPageShell>
  );
}
