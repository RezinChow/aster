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
  languageFromPath,
  VsCodeEditor,
} from '@/components/VsCodeEditor';
import {
  CODE_PACKAGE_LIST_PATH,
  buildCodePackageArtifact,
  codePackageArtifacts,
  codePackageMarketRelease,
  codePackageMarketState,
  codePackagePublishableArtifacts,
  commitCodePackageSource,
  deleteCodeFile,
  findCodePackage,
  publishCodePackageToMarket,
  updateCodePackage,
  upsertCodeFile,
  type CodeFile,
  type CodePackage,
  type CodePackageKind,
  type CodePackageLifecycle,
  type CodePackageMarketState,
} from '@/data/codePackages';
import { findSourceRepo, shortSha } from '@/data/sources';
import { shortDigest, type SupplyArtifact } from '@/data/supply';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';

const STATE_LABEL: Record<CodePackageMarketState, MessageKey> = {
  listed: 'pkg.state.listed',
  built: 'pkg.state.built',
  source: 'pkg.state.source',
  archived: 'pkg.state.archived',
};

const KIND_NAV_LABEL: Record<CodePackageKind, MessageKey> = {
  applet: 'nav.applets',
  api: 'nav.apiServices',
  connector: 'nav.connectors',
  tool: 'nav.tools',
  agent: 'nav.agents',
  workflow: 'nav.workflows',
  model: 'nav.models',
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

export function CodePackageDetailPage({
  kind,
  packageId,
  onClose,
}: {
  kind: CodePackageKind;
  /** When set (e.g. fullscreen list editor), overrides route param */
  packageId?: string;
  /** Present → embedded fullscreen dialog mode */
  onClose?: () => void;
}) {
  const { id: routeId = '' } = useParams();
  const id = packageId ?? routeId;
  const embedded = typeof onClose === 'function';
  const { t } = useI18n();
  const toast = useToast();
  const basePath = CODE_PACKAGE_LIST_PATH[kind];
  const base = findCodePackage(kind, id);
  const [pkg, setPkg] = useState<CodePackage | undefined>(base);
  const [name, setName] = useState(base?.name ?? '');
  const [description, setDescription] = useState(base?.description ?? '');
  const [author, setAuthor] = useState(base?.author ?? '');
  const [lifecycle, setLifecycle] = useState<CodePackageLifecycle>(
    base?.lifecycle ?? 'active',
  );
  const [tags, setTags] = useState(base?.tags.join(', ') ?? '');
  const [activeFileId, setActiveFileId] = useState(base?.files[0]?.id ?? '');
  const activeFile = useMemo(
    () => pkg?.files.find((f) => f.id === activeFileId) ?? pkg?.files[0],
    [activeFileId, pkg],
  );
  const [filePath, setFilePath] = useState(activeFile?.path ?? '');
  const [fileContent, setFileContent] = useState(activeFile?.content ?? '');
  const [pendingDeleteFile, setPendingDeleteFile] = useState<CodeFile | null>(
    null,
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [artifacts, setArtifacts] = useState(() =>
    base ? codePackageArtifacts(kind, base.id) : [],
  );
  const [publishable, setPublishable] = useState(() =>
    base ? codePackagePublishableArtifacts(kind, base.id) : [],
  );
  const [marketRel, setMarketRel] = useState(() =>
    base ? codePackageMarketRelease(base.id) : undefined,
  );

  const repo = pkg ? findSourceRepo(pkg.repoId) : undefined;
  const marketState = pkg ? codePackageMarketState(pkg) : 'source';

  const metaDirty = useMemo(() => {
    if (!pkg) return false;
    const nextTags = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      name !== pkg.name ||
      description !== pkg.description ||
      author !== pkg.author ||
      lifecycle !== pkg.lifecycle ||
      nextTags.join(',') !== pkg.tags.join(',')
    );
  }, [author, description, lifecycle, name, pkg, tags]);

  const fileDirty = useMemo(() => {
    if (!activeFile) return false;
    return (
      filePath !== activeFile.path || fileContent !== activeFile.content
    );
  }, [activeFile, fileContent, filePath]);

  if (!base || !pkg || !activeFile) {
    if (embedded) return null;
    return <Navigate to={basePath} replace />;
  }

  const refreshSupply = (next: CodePackage) => {
    setPkg(next);
    setArtifacts(codePackageArtifacts(kind, next.id));
    setPublishable(codePackagePublishableArtifacts(kind, next.id));
    setMarketRel(codePackageMarketRelease(next.id));
  };

  const selectFile = (file: CodeFile) => {
    setActiveFileId(file.id);
    setFilePath(file.path);
    setFileContent(file.content);
  };

  const saveMeta = () => {
    const nextTags = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = updateCodePackage(kind, pkg.id, {
      name: name.trim() || pkg.name,
      description: description.trim(),
      author: author.trim() || pkg.author,
      lifecycle,
      tags: nextTags,
    });
    if (!updated) return;
    refreshSupply(updated);
    toast.push({ title: t('pkg.toast.metaSaved'), tone: 'success' });
  };

  const saveFileLocal = () => {
    const updated = upsertCodeFile(kind, pkg.id, {
      id: activeFile.id,
      path: filePath.trim() || activeFile.path,
      language: languageFromPath(filePath.trim() || activeFile.path),
      content: fileContent,
    });
    if (!updated) return;
    refreshSupply(updated);
    const next = updated.files.find((f) => f.id === activeFile.id);
    if (next) {
      setFilePath(next.path);
      setFileContent(next.content);
    }
    return updated;
  };

  const commitSource = () => {
    if (fileDirty) saveFileLocal();
    const updated = commitCodePackageSource(kind, pkg.id);
    if (!updated) return;
    refreshSupply(updated);
    toast.push({ title: t('pkg.toast.committed'), tone: 'success' });
  };

  const addFile = () => {
    const updated = upsertCodeFile(kind, pkg.id, {
      path: 'src/new-file.ts',
      language: 'typescript',
      content: '// new file\n',
    });
    if (!updated) return;
    refreshSupply(updated);
    const created = updated.files[0];
    if (created) selectFile(created);
    toast.push({ title: t('pkg.toast.fileCreated'), tone: 'success' });
  };

  const removeFile = () => {
    if (!pendingDeleteFile) return;
    const updated = deleteCodeFile(kind, pkg.id, pendingDeleteFile.id);
    setPendingDeleteFile(null);
    if (!updated) return;
    refreshSupply(updated);
    const next = updated.files[0];
    if (next) selectFile(next);
    toast.push({ title: t('pkg.toast.fileDeleted'), tone: 'success' });
  };

  const onBuild = () => {
    if (metaDirty || fileDirty) {
      toast.push({ title: t('pkg.toast.commitFirst'), tone: 'info' });
      return;
    }
    const artifact = buildCodePackageArtifact(kind, pkg.id);
    if (!artifact) return;
    setArtifacts(codePackageArtifacts(kind, pkg.id));
    setPublishable(codePackagePublishableArtifacts(kind, pkg.id));
    toast.push({
      title: t('pkg.toast.built'),
      description: `${artifact.version} · ${shortDigest(artifact.digest)}`,
      tone: 'success',
    });
  };

  const openPublish = () => {
    const list = codePackagePublishableArtifacts(kind, pkg.id);
    setPublishable(list);
    setSelectedArtifactId(list[0]?.id ?? '');
    setPublishOpen(true);
  };

  const onPublish = () => {
    if (!selectedArtifactId) return;
    const release = publishCodePackageToMarket(
      kind,
      pkg.id,
      selectedArtifactId,
    );
    if (!release) {
      toast.push({ title: t('pkg.toast.publishFailed'), tone: 'danger' });
      return;
    }
    setPublishOpen(false);
    setMarketRel(release);
    setPublishable(codePackagePublishableArtifacts(kind, pkg.id));
    toast.push({
      title: t('pkg.toast.published'),
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
        {t('pkg.saveMeta')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={!fileDirty && !metaDirty}
        onClick={commitSource}
      >
        {t('pkg.commit')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={onBuild}
        disabled={lifecycle === 'archived'}
      >
        {t('pkg.build')}
      </Button>
      <Button
        size="sm"
        type="button"
        onClick={openPublish}
        disabled={lifecycle === 'archived' || publishable.length === 0}
      >
        {t('pkg.publish')}
      </Button>
    </>
  );

  const body = (
    <>
      <ResourceMetaHeader
        title={pkg.name}
        badge={
          <Badge tone={stateTone(marketState)}>
            {t(STATE_LABEL[marketState])}
          </Badge>
        }
        summary={[
          {
            id: 'repo',
            label: t('pkg.col.repo'),
            value: repo?.fullName ?? pkg.repoId,
          },
          {
            id: 'head',
            label: t('pkg.meta.head'),
            value: repo ? shortSha(repo.latestRevision) : '—',
          },
          {
            id: 'market',
            label: t('pkg.col.marketVersion'),
            value: marketRel?.version ?? '—',
          },
        ]}
      />

      <p className="text-sm text-ink-muted">{t('pkg.supply.banner')}</p>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,240px)_minmax(0,220px)_minmax(0,1fr)]">
        <Card className="space-y-3 p-3">
          <ConsoleFormField label={t('pkg.field.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.lifecycle')}>
            <SearchSelect
              value={lifecycle}
              onChange={(v) => setLifecycle(v as CodePackageLifecycle)}
              searchable={false}
              allowClear={false}
              options={[
                { value: 'active', label: t('pkg.lifecycle.active') },
                { value: 'archived', label: t('pkg.lifecycle.archived') },
              ]}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.repo')}>
            <div className="space-y-1">
              <p className="font-mono text-sm text-ink">
                {repo?.fullName ?? pkg.repoId}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" to="/admin/sources">
                  {t('pkg.openSources')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  to={`/admin/eng/repos/${pkg.repoId}?tab=pipelines`}
                >
                  {t('pkg.openPipelines')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  to={`/admin/eng/repos/${pkg.repoId}?tab=artifacts`}
                >
                  {t('pkg.openArtifacts')}
                </Button>
              </div>
            </div>
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.author')}>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.tags')} hint={t('pkg.field.tagsHint')}>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('pkg.field.tagsPlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('pkg.field.description')}>
            <ConsoleTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </ConsoleFormField>

          <div className="space-y-2 border-t-0 pt-3">
            <h3 className="text-sm font-medium text-ink">
              {t('pkg.artifacts.title')}
            </h3>
            {artifacts.length === 0 ? (
              <p className="text-xs text-ink-faint">{t('pkg.artifacts.empty')}</p>
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
            <h2 className="text-sm font-medium text-ink">{t('pkg.files.title')}</h2>
            <Button size="sm" variant="outline" type="button" onClick={addFile}>
              {t('pkg.files.add')}
            </Button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
            {pkg.files.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm ${
                    file.id === activeFile.id
                      ? 'bg-control-fill text-ink'
                      : 'text-ink-muted hover:bg-surface hover:text-ink'
                  }`}
                  onClick={() => selectFile(file)}
                >
                  <span className="w-full truncate font-mono text-[12px]">
                    {file.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {pkg.files.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setPendingDeleteFile(activeFile)}
            >
              {t('pkg.files.delete')}
            </Button>
          ) : null}
        </Card>

        <div className="space-y-2">
          <ConsoleFormField label={t('pkg.file.path')}>
            <Input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="font-mono"
            />
          </ConsoleFormField>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">
              {t('pkg.editor.title')}
            </h2>
            <span className="text-xs text-ink-faint">{t('pkg.editor.hint')}</span>
          </div>
          <VsCodeEditor
            path={filePath || activeFile.path}
            language={languageFromPath(filePath || activeFile.path)}
            value={fileContent}
            onChange={setFileContent}
          />
        </div>
      </div>

      <ConsoleConfirmDialog
        open={Boolean(pendingDeleteFile)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteFile(null);
        }}
        title={t('pkg.files.deleteConfirmTitle')}
        description={t('pkg.files.deleteConfirmBody')}
        confirmLabel={t('pkg.files.delete')}
        cancelLabel={t('pkg.cancel')}
        tone="danger"
        onConfirm={removeFile}
      />

      <ConsoleDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={t('pkg.publishTitle')}
        description={t('pkg.publishBody')}
        size="md"
        footer={
          <>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setPublishOpen(false)}
            >
              {t('pkg.cancel')}
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!selectedArtifactId}
              onClick={onPublish}
            >
              {t('pkg.publishConfirm')}
            </Button>
          </>
        }
      >
        {publishable.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('pkg.publishEmpty')}</p>
        ) : (
          <ConsoleFormField label={t('pkg.publishPick')}>
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
          {t('pkg.publishGuard')}{' '}
          <Link
            to={`/admin/eng/repos/${pkg.repoId}?tab=artifacts`}
            className="text-[color:var(--color-text-link)] hover:opacity-80"
          >
            {t('pkg.openArtifacts')}
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
            <h2 className="text-lg font-semibold text-ink">{pkg.name}</h2>
            <p className="text-sm text-ink-muted">{t('pkg.detail.pipelineHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <AdminPageShell
      title={pkg.name}
      description={t('pkg.detail.pipelineHint')}
      backTo={basePath}
      crumbs={[
        { label: t(KIND_NAV_LABEL[kind]), to: basePath },
        { label: pkg.name },
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
          <Badge tone="success">{t('pkg.artifacts.released')}</Badge>
        ) : artifact.status === 'success' ? (
          <Badge tone="primary">{t('pkg.artifacts.ready')}</Badge>
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
