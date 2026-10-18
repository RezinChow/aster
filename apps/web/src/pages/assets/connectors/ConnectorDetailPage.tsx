import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, ConsoleEmptyState, Switch, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconEdit } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import {
  deleteConnector,
  getConnector,
  setConnectorEnabled,
  type Connector,
} from '@/lib/connectorHubApi';
import { AssetFileBrowser } from '@/pages/assets/shared/AssetDocument';
import { AssetDetailStatus, AssetDetailTabs, AssetMark, DeleteAssetZone, ReadmeView } from '@/pages/assets/shared/AssetHub';
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
import { categoryLabel, deploymentLabel, transportLabel } from '@/pages/assets/shared/taxonomy';
import { errorMessage, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { ConnectorDialog } from './ConnectorDialog';
import { CONNECTORS_PATH } from './ConnectorHubPage';

function connectorDocuments(connector: Connector): { path: string; size: number; text: string }[] {
  const readme = connector.readme ?? '';
  const mcp = JSON.stringify(connector.mcpConfig ?? {}, null, 2);
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  return [
    { path: 'README.md', size: bytes(readme), text: readme },
    { path: 'mcp.json', size: bytes(mcp), text: mcp },
  ];
}

function endpointOf(connector: Connector): string {
  if (connector.transport === 'stdio') {
    return [connector.command, ...connector.args].filter(Boolean).join(' ') || '—';
  }
  return connector.url || '—';
}

export function ConnectorDetailPage() {
  const { slug = '' } = useParams();
  const { search } = useLocation();
  const detail = useAssetQuery(slug, () => getConnector(slug));
  const backTo = `${CONNECTORS_PATH}${search}`;
  if (!detail.data) {
    return (
      <AdminPageShell title={slug} backTo={backTo}>
        <AssetDetailStatus
          loading={detail.loading}
          missing={detail.missing}
          error={detail.error}
          onRetry={detail.reload}
        />
      </AdminPageShell>
    );
  }
  return <ConnectorDetail connector={detail.data} onChange={detail.setData} backTo={backTo} />;
}

export function ConnectorDetail({
  connector,
  onChange,
  backTo,
}: {
  connector: Connector;
  onChange: (connector: Connector) => void;
  backTo: string;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [view, setView] = useState('code');
  const [filePath, setFilePath] = useState('');
  const documents = useMemo(() => connectorDocuments(connector), [connector]);
  const endpoint = endpointOf(connector);
  const mcp = documents.find((file) => file.path === 'mcp.json')?.text ?? '';

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      onChange(await setConnectorEnabled(connector.slug, enabled));
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setToggling(false);
    }
  };

  const remove = async () => {
    try {
      await deleteConnector(connector.slug);
      toast.push({ tone: 'success', title: t('assets.toast.deleted') });
      navigate(backTo);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  const topics = [
    categoryLabel(connector.category, locale),
    transportLabel(connector.transport, locale),
    deploymentLabel(connector.deployment, locale),
    ...connector.tags,
  ].filter((topic, index, all) => topic && all.indexOf(topic) === index);

  return (
    <AdminPageShell
      title={connector.name}
      titlePrefix={connector.provider || undefined}
      leading={<AssetMark name={connector.name} color={connector.color} iconUrl={connector.iconUrl} size={20} />}
      titleAdornment={
        <>
          <Badge tone={connector.enabled ? 'success' : 'neutral'}>
            {connector.enabled ? t('assets.status.enabled') : t('assets.status.disabled')}
          </Badge>
          {connector.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
        </>
      }
      backTo={backTo}
      crumbs={[{ label: t('assets.connectors.title'), to: backTo }, { label: connector.name }]}
      actions={
        <>
          <RepoInstallCount
            label={t('assets.stat.installs')}
            value={formatCount(connector.installs, locale)}
          />
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <IconEdit />
            {t('assets.action.edit')}
          </Button>
        </>
      }
    >
      <AssetDetailTabs
        label={t('assets.detail.sections')}
        packed
        value={view}
        onChange={setView}
        options={[
          { value: 'code', label: t('assets.tab.code') },
          { value: 'tools', label: t('assets.connectors.tab.tools'), count: connector.toolCount },
          { value: 'config', label: t('assets.connectors.tab.config') },
          { value: 'settings', label: t('assets.tab.settings') },
        ]}
      />
      <div className="pt-4">
        {view === 'code' ? (
          <RepoHome
            fileRef={<RepoRef label={transportLabel(connector.transport, locale)} />}
            fileOpen={filePath !== ''}
            codeMenu={
              <RepoCodeMenu label={t('assets.tab.code')}>
                <div className="space-y-3">
                  <RepoCopyBlock label={t('assets.connectors.config.endpoint')} value={endpoint} />
                  <RepoCopyBlock label="mcp.json" value={mcp} />
                </div>
              </RepoCodeMenu>
            }
            files={
              <AssetFileBrowser
                files={documents}
                rootLabel={connector.name}
                selected={filePath}
                onSelect={setFilePath}
                loading={false}
                text={documents.find((file) => file.path === filePath)?.text ?? null}
                emptyLabel={t('assets.files.binary')}
              />
            }
            readme={
              <RepoReadme name="README.md" onEdit={() => setEditing(true)} editLabel={t('assets.action.edit')}>
                <ReadmeView markdown={connector.readme} />
              </RepoReadme>
            }
            about={
              <RepoAbout
                description={connector.description}
                homepage={connector.homepage}
                topics={topics}
                facts={[
                  { label: t('assets.field.slug'), value: connector.slug },
                  { label: t('assets.connectors.field.provider'), value: connector.provider || '—' },
                  { label: t('assets.stat.tools'), value: String(connector.toolCount) },
                  { label: t('assets.stat.installs'), value: formatCount(connector.installs, locale) },
                  { label: t('assets.stat.updated'), value: formatDate(connector.updatedAt, locale) },
                  ...(connector.license
                    ? [{ label: t('assets.field.license'), value: connector.license }]
                    : []),
                ]}
              />
            }
          />
        ) : null}
        {view === 'tools' ? (
          connector.tools.length === 0 ? (
            <ConsoleEmptyState plain title={t('assets.connectors.tools.empty')} />
          ) : (
            <div className="overflow-hidden rounded-xl bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)]">
              {connector.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="space-y-0.5 border-b border-[color:var(--color-hairline)] px-4 py-3 last:border-b-0 hover:bg-[#f7f7f7]"
                >
                  <div className="font-mono text-[13px] text-ink">{tool.name}</div>
                  <div className="text-sm text-ink-muted">{tool.description || '—'}</div>
                </div>
              ))}
            </div>
          )
        ) : null}
        {view === 'config' ? (
          <div className="max-w-3xl space-y-4">
            <RepoCopyBlock label={t('assets.connectors.config.endpoint')} value={endpoint} />
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-ink">{t('assets.connectors.config.env')}</h3>
              {connector.config.length === 0 ? (
                <p className="text-sm text-ink-faint">{t('assets.connectors.config.noEnv')}</p>
              ) : (
                <div className="overflow-hidden rounded-xl bg-surface shadow-[inset_0_0_0_1px_var(--color-hairline)]">
                  {connector.config.map((field) => (
                    <div
                      key={field.key}
                      className="flex flex-wrap items-center gap-2 border-b border-[color:var(--color-hairline)] px-4 py-2.5 text-sm last:border-b-0"
                    >
                      <span className="font-mono text-[13px] text-ink">{field.key}</span>
                      {field.required ? (
                        <Badge tone="warn">{t('assets.connectors.field.required')}</Badge>
                      ) : null}
                      {field.secret ? (
                        <Badge tone="neutral">{t('assets.connectors.field.secret')}</Badge>
                      ) : null}
                      <span className="text-ink-muted">{field.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <p className="text-sm text-ink-muted">{t('assets.connectors.config.clientHint')}</p>
          </div>
        ) : null}
        {view === 'settings' ? (
          <RepoSettings
            general={
              <div className="ui-card flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{t('assets.settings.enabled')}</div>
                  <div className="text-xs text-ink-muted">{t('assets.connectors.settings.enabledHint')}</div>
                </div>
                <Switch
                  checked={connector.enabled}
                  disabled={toggling}
                  onCheckedChange={(enabled) => void toggle(enabled)}
                />
              </div>
            }
            danger={
              <DeleteAssetZone
                name={connector.slug}
                description={t('assets.connectors.danger.desc')}
                onDelete={remove}
              />
            }
          />
        ) : null}
      </div>
      <ConnectorDialog
        open={editing}
        onOpenChange={setEditing}
        connector={connector}
        onSaved={(saved) => {
          onChange(saved);
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
        }}
      />
    </AdminPageShell>
  );
}
