import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, ConsoleEmptyState, Switch, useToast } from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { IconDownload, IconEdit } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { saveDownload } from '@/lib/assetHubApi';
import {
  deleteSkill,
  downloadSkillPackage,
  getSkill,
  getSkillFile,
  setSkillEnabled,
  type Skill,
} from '@/lib/skillHubApi';
import { AssetFileBrowser, canPreviewAssetFile } from '@/pages/assets/shared/AssetDocument';
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
import { formatBytes, formatCount, formatDate } from '@/pages/assets/shared/format';
import { categoryLabel } from '@/pages/assets/shared/taxonomy';
import { errorMessage, useAssetQuery } from '@/pages/assets/shared/useAssetQuery';
import { SkillDialog } from './SkillDialog';
import { SKILLS_PATH } from './SkillHubPage';

/** `SKILL.md` front matter is already shown as badges and stats. */
function withoutFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trimStart();
}

export function SkillHubDetailPage() {
  const { slug = '' } = useParams();
  const { search } = useLocation();
  const detail = useAssetQuery(slug, () => getSkill(slug));
  const backTo = `${SKILLS_PATH}${search}`;
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
  return <SkillDetail skill={detail.data} onChange={detail.setData} backTo={backTo} />;
}

export function SkillDetail({
  skill,
  onChange,
  backTo,
}: {
  skill: Skill;
  onChange: (skill: Skill) => void;
  backTo: string;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [view, setView] = useState('code');
  const [selected, setSelected] = useState('');
  const readmeName = skill.files.some((file) => file.path === 'SKILL.md' || file.path.endsWith('/SKILL.md'))
    ? 'SKILL.md'
    : 'README.md';

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      onChange(await setSkillEnabled(skill.slug, enabled));
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setToggling(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      saveDownload(await downloadSkillPackage(skill.slug));
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    try {
      await deleteSkill(skill.slug);
      toast.push({ tone: 'success', title: t('assets.toast.deleted') });
      navigate(backTo);
    } catch (err) {
      toast.push({ tone: 'danger', title: errorMessage(err) });
    }
  };

  const topics = [categoryLabel(skill.category, locale), ...skill.tags].filter(
    (topic, index, all) => topic && all.indexOf(topic) === index,
  );

  return (
    <AdminPageShell
      title={skill.name}
      titlePrefix={skill.author || undefined}
      leading={<AssetMark name={skill.name} color={skill.color} iconUrl={skill.iconUrl} size={20} />}
      titleAdornment={
        <>
          <Badge tone={skill.enabled ? 'success' : 'neutral'}>
            {skill.enabled ? t('assets.status.enabled') : t('assets.status.disabled')}
          </Badge>
          {skill.featured ? <Badge tone="primary">{t('assets.badge.featured')}</Badge> : null}
        </>
      }
      backTo={backTo}
      crumbs={[{ label: t('assets.skills.title'), to: backTo }, { label: skill.name }]}
      actions={
        <>
          <RepoInstallCount label={t('assets.stat.installs')} value={formatCount(skill.installs, locale)} />
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
          { value: 'settings', label: t('assets.tab.settings') },
        ]}
      />
      <div className="pt-4">
        {view === 'code' ? (
          <RepoHome
            fileRef={<RepoRef label={skill.version || '—'} />}
            fileOpen={selected !== ''}
            codeMenu={
              <RepoCodeMenu label={t('assets.tab.code')}>
                <div className="space-y-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    loading={downloading}
                    onClick={() => void download()}
                  >
                    <IconDownload />
                    {t('assets.repo.downloadZip')}
                  </Button>
                  <RepoCopyBlock label={t('assets.field.slug')} value={skill.slug} />
                  <RepoCopyBlock label="SHA-256" value={skill.digest.replace(/^sha256:/, '')} />
                </div>
              </RepoCodeMenu>
            }
            files={<SkillFiles skill={skill} selected={selected} onSelect={setSelected} />}
            readme={
              <RepoReadme name={readmeName} onEdit={() => setEditing(true)} editLabel={t('assets.action.edit')}>
                <ReadmeView markdown={withoutFrontMatter(skill.readme)} />
              </RepoReadme>
            }
            about={
              <RepoAbout
                description={skill.description}
                homepage={skill.homepage}
                topics={topics}
                facts={[
                  { label: t('assets.field.slug'), value: skill.slug },
                  { label: t('assets.skills.field.version'), value: skill.version || '—' },
                  { label: t('assets.stat.files'), value: String(skill.fileCount) },
                  { label: t('assets.stat.size'), value: formatBytes(skill.size) },
                  { label: t('assets.stat.installs'), value: formatCount(skill.installs, locale) },
                  { label: t('assets.stat.updated'), value: formatDate(skill.updatedAt, locale) },
                  ...(skill.license ? [{ label: t('assets.field.license'), value: skill.license }] : []),
                ]}
              />
            }
          />
        ) : null}
        {view === 'settings' ? (
          <RepoSettings
            general={
              <div className="ui-card flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink">{t('assets.settings.enabled')}</div>
                  <div className="text-xs text-ink-muted">{t('assets.skills.settings.enabledHint')}</div>
                </div>
                <Switch
                  checked={skill.enabled}
                  disabled={toggling}
                  onCheckedChange={(enabled) => void toggle(enabled)}
                />
              </div>
            }
            danger={
              <DeleteAssetZone name={skill.slug} description={t('assets.skills.danger.desc')} onDelete={remove} />
            }
          />
        ) : null}
      </div>
      <SkillDialog
        open={editing}
        onOpenChange={setEditing}
        skill={skill}
        onSaved={(saved) => {
          onChange(saved);
          toast.push({ tone: 'success', title: t('assets.toast.saved') });
        }}
      />
    </AdminPageShell>
  );
}

function SkillFiles({
  skill,
  selected,
  onSelect,
}: {
  skill: Skill;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const { t } = useI18n();
  const selectedFile = skill.files.find((file) => file.path === selected);
  const previewable = selectedFile != null && canPreviewAssetFile(selectedFile.path, selectedFile.size);
  const preview = useAssetQuery(previewable ? `${skill.digest}:${selected}` : 'skill-files', () =>
    previewable ? getSkillFile(skill.slug, selected) : Promise.resolve(null),
  );

  if (skill.files.length === 0) {
    return <ConsoleEmptyState plain title={t('assets.skills.files.empty')} />;
  }
  return (
    <AssetFileBrowser
      files={skill.files}
      rootLabel={skill.name}
      selected={selected}
      onSelect={onSelect}
      loading={previewable && preview.loading}
      text={previewable ? preview.data?.text : null}
      error={previewable ? preview.error : null}
      emptyLabel={t('assets.skills.files.binary')}
    />
  );
}
