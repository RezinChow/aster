import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Card,
  Badge,
  Button,
  ConsoleConfirmDialog,
  ConsoleDialog,
  ConsoleFormField,
  Input,
  ResourceMetaHeader,
  SearchSelect,
  ConsoleTextarea,
  useToast,
  type BadgeTone,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { DetailPageNav } from '@/components/DetailPageNav';
import {
  OfficeMarkdownEditor,
  toMarkdownContent,
} from '@/components/OfficeMarkdownEditor';
import {
  buildKnowledgeArtifact,
  commitKnowledgeSource,
  deleteKnowledgeDocument,
  findKnowledgeBase,
  knowledgeArtifacts,
  knowledgeMarketRelease,
  knowledgeMarketState,
  knowledgePublishableArtifacts,
  publishKnowledgeToMarket,
  updateKnowledgeBase,
  upsertKnowledgeDocument,
  type KnowledgeBase,
  type KnowledgeDocument,
  type KnowledgeLifecycle,
  type KnowledgeMarketState,
} from '@/data/knowledgeBases';
import { findSourceRepo, shortSha } from '@/data/sources';
import { shortDigest, type SupplyArtifact } from '@/data/supply';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import type { MarkdownContent } from '@a3s-lab/office/core';

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

export function KnowledgeBaseDetailPage({
  knowledgeBaseId,
  onClose,
}: {
  /** When set (e.g. fullscreen list editor), overrides route param */
  knowledgeBaseId?: string;
  /** Present → embedded fullscreen dialog mode */
  onClose?: () => void;
} = {}) {
  const { id: routeId = '' } = useParams();
  const id = knowledgeBaseId ?? routeId;
  const embedded = typeof onClose === 'function';
  const { t } = useI18n();
  const toast = useToast();
  const base = findKnowledgeBase(id);
  const [kb, setKb] = useState<KnowledgeBase | undefined>(base);
  const [name, setName] = useState(base?.name ?? '');
  const [description, setDescription] = useState(base?.description ?? '');
  const [owner, setOwner] = useState(base?.owner ?? '');
  const [lifecycle, setLifecycle] = useState<KnowledgeLifecycle>(
    base?.lifecycle ?? 'active',
  );
  const [tags, setTags] = useState(base?.tags.join(', ') ?? '');
  const [activeDocId, setActiveDocId] = useState(base?.documents[0]?.id ?? '');
  const activeDoc = useMemo(
    () => kb?.documents.find((d) => d.id === activeDocId) ?? kb?.documents[0],
    [activeDocId, kb],
  );
  const [docTitle, setDocTitle] = useState(activeDoc?.title ?? '');
  const [content, setContent] = useState<MarkdownContent>(() =>
    toMarkdownContent(activeDoc?.markdown ?? ''),
  );
  const [pendingDeleteDoc, setPendingDeleteDoc] =
    useState<KnowledgeDocument | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [artifacts, setArtifacts] = useState(() =>
    base ? knowledgeArtifacts(base.id) : [],
  );
  const [publishable, setPublishable] = useState(() =>
    base ? knowledgePublishableArtifacts(base.id) : [],
  );
  const [marketRel, setMarketRel] = useState(() =>
    base ? knowledgeMarketRelease(base.id) : undefined,
  );

  const repo = kb ? findSourceRepo(kb.repoId) : undefined;
  const marketState = kb ? knowledgeMarketState(kb) : 'source';

  const metaDirty = useMemo(() => {
    if (!kb) return false;
    const nextTags = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      name !== kb.name ||
      description !== kb.description ||
      owner !== kb.owner ||
      lifecycle !== kb.lifecycle ||
      nextTags.join(',') !== kb.tags.join(',')
    );
  }, [description, kb, lifecycle, name, owner, tags]);

  const docDirty = useMemo(() => {
    if (!activeDoc) return false;
    return (
      docTitle !== activeDoc.title || content.markdown !== activeDoc.markdown
    );
  }, [activeDoc, content.markdown, docTitle]);

  if (!base || !kb || !activeDoc) {
    if (embedded) return null;
    return <Navigate to="/admin/knowledge-bases" replace />;
  }

  const refreshSupply = (next: KnowledgeBase) => {
    setKb(next);
    setArtifacts(knowledgeArtifacts(next.id));
    setPublishable(knowledgePublishableArtifacts(next.id));
    setMarketRel(knowledgeMarketRelease(next.id));
  };

  const selectDoc = (doc: KnowledgeDocument) => {
    setActiveDocId(doc.id);
    setDocTitle(doc.title);
    setContent(toMarkdownContent(doc.markdown));
  };

  const saveMeta = () => {
    const nextTags = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = updateKnowledgeBase(kb.id, {
      name: name.trim() || kb.name,
      description: description.trim(),
      owner: owner.trim() || kb.owner,
      lifecycle,
      tags: nextTags,
    });
    if (!updated) return;
    refreshSupply(updated);
    toast.push({ title: t('kb.toast.saved'), tone: 'success' });
  };

  const saveDocLocal = () => {
    const updated = upsertKnowledgeDocument(kb.id, {
      id: activeDoc.id,
      title: docTitle.trim() || activeDoc.title,
      markdown: content.markdown,
    });
    if (!updated) return;
    refreshSupply(updated);
    const next = updated.documents.find((d) => d.id === activeDoc.id);
    if (next) {
      setDocTitle(next.title);
      setContent(toMarkdownContent(next.markdown));
    }
    return updated;
  };

  const commitSource = () => {
    if (docDirty) saveDocLocal();
    const updated = commitKnowledgeSource(kb.id);
    if (!updated) return;
    refreshSupply(updated);
    toast.push({ title: t('kb.toast.committed'), tone: 'success' });
  };

  const addDoc = () => {
    const updated = upsertKnowledgeDocument(kb.id, {
      title: t('kb.doc.newTitle'),
      markdown: `# ${t('kb.doc.newTitle')}\n\n`,
    });
    if (!updated) return;
    refreshSupply(updated);
    const created = updated.documents[0];
    if (created) selectDoc(created);
    toast.push({ title: t('kb.toast.docCreated'), tone: 'success' });
  };

  const removeDoc = () => {
    if (!pendingDeleteDoc) return;
    const updated = deleteKnowledgeDocument(kb.id, pendingDeleteDoc.id);
    setPendingDeleteDoc(null);
    if (!updated) return;
    refreshSupply(updated);
    const next = updated.documents[0];
    if (next) selectDoc(next);
    toast.push({ title: t('kb.toast.docDeleted'), tone: 'success' });
  };

  const onBuild = () => {
    if (metaDirty || docDirty) {
      toast.push({ title: t('kb.toast.commitFirst'), tone: 'info' });
      return;
    }
    const artifact = buildKnowledgeArtifact(kb.id);
    if (!artifact) return;
    setArtifacts(knowledgeArtifacts(kb.id));
    setPublishable(knowledgePublishableArtifacts(kb.id));
    toast.push({
      title: t('kb.toast.built'),
      description: `${artifact.version} · ${shortDigest(artifact.digest)}`,
      tone: 'success',
    });
  };

  const openPublish = () => {
    const list = knowledgePublishableArtifacts(kb.id);
    setPublishable(list);
    setSelectedArtifactId(list[0]?.id ?? '');
    setPublishOpen(true);
  };

  const onPublish = () => {
    if (!selectedArtifactId) return;
    const release = publishKnowledgeToMarket(kb.id, selectedArtifactId);
    if (!release) {
      toast.push({ title: t('kb.toast.publishFailed'), tone: 'danger' });
      return;
    }
    setPublishOpen(false);
    setMarketRel(release);
    setPublishable(knowledgePublishableArtifacts(kb.id));
    toast.push({
      title: t('kb.toast.published'),
      description: release.version,
      tone: 'success',
    });
  };

  const actions = (
    <>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={!metaDirty}
        onClick={saveMeta}
      >
        {t('kb.saveMeta')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={!docDirty && !metaDirty}
        onClick={commitSource}
      >
        {t('kb.commit')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={onBuild}
        disabled={lifecycle === 'archived'}
      >
        {t('kb.build')}
      </Button>
      <Button
        size="sm"
        type="button"
        onClick={openPublish}
        disabled={lifecycle === 'archived' || publishable.length === 0}
      >
        {t('kb.publish')}
      </Button>
    </>
  );

  const body = (
    <>
      <ResourceMetaHeader
        title={kb.name}
        badge={
          <Badge tone={stateTone(marketState)}>
            {t(STATE_LABEL[marketState])}
          </Badge>
        }
        summary={[
          {
            id: 'repo',
            label: t('kb.col.repo'),
            value: repo?.fullName ?? kb.repoId,
          },
          {
            id: 'head',
            label: t('kb.meta.head'),
            value: repo ? shortSha(repo.latestRevision) : '—',
          },
          {
            id: 'market',
            label: t('kb.col.marketVersion'),
            value: marketRel?.version ?? '—',
          },
        ]}
      />

      <p className="text-sm text-ink-muted">{t('kb.supply.banner')}</p>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,240px)_minmax(0,260px)_minmax(0,1fr)]">
        <Card className="space-y-3 p-3">
          <ConsoleFormField label={t('kb.field.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.lifecycle')}>
            <SearchSelect
              value={lifecycle}
              onChange={(v) => setLifecycle(v as KnowledgeLifecycle)}
              searchable={false}
              allowClear={false}
              options={[
                { value: 'active', label: t('kb.lifecycle.active') },
                { value: 'archived', label: t('kb.lifecycle.archived') },
              ]}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.repo')}>
            <div className="space-y-1">
              <p className="font-mono text-sm text-ink">
                {repo?.fullName ?? kb.repoId}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" to="/admin/sources">
                  {t('kb.openSources')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  to={`/admin/eng/repos/${kb.repoId}?tab=pipelines`}
                >
                  {t('kb.openPipelines')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  to={`/admin/eng/repos/${kb.repoId}?tab=artifacts`}
                >
                  {t('kb.openArtifacts')}
                </Button>
              </div>
            </div>
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.owner')}>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.tags')} hint={t('kb.field.tagsHint')}>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('kb.field.tagsPlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('kb.field.description')}>
            <ConsoleTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </ConsoleFormField>

          <div className="space-y-2 border-t-0 pt-3">
            <h3 className="text-sm font-medium text-ink">
              {t('kb.artifacts.title')}
            </h3>
            {artifacts.length === 0 ? (
              <p className="text-xs text-ink-faint">{t('kb.artifacts.empty')}</p>
            ) : (
              <ul className="space-y-1.5">
                {artifacts.map((art) => (
                  <ArtifactRow
                    key={art.id}
                    artifact={art}
                    released={marketRel?.artifactId === art.id}
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">{t('kb.docs.title')}</h2>
            <Button size="sm" variant="outline" type="button" onClick={addDoc}>
              {t('kb.docs.add')}
            </Button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
            {kb.documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm ${
                    doc.id === activeDoc.id
                      ? 'bg-control-fill text-ink'
                      : 'text-ink-muted hover:bg-surface hover:text-ink'
                  }`}
                  onClick={() => selectDoc(doc)}
                >
                  <span className="w-full truncate font-medium">{doc.title}</span>
                  <span className="w-full truncate font-mono text-[11px] text-ink-faint">
                    {doc.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {kb.documents.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setPendingDeleteDoc(activeDoc)}
            >
              {t('kb.docs.delete')}
            </Button>
          ) : null}
        </Card>

        <div className="space-y-2">
          <ConsoleFormField label={t('kb.doc.title')}>
            <Input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
            />
          </ConsoleFormField>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">
              {t('kb.editor.title')}
            </h2>
            <span className="text-xs text-ink-faint">{t('kb.editor.hint')}</span>
          </div>
          <OfficeMarkdownEditor content={content} onChange={setContent} />
        </div>
      </div>

      <ConsoleConfirmDialog
        open={Boolean(pendingDeleteDoc)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteDoc(null);
        }}
        title={t('kb.docs.deleteConfirmTitle')}
        description={t('kb.docs.deleteConfirmBody')}
        confirmLabel={t('kb.docs.delete')}
        cancelLabel={t('kb.cancel')}
        tone="danger"
        onConfirm={removeDoc}
      />

      <ConsoleDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={t('kb.publishTitle')}
        description={t('kb.publishBody')}
        size="md"
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setPublishOpen(false)}
            >
              {t('kb.cancel')}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!selectedArtifactId}
              onClick={onPublish}
            >
              {t('kb.publishConfirm')}
            </Button>
          </>
        }
      >
        {publishable.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('kb.publishEmpty')}</p>
        ) : (
          <ConsoleFormField label={t('kb.publishPick')}>
            <SearchSelect
              value={selectedArtifactId}
              onChange={setSelectedArtifactId}
              allowClear={false}
              options={publishable.map((art) => ({
                value: art.id,
                label: `${art.version} · ${shortDigest(art.digest)} · ${shortSha(art.sourceRevision)}`,
              }))}
            />
          </ConsoleFormField>
        )}
        <p className="mt-2 text-xs text-ink-faint">
          {t('kb.publishGuard')}{' '}
          <Link
            to={`/admin/eng/repos/${kb.repoId}?tab=artifacts`}
            className="text-[color:var(--color-text-link)] hover:opacity-80"
          >
            {t('kb.openArtifacts')}
          </Link>
        </p>
      </ConsoleDialog>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
        <DetailPageNav onBack={onClose} />
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">{kb.name}</h2>
            <p className="text-sm text-ink-muted">{t('kb.detail.pipelineHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <AdminPageShell
      title={kb.name}
      description={t('kb.detail.pipelineHint')}
      backTo="/admin/knowledge-bases"
      crumbs={[
        { label: t('nav.knowledgeBases'), to: '/knowledge-bases' },
        { label: kb.name },
      ]}
      actions={actions}
    >
      {body}
    </AdminPageShell>
  );
}

function ArtifactRow({
  artifact,
  released,
}: {
  artifact: SupplyArtifact;
  released: boolean;
}) {
  const { t } = useI18n();
  return (
    <li className="rounded-md bg-surface px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-medium text-ink">{artifact.version}</span>
        {released ? (
          <Badge tone="success">{t('kb.artifacts.released')}</Badge>
        ) : artifact.status === 'success' ? (
          <Badge tone="primary">{t('kb.artifacts.ready')}</Badge>
        ) : (
          <Badge tone="neutral">{artifact.status}</Badge>
        )}
      </div>
      <div className="mt-0.5 font-mono text-ink-faint">
        {shortDigest(artifact.digest)} · {shortSha(artifact.sourceRevision)}
      </div>
    </li>
  );
}
