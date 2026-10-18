import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  ConsoleEmptyState,
  FileDropzone,
  ConsoleFormField,
  Input,
  MetaSummary,
  PopConfirm,
  useToast,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconDownload, IconEdit, IconRotateCcw, IconTrash } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { saveDownload } from '@/lib/assetHubApi';
import {
  deleteModel,
  deleteModelFile,
  downloadModelFile,
  getModel,
  modelTasks,
  syncModel,
  uploadModelFile,
  type HubModel,
} from '@/lib/modelHubApi';
import { startImport } from '@/lib/modelsApi';
import { listInferenceDeployments } from '@/lib/inferenceApi';
import { AssetFileBrowser, canPreviewAssetFile } from '@/pages/assets/shared/AssetDocument';
import { AssetDetailStatus, AssetDetailTabs, AssetMark, DeleteAssetZone, ReadmeView } from '@/pages/assets/shared/AssetHub';
import { formatBytes, formatCount, formatDate } from '@/pages/assets/shared/format';
import { hubLabel, modelDomainColor, taskDomainLabel, taskLabel } from '@/pages/assets/shared/taxonomy';
import { errorMessage, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { deploymentsForRepo } from '@/pages/modelService/deploymentScope';
import { ModelDeploymentsPanel } from '@/pages/modelService/ModelDeploymentsPanel';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';
import { ModelEditDialog } from './ModelDialogs';

const LIST_PATH = '/admin/assets/models';

function hubUrl(model: HubModel): string | null {
  if (!model.source) return null;
  return model.source.hub === 'huggingface'
    ? `https://huggingface.co/${model.source.repo}`
    : `https://www.modelscope.cn/models/${model.source.repo}`;
}

export function ModelDetailPage() {
  const { owner = '', name = '' } = useParams();
  const { search } = useLocation();
  const detail = useAssetQuery(`${owner}/${name}`, () => getModel(owner, name));
  const model = detail.data;
  const backTo = `${LIST_PATH}${search}`;

  if (!model) {
    return (
      <AdminPageShell title={`${owner}/${name}`} backTo={backTo}>
        <AssetDetailStatus
          loading={detail.loading}
          missing={detail.missing}
          error={detail.error}
          onRetry={detail.reload}
        />
      </AdminPageShell>
    );
  }
  return <ModelDetail model={model} onChange={detail.setData} backTo={backTo} />;
}

function ModelDetail({
  model,
  onChange,
  backTo,
}: {
  model: HubModel;
  onChange: (model: HubModel) => void;
  backTo: string;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const tasks = useAssetQuery('tasks', modelTasks);
  const scope = useCloudScopeContext();
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [view, setView] = useState('readme');
  const [deploymentCount, setDeploymentCount] = useState(0);
  const fullName = `${model.owner}/${model.name}`;
  const link = hubUrl(model);

  useEffect(() => {
    if (!scope.projectId || !scope.envId) {
      setDeploymentCount(0);
      return;
    }
    let cancelled = false;
    listInferenceDeployments(scope.projectId, scope.envId)
      .then((rows) => {
        if (!cancelled) setDeploymentCount(deploymentsForRepo(rows, fullName).length);
      })
      .catch(() => {
        if (!cancelled) setDeploymentCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [fullName, scope.envId, scope.projectId]);

  const sync = async () => {
    setSyncing(true);
    try {
      onChange(await syncModel(model.owner, model.name));
      toast.push({ tone: 'success', title: t('assets.models.toast.synced') });
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setSyncing(false);
    }
  };

  const pullWeights = async () => {
    if (!model.source) return;
    setPulling(true);
    try {
      const result = await startImport({
        hub: model.source.hub,
        repo_id: model.source.repo,
        // The supply defaults (*.safetensors/*.bin/…) miss ONNX exports and
        // sentencepiece vocabularies the local engines install from.
        include_globs: [
          '*.safetensors',
          '*.bin',
          '*.onnx',
          '*.onnx_data',
          '*.gguf',
          'config.json',
          'tokenizer*',
          'special_tokens_map.json',
          'sentencepiece.bpe.model',
        ],
      });
      toast.push({
        tone: 'success',
        title: t('assets.models.toast.pullStarted'),
        description: `${t('assets.models.toast.pullImportId')}: ${result.id}`,
      });
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setPulling(false);
    }
  };

  const remove = async () => {
    try {
      await deleteModel(model.owner, model.name);
      toast.push({ tone: 'success', title: t('assets.toast.deleted') });
      navigate(backTo);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  return (
    <AdminPageShell
      title={fullName}
      description={model.summary || undefined}
      backTo={backTo}
      crumbs={[{ label: t('assets.models.title'), to: backTo }, { label: fullName }]}
      actions={
        <>
          {model.source ? (
            <>
              <Button size="sm" variant="outline" loading={syncing} onClick={() => void sync()}>
                <IconRotateCcw />
                {t('assets.models.sync')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                loading={pulling}
                onClick={() => void pullWeights()}
              >
                <IconDownload />
                {t('assets.models.pullWeights')}
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <IconEdit />
            {t('assets.action.edit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <AssetMark name={model.name} color={modelDomainColor(model.domain)} size={32} />
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{taskLabel(model.task, locale)}</Badge>
            <Badge tone="neutral">{taskDomainLabel(model.domain, locale)}</Badge>
            {model.parameters ? <Badge tone="neutral">{model.parameters}</Badge> : null}
            {model.license ? <Badge tone="neutral">{model.license}</Badge> : null}
            {model.frameworks.map((framework) => (
              <Badge key={framework} tone="neutral">
                {framework}
              </Badge>
            ))}
            {model.languages.map((language) => (
              <Badge key={language} tone="neutral">
                {language}
              </Badge>
            ))}
            {model.visibility === 'private' ? (
              <Badge tone="warn">{t('assets.models.visibility.private')}</Badge>
            ) : null}
            <CopyButton value={fullName} label={t('assets.action.copyName')} />
          </div>
        </div>
        <MetaSummary
          aria-label={t('assets.detail.sections')}
          items={[
            { id: 'downloads', label: t('assets.stat.downloads'), value: formatCount(model.downloads, locale) },
            { id: 'likes', label: t('assets.stat.likes'), value: formatCount(model.likes, locale) },
            { id: 'files', label: t('assets.stat.files'), value: model.fileCount },
            { id: 'size', label: t('assets.stat.size'), value: formatBytes(model.size) },
            { id: 'updated', label: t('assets.stat.updated'), value: formatDate(model.updatedAt, locale) },
            ...(model.source && link
              ? [
                  {
                    id: 'source',
                    label: hubLabel(model.source.hub, locale),
                    value: (
                      <a href={link} target="_blank" rel="noreferrer" className="text-[color:var(--color-text-link)]">
                        {model.source.repo}
                        {model.source.revision ? `@${model.source.revision.slice(0, 12)}` : ''}
                      </a>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <AssetDetailTabs
          label={t('assets.detail.sections')}
          value={view}
          onChange={setView}
          options={[
            { value: 'readme', label: t('assets.models.tab.readme') },
            { value: 'files', label: t('assets.models.tab.files'), count: model.fileCount },
            { value: 'inference', label: t('nav.modelService'), count: deploymentCount },
            { value: 'settings', label: t('assets.tab.settings') },
          ]}
        />
        <div className="pt-4">
          {view === 'readme' ? <ReadmeView markdown={model.readme} /> : null}
          {view === 'files' ? <ModelFiles model={model} onChange={onChange} /> : null}
          {view === 'inference' ? (
            <ModelDeploymentsPanel repoId={fullName} onCount={setDeploymentCount} />
          ) : null}
          {view === 'settings' ? (
            <DeleteAssetZone
              name={fullName}
              description={t('assets.models.danger.desc')}
              onDelete={remove}
            />
          ) : null}
        </div>
      </div>
      <ModelEditDialog
        open={editing}
        onOpenChange={setEditing}
        model={model}
        taskGroups={tasks.data ?? []}
        onSaved={(saved) => {
          onChange(saved);
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
        }}
      />
    </AdminPageShell>
  );
}

function ModelFiles({ model, onChange }: { model: HubModel; onChange: (model: HubModel) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [folder, setFolder] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const previewTicket = useRef(0);

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      let latest = model;
      for (const file of files) {
        const prefix = folder.trim().replace(/^\/+|\/+$/g, '');
        latest = await uploadModelFile(
          model.owner,
          model.name,
          file,
          prefix ? `${prefix}/${file.name}` : undefined,
        );
      }
      onChange(latest);
      toast.push({ tone: 'success', title: t('assets.models.toast.uploaded') });
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  const download = async (path: string) => {
    try {
      saveDownload(await downloadModelFile(model.owner, model.name, path));
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  const remove = async (path: string) => {
    try {
      onChange(await deleteModelFile(model.owner, model.name, path));
      if (selected === path) setSelected('');
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  const openFile = (path: string) => {
    const ticket = previewTicket.current + 1;
    previewTicket.current = ticket;
    setSelected(path);
    setPreview(null);
    setPreviewError(null);
    setPreviewing(false);
    if (!path) return;
    const file = model.files.find((item) => item.path === path);
    if (!file || file.storage === 'remote' || !canPreviewAssetFile(file.path, file.size)) return;
    setPreviewing(true);
    void downloadModelFile(model.owner, model.name, path)
      .then(async (saved) => {
        if (previewTicket.current !== ticket) return;
        if (saved.kind === 'link') return;
        const raw = await saved.blob.text();
        if (previewTicket.current !== ticket) return;
        if (!raw.includes('\0')) setPreview(raw);
      })
      .catch((err: unknown) => {
        if (previewTicket.current === ticket) setPreviewError(errorMessage(err));
      })
      .finally(() => {
        if (previewTicket.current === ticket) setPreviewing(false);
      });
  };

  const selectedFile = model.files.find((file) => file.path === selected);
  const previewNotice = !selectedFile
    ? null
    : selectedFile.storage === 'remote'
      ? t('assets.files.remote')
      : canPreviewAssetFile(selectedFile.path, selectedFile.size)
        ? null
        : t('assets.files.binary');
  const fileActions = selected ? (
    <>
      <Button size="sm" variant="ghost" aria-label={t('assets.action.download')} onClick={() => void download(selected)}>
        <IconDownload />
      </Button>
      <PopConfirm
        tone="danger"
        title={t('assets.models.files.deleteConfirm')}
        confirmLabel={t('assets.action.delete')}
        cancelLabel={t('assets.action.cancel')}
        onConfirm={() => remove(selected)}
      >
        <Button size="sm" variant="ghost" aria-label={t('assets.action.delete')}>
          <IconTrash />
        </Button>
      </PopConfirm>
    </>
  ) : null;

  return (
    <div className="space-y-3">
      {model.source ? <Alert tone="info">{t('assets.models.files.remoteHint')}</Alert> : null}
      <div className="grid gap-3 md:grid-cols-[240px_1fr]">
        <ConsoleFormField label={t('assets.models.files.folder')} hint={t('assets.models.files.folderHint')}>
          <Input value={folder} placeholder="onnx" onChange={(event) => setFolder(event.target.value)} />
        </ConsoleFormField>
        <FileDropzone
          multiple
          disabled={uploading}
          label={uploading ? t('assets.models.files.uploading') : t('assets.models.files.drop')}
          hint={t('assets.models.files.dropHint')}
          onFiles={(files) => void upload(files)}
        />
      </div>
      {model.files.length === 0 ? (
        <ConsoleEmptyState plain title={t('assets.models.files.empty')} />
      ) : (
        <AssetFileBrowser
          files={model.files}
          rootLabel={`${model.owner}/${model.name}`}
          selected={selected}
          onSelect={openFile}
          loading={previewing}
          text={preview}
          error={previewError}
          emptyLabel={previewNotice ?? t('assets.files.binary')}
          annotate={(path) => {
            const file = model.files.find((item) => item.path === path);
            if (!file) return null;
            return (
              <Badge tone={file.storage === 'stored' ? 'success' : 'neutral'}>
                {file.storage === 'stored' ? t('assets.models.files.stored') : t('assets.models.files.remote')}
              </Badge>
            );
          }}
          rowActions={(file) => (
            <>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t('assets.action.download')}
                onClick={() => void download(file.path)}
              >
                <IconDownload />
              </Button>
              <PopConfirm
                tone="danger"
                title={t('assets.models.files.deleteConfirm')}
                confirmLabel={t('assets.action.delete')}
                cancelLabel={t('assets.action.cancel')}
                onConfirm={() => remove(file.path)}
              >
                <Button size="sm" variant="ghost" aria-label={t('assets.action.delete')}>
                  <IconTrash />
                </Button>
              </PopConfirm>
            </>
          )}
          fileActions={fileActions}
        />
      )}
    </div>
  );
}
