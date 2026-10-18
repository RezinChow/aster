import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Switch, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconEdit } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { deleteAgent, getAgent, setAgentEnabled, type Agent } from '@/lib/agentHubApi';
import { AssetDetailStatus, AssetDetailTabs, AssetMark, DeleteAssetZone } from '@/pages/assets/shared/AssetHub';
import { RepoAbout, RepoReadme, RepoSettings } from '@/pages/assets/shared/RepoDetail';
import { formatDate } from '@/pages/assets/shared/format';
import { categoryLabel } from '@/pages/assets/shared/taxonomy';
import { errorMessage, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { AgentDialog } from './AgentDialog';
import { AGENTS_PATH } from './AgentHubPage';

export function AgentDetailPage() {
  const { slug = '' } = useParams();
  const { search } = useLocation();
  const detail = useAssetQuery(slug, () => getAgent(slug));
  const backTo = `${AGENTS_PATH}${search}`;
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
  return <AgentDetail agent={detail.data} onChange={detail.setData} backTo={backTo} />;
}

export function AgentDetail({
  agent,
  onChange,
  backTo,
}: {
  agent: Agent;
  onChange: (agent: Agent) => void;
  backTo: string;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [view, setView] = useState('prompt');

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      onChange(await setAgentEnabled(agent.slug, enabled));
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setToggling(false);
    }
  };

  const remove = async () => {
    try {
      await deleteAgent(agent.slug);
      toast.push({ tone: 'success', title: t('assets.toast.deleted') });
      navigate(backTo);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  const topics = [categoryLabel(agent.category, locale), ...agent.tags].filter(
    (topic, index, all) => topic && all.indexOf(topic) === index,
  );

  return (
    <AdminPageShell
      title={agent.name}
      leading={<AssetMark name={agent.emoji || agent.name} color={agent.color} size={20} />}
      titleAdornment={
        <>
          <Badge tone={agent.enabled ? 'success' : 'neutral'}>
            {agent.enabled ? t('assets.status.enabled') : t('assets.status.disabled')}
          </Badge>
          {agent.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
        </>
      }
      backTo={backTo}
      crumbs={[{ label: t('assets.agents.title'), to: backTo }, { label: agent.name }]}
      actions={
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <IconEdit />
          {t('assets.action.edit')}
        </Button>
      }
    >
      <AssetDetailTabs
        label={t('assets.detail.sections')}
        packed
        value={view}
        onChange={setView}
        options={[
          { value: 'prompt', label: t('assets.agents.tab.prompt') },
          { value: 'settings', label: t('assets.tab.settings') },
        ]}
      />
      <div className="grid gap-6 pt-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {view === 'prompt' ? (
          <>
            <RepoReadme
              name={t('assets.agents.field.prompt')}
              onEdit={() => setEditing(true)}
              editLabel={t('assets.action.edit')}
            >
              <pre className="whitespace-pre-wrap font-sans text-sm text-ink">
                {agent.prompt.trim() || t('assets.agents.prompt.empty')}
              </pre>
            </RepoReadme>
            <RepoAbout
              description={agent.description}
              topics={topics}
              facts={[
                { label: t('assets.field.slug'), value: agent.slug },
                { label: t('assets.stat.updated'), value: formatDate(agent.updatedAt, locale) },
              ]}
            />
          </>
        ) : null}
        {view === 'settings' ? (
          <div className="lg:col-span-2">
            <RepoSettings
              general={
                <div className="ui-card flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{t('assets.settings.enabled')}</div>
                    <div className="text-xs text-ink-muted">{t('assets.agents.settings.enabledHint')}</div>
                  </div>
                  <Switch
                    checked={agent.enabled}
                    disabled={toggling}
                    onCheckedChange={(enabled) => void toggle(enabled)}
                  />
                </div>
              }
              danger={
                <DeleteAssetZone
                  name={agent.slug}
                  description={t('assets.agents.danger.desc')}
                  onDelete={remove}
                />
              }
            />
          </div>
        ) : null}
      </div>
      <AgentDialog
        open={editing}
        onOpenChange={setEditing}
        agent={agent}
        onSaved={(saved) => {
          onChange(saved);
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
        }}
      />
    </AdminPageShell>
  );
}
