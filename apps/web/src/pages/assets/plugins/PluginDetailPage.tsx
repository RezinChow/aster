import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, SearchSelect, Switch, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconEdit } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  compareReleases,
  deletePlugin,
  getGeneration,
  getPlugin,
  listReleases,
  pluginId,
  pluginSurfaceKey,
  setPluginEnabled,
  type PackageRelease,
  type PathChange,
  type PluginCard,
} from '@/lib/pluginHubApi';
import { AssetFileBrowser, type AssetFileEntry } from '@/pages/assets/shared/AssetDocument';
import { AssetDetailStatus, AssetDetailTabs, AssetMark, DeleteAssetZone } from '@/pages/assets/shared/AssetHub';
import {
  RepoAbout,
  RepoCodeMenu,
  RepoCopyBlock,
  RepoHome,
  RepoInstallCount,
  RepoReadme,
  RepoRef,
  RepoSettings,
} from '@/pages/assets/shared/RepoDetail';
import { formatCount, formatDate } from '@/pages/assets/shared/format';
import { errorMessage, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { PluginDialog } from './PluginDialog';
import { PLUGINS_PATH } from './PluginHubPage';

function releaseKey(release: PackageRelease): string {
  return `${release.version}@${release.digest}`;
}

function defaultFile(files: PluginCard['files']): string {
  if (!files || files.length === 0) return '';
  if (files.some((file) => file.path === 'README.md')) return 'README.md';
  return files[0]?.path ?? '';
}

export function PluginDetailPage() {
  const { publisher = '', name = '' } = useParams();
  const { search } = useLocation();
  const detail = useAssetQuery(`${publisher}/${name}`, () => getPlugin(publisher, name));
  const backTo = `${PLUGINS_PATH}${search}`;
  if (!detail.data) {
    return (
      <AdminPageShell title={name || publisher} backTo={backTo}>
        <AssetDetailStatus
          loading={detail.loading}
          missing={detail.missing}
          error={detail.error}
          onRetry={detail.reload}
        />
      </AdminPageShell>
    );
  }
  return <PluginDetail plugin={detail.data} onChange={detail.setData} backTo={backTo} />;
}

export function PluginDetail({
  plugin,
  onChange,
  backTo,
  sectionLabel,
  heading,
  dialogLabels,
  dangerDescription,
}: {
  plugin: PluginCard;
  onChange: (plugin: PluginCard) => void;
  backTo: string;
  sectionLabel?: string;
  /** Visible name when it differs from the package name. */
  heading?: string;
  dialogLabels?: { create: string; edit: string; description: string };
  dangerDescription?: string;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [view, setView] = useState('code');
  const files = plugin.files ?? [];
  const [filePath, setFilePath] = useState(() => defaultFile(files));
  const [releases, setReleases] = useState<PackageRelease[]>([]);
  const [selected, setSelected] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [changes, setChanges] = useState<PathChange[]>([]);
  const [generationFiles, setGenerationFiles] = useState<PluginCard['files'] | null>(null);
  const currentRelease = releases.find((release) => release.version === plugin.version) ?? null;
  const selectedRelease = releases.find((release) => releaseKey(release) === selected) ?? currentRelease;
  const historical = Boolean(
    selectedRelease && currentRelease && releaseKey(selectedRelease) !== releaseKey(currentRelease),
  );
  const shownFiles = historical ? (generationFiles ?? []) : files;

  useEffect(() => {
    let live = true;
    listReleases(plugin.publisher, plugin.name)
      .then((rows) => {
        if (live) setReleases(rows);
      })
      .catch(() => {
        if (live) setReleases([]);
      });
    return () => {
      live = false;
    };
  }, [plugin.publisher, plugin.name, plugin.version, plugin.updatedAt]);

  useEffect(() => {
    if (!historical || !selectedRelease) {
      setGenerationFiles(null);
      return;
    }
    let live = true;
    getGeneration(plugin.publisher, plugin.name, selectedRelease.version, selectedRelease.digest)
      .then((card) => {
        if (live) setGenerationFiles(card.files ?? []);
      })
      .catch(() => {
        if (live) setGenerationFiles([]);
      });
    return () => {
      live = false;
    };
  }, [historical, plugin.publisher, plugin.name, selectedRelease]);

  useEffect(() => {
    if (!selectedRelease || !compareTo) {
      setChanges([]);
      return;
    }
    const other = releases.find((release) => releaseKey(release) === compareTo);
    if (!other || releaseKey(other) === releaseKey(selectedRelease)) {
      setChanges([]);
      return;
    }
    let live = true;
    compareReleases(plugin.publisher, plugin.name, other, selectedRelease)
      .then((rows) => {
        if (live) setChanges(rows);
      })
      .catch(() => {
        if (live) setChanges([]);
      });
    return () => {
      live = false;
    };
  }, [compareTo, plugin.publisher, plugin.name, releases, selectedRelease]);
  const id = pluginId(plugin);
  const visibleName = heading?.trim() || plugin.name;
  const specifier = `${id}@${plugin.version}`;
  const documents = useMemo(() => {
    const text = new Map<string, string>();
    for (const file of shownFiles) {
      if (typeof file.text === 'string') text.set(file.path, file.text);
    }
    return {
      files: shownFiles.map((file): AssetFileEntry => ({ path: file.path, size: file.size })),
      text,
    };
  }, [shownFiles]);

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      onChange(await setPluginEnabled(plugin.publisher, plugin.name, enabled));
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setToggling(false);
    }
  };

  const remove = async () => {
    try {
      await deletePlugin(plugin.publisher, plugin.name);
      toast.push({ tone: 'success', title: t('assets.toast.deleted') });
      navigate(backTo);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  return (
    <AdminPageShell
      title={visibleName}
      titlePrefix={visibleName === plugin.name ? plugin.publisher : id}
      leading={<AssetMark name={visibleName} color={plugin.color} iconUrl={plugin.logoUrl} size={32} />}
      titleAdornment={
        <>
          <Badge tone={plugin.enabled ? 'success' : 'neutral'}>
            {plugin.enabled ? t('assets.status.enabled') : t('assets.status.disabled')}
          </Badge>
          {plugin.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
        </>
      }
      backTo={backTo}
      crumbs={[{ label: sectionLabel ?? t('assets.plugins.title'), to: backTo }, { label: visibleName }]}
      actions={
        <>
          <RepoInstallCount label={t('assets.stat.installs')} value={formatCount(plugin.installs, locale)} />
          {historical ? null : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <IconEdit />
              {t('assets.action.edit')}
            </Button>
          )}
        </>
      }
    >
      {plugin.coverUrl ? (
        <img
          src={plugin.coverUrl}
          alt=""
          width={320}
          height={132}
          className="mb-4 aspect-[320/132] w-full max-w-[320px] rounded-[14px] object-cover"
        />
      ) : null}
      <AssetDetailTabs
        label={t('assets.detail.sections')}
        packed
        value={view}
        onChange={setView}
        options={[
          { value: 'code', label: t('assets.tab.code') },
          { value: 'settings', label: t('assets.tab.settings') },
        ]}
      />
      <div className="pt-4">
        {view === 'code' ? (
          <RepoHome
            fileRef={<RepoRef label={selectedRelease?.version ?? plugin.version} />}
            fileOpen={filePath !== ''}
            codeMenu={
              <RepoCodeMenu label={t('assets.tab.code')}>
                <RepoCopyBlock label={t('assets.plugins.field.package')} value={specifier} />
              </RepoCodeMenu>
            }
            files={
              <AssetFileBrowser
                files={documents.files}
                rootLabel={id}
                selected={filePath}
                onSelect={setFilePath}
                loading={false}
                text={documents.text.get(filePath) ?? null}
                emptyLabel={t('assets.files.binary')}
              />
            }
            readme={
              <RepoReadme name="README.md" onEdit={() => setEditing(true)} editLabel={t('assets.action.edit')}>
                <p className="whitespace-pre-wrap px-4 py-3 text-[14px] leading-6 text-ink">
                  {documents.text.get('README.md')?.trim() || t('assets.repo.noDescription')}
                </p>
              </RepoReadme>
            }
            about={
              <div className="space-y-4">
              <RepoAbout
                description={plugin.description}
                topics={plugin.surfaces.map((surface) => t(pluginSurfaceKey(surface)))}
                facts={[
                  { label: t('assets.plugins.field.package'), value: id },
                  { label: t('assets.plugins.field.version'), value: plugin.version },
                  { label: t('assets.stat.installs'), value: formatCount(plugin.installs, locale) },
                  { label: t('assets.stat.updated'), value: formatDate(plugin.updatedAt, locale) },
                ]}
              />
              {releases.length > 0 ? (
                <div className="ui-card space-y-3 px-4 py-3">
                  <div className="text-sm font-medium text-ink">{t('assets.plugins.history')}</div>
                  <SearchSelect
                    size="sm"
                    value={selectedRelease ? releaseKey(selectedRelease) : ''}
                    searchable={releases.length > 8}
                    allowClear={false}
                    options={releases.map((release) => ({
                      value: releaseKey(release),
                      label: release.note ? `${release.version} ${release.note}` : release.version,
                    }))}
                    onChange={(next) => setSelected(next ?? '')}
                  />
                  <ul className="space-y-1 text-[13px] text-ink">
                    {releases.map((release) => (
                      <li key={releaseKey(release)}>
                        <button type="button" className="text-left" onClick={() => setSelected(releaseKey(release))}>
                          {release.version}
                          {release.note ? ` · ${release.note}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    {releases.map((release) => (
                      <button
                        key={`compare-${releaseKey(release)}`}
                        type="button"
                        className="rounded-md border border-[#e5e5e5] px-2 py-1"
                        onClick={() => setCompareTo(releaseKey(release))}
                      >
                        {t('assets.plugins.compare')} {release.version}
                      </button>
                    ))}
                  </div>
                  {changes.length > 0 ? (
                    <ul className="space-y-1 font-mono text-[12px] text-ink">
                      {changes.map((change) => (
                        <li key={change.path}>
                          {change.kind} {change.path}
                          {change.diff ? <pre className="whitespace-pre-wrap">{change.diff}</pre> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              </div>
            }
          />
        ) : null}
        {view === 'settings' ? (
          <RepoSettings
            general={
              <div className="ui-card flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{t('assets.settings.enabled')}</div>
                  <div className="text-xs text-ink-muted">{t('assets.plugins.settings.enabledHint')}</div>
                </div>
                <Switch checked={plugin.enabled} disabled={toggling} onCheckedChange={(enabled) => void toggle(enabled)} />
              </div>
            }
            danger={
              historical ? (
                <div />
              ) : (
                <DeleteAssetZone name={id} description={dangerDescription ?? t('assets.plugins.danger.desc')} onDelete={remove} />
              )
            }
          />
        ) : null}
      </div>
      <PluginDialog
        open={editing}
        onOpenChange={setEditing}
        plugin={plugin}
        labels={dialogLabels}
        onSaved={(saved) => {
          onChange(saved);
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
        }}
      />
    </AdminPageShell>
  );
}
