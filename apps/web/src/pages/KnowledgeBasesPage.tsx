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
  createKnowledgeBase,
  deleteKnowledgeBase,
  knowledgeMarketRelease,
  knowledgeMarketState,
  listKnowledgeBases,
  type KnowledgeBase,
  type KnowledgeMarketState,
} from '@/data/knowledgeBases';
import { findSourceRepo, shortSha } from '@/data/sources';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { KnowledgeBaseDetailPage } from './KnowledgeBaseDetailPage';

const STATE_FILTERS: Array<{
  value: 'all' | KnowledgeMarketState;
  labelKey: MessageKey;
}> = [
  { value: 'all', labelKey: 'kb.state.all' },
  { value: 'listed', labelKey: 'kb.state.listed' },
  { value: 'built', labelKey: 'kb.state.built' },
  { value: 'source', labelKey: 'kb.state.source' },
  { value: 'archived', labelKey: 'kb.state.archived' },
];

const STATE_LABEL: Record<KnowledgeMarketState, MessageKey> = {
  listed: 'kb.state.listed',
  built: 'kb.state.built',
  source: 'kb.state.source',
  archived: 'kb.state.archived',
};

function stateTone(state: KnowledgeMarketState): BadgeTone {
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

export function KnowledgeBasesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [items, setItems] = useState(() => listKnowledgeBases());
  const [q, setQ] = useState('');
  const [state, setState] = useState<'all' | KnowledgeMarketState>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [pendingDelete, setPendingDelete] = useState<KnowledgeBase | null>(
    null,
  );

  const counts = useMemo(() => {
    const states = items.map((k) => knowledgeMarketState(k));
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
    return items.filter((kb) => {
      const market = knowledgeMarketState(kb);
      if (state !== 'all' && market !== state) return false;
      if (!needle) return true;
      const repo = findSourceRepo(kb.repoId);
      return (
        kb.name.toLowerCase().includes(needle) ||
        kb.slug.toLowerCase().includes(needle) ||
        kb.description.toLowerCase().includes(needle) ||
        (repo?.fullName.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [items, q, state]);

  const filtersActive = q.trim() !== '' || state !== 'all';
  const canCreate = Boolean(name.trim());

  const refresh = () => setItems(listKnowledgeBases());

  const closeEditor = () => {
    setEditingId(null);
    refresh();
  };

  const onCreate = () => {
    if (!canCreate) return;
    const created = createKnowledgeBase({
      name,
      slug: slug.trim() || undefined,
      description,
    });
    refresh();
    setCreateOpen(false);
    setName('');
    setSlug('');
    setDescription('');
    toast.push({ title: t('kb.toast.created'), tone: 'success' });
    setEditingId(created.id);
  };

  const onDelete = () => {
    if (!pendingDelete) return;
    deleteKnowledgeBase(pendingDelete.id);
    setPendingDelete(null);
    refresh();
    toast.push({ title: t('kb.toast.deleted'), tone: 'success' });
  };

  return (
    <AdminPageShell
      title={t('kb.title')}
      description={t('kb.description')}
    >
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('kb.search')}
        secondaryActions={
          <Button size="sm" variant="outline" to="/admin/sources">
            {t('kb.openSources')}
          </Button>
        }
        primaryAction={
          <Button size="sm" type="button" onClick={() => setCreateOpen(true)}>
            {t('kb.create')}
          </Button>
        }
        filters={
          <div
            className="inline-flex h-[30px] items-stretch gap-0.5 rounded-lg border-0 bg-[color:var(--color-control-fill)] p-1"
            role="group"
            aria-label={t('kb.filterState')}
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
        rowKey={(kb) => kb.id}
        onRefresh={refresh}
        onRowClick={(kb) => setEditingId(kb.id)}
        columns={[
          {
            id: 'name',
            header: t('kb.col.name'),
            sortable: true,
            getSortValue: (kb) => kb.name,
            cell: (kb) => (
              <div>
                <button
                  type="button"
                  className="font-medium text-ink hover:opacity-80"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(kb.id);
                  }}
                >
                  {kb.name}
                </button>
                <div className="font-mono text-[11px] text-ink-faint">
                  {kb.slug}
                </div>
              </div>
            ),
          },
          {
            id: 'repo',
            header: t('kb.col.repo'),
            cell: (kb) => {
              const repo = findSourceRepo(kb.repoId);
              return (
                <div>
                  <Link
                    to="/admin/sources"
                    className="font-mono text-[12px] text-ink hover:opacity-80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {repo?.fullName ?? kb.repoId}
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
            header: t('kb.col.state'),
            sortable: true,
            getSortValue: (kb) => knowledgeMarketState(kb),
            cell: (kb) => {
              const market = knowledgeMarketState(kb);
              return (
                <Badge tone={stateTone(market)}>{t(STATE_LABEL[market])}</Badge>
              );
            },
          },
          {
            id: 'version',
            header: t('kb.col.marketVersion'),
            cell: (kb) => {
              const rel = knowledgeMarketRelease(kb.id);
              return rel ? (
                <span className="font-mono text-sm">{rel.version}</span>
              ) : (
                <span className="text-ink-faint">—</span>
              );
            },
          },
          {
            id: 'docs',
            header: t('kb.col.docs'),
            sortable: true,
            getSortValue: (kb) => kb.documents.length,
            cell: (kb) => kb.documents.length,
          },
          {
            id: 'updated',
            header: t('kb.col.updated'),
            sortable: true,
            getSortValue: (kb) => kb.updatedAt,
            cell: (kb) => kb.updatedAt,
          },
          {
            id: 'actions',
            header: t('kb.col.actions'),
            cell: (kb) => (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingDelete(kb);
                }}
              >
                {t('kb.delete')}
              </Button>
            ),
          },
        ]}
        empty={
          <ConsoleEmptyState
            variant={items.length > 0 && filtersActive ? 'no-match' : 'no-data'}
            title={
              items.length === 0 ? t('kb.empty.title') : t('admin.empty.title')
            }
            description={
              items.length === 0
                ? t('kb.empty.description')
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
                  {t('kb.create')}
                </Button>
              ) : undefined
            }
          />
        }
      />

      <ConsoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('kb.create')}
        description={t('kb.createHint')}
        size="md"
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              {t('kb.cancel')}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!canCreate}
              onClick={onCreate}
            >
              {t('kb.createSubmit')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ConsoleFormField label={t('kb.field.name')} required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('kb.field.namePlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.slug')} hint={t('kb.field.slugHint')}>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('kb.field.slugPlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.description')}>
            <ConsoleTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('kb.field.descriptionPlaceholder')}
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
        title={t('kb.title')}
        size="full"
        hideHeader
      >
        {editingId ? (
          <KnowledgeBaseDetailPage
            key={editingId}
            knowledgeBaseId={editingId}
            onClose={closeEditor}
          />
        ) : null}
      </ConsoleDialog>

      <ConsoleConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t('kb.deleteConfirmTitle')}
        description={t('kb.deleteConfirmBody')}
        confirmLabel={t('kb.delete')}
        cancelLabel={t('kb.cancel')}
        tone="danger"
        onConfirm={onDelete}
      />
    </AdminPageShell>
  );
}
