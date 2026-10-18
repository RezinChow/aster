import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import {
  Card,
  Badge,
  Button,
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
  findSkill,
  latestSkillArtifact,
  skillArtifacts,
  skillBuildState,
  type SkillBuildState,
  type SkillLifecycle,
} from '@/data/skills';
import { findSourceRepo, shortSha } from '@/data/sources';
import { shortDigest, type SupplyArtifact } from '@/data/supply';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import { ApiRequestError } from '@/lib/apiEnvelope';
import {
  buildCloudSkillRelease,
  cloudSkillBuildState,
  commitCloudSkillSource,
  getCloudSkill,
  nextSkillReleaseVersion,
  type CloudSkillDetail,
  type CloudSkillRelease,
} from '@/lib/skillsApi';
import type { MarkdownContent } from '@a3s-lab/office/core';

const DEFAULT_CLOUD_MARKDOWN = `# Skill

Describe when this skill should be used and what it produces.
`;

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

export function SkillDetailPage({
  skillId,
  onClose,
  cloudMode = false,
}: {
  /** When set (e.g. fullscreen list editor), overrides route param */
  skillId?: string;
  /** Present → embedded fullscreen dialog mode */
  onClose?: () => void;
  cloudMode?: boolean;
} = {}) {
  const { id: routeId = '' } = useParams();
  const id = skillId ?? routeId;
  const embedded = typeof onClose === 'function';
  const { t } = useI18n();
  const toast = useToast();
  const base = cloudMode ? undefined : findSkill(id);
  const [cloudDetail, setCloudDetail] = useState<CloudSkillDetail | null>(null);
  const [cloudLoading, setCloudLoading] = useState(cloudMode);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [pendingCommitSha, setPendingCommitSha] = useState<string | null>(null);
  const [cloudSourceBaseline, setCloudSourceBaseline] = useState(
    DEFAULT_CLOUD_MARKDOWN,
  );
  const skill = base;
  const [name, setName] = useState(base?.name ?? '');
  const [description, setDescription] = useState(base?.description ?? '');
  const [author, setAuthor] = useState(base?.author ?? '');
  const [lifecycle, setLifecycle] = useState<SkillLifecycle>(
    base?.lifecycle ?? 'active',
  );
  const [tags, setTags] = useState(base?.tags.join(', ') ?? '');
  const [content, setContent] = useState<MarkdownContent>(() =>
    toMarkdownContent(base?.markdown ?? ''),
  );
  const artifacts = base ? skillArtifacts(base.id) : [];
  const latestArtifact = base ? latestSkillArtifact(base.id) : undefined;

  useEffect(() => {
    if (!cloudMode || !id) return;
    let cancelled = false;
    setCloudLoading(true);
    setCloudError(null);
    void getCloudSkill(id)
      .then((detail) => {
        if (cancelled) return;
        setCloudDetail(detail);
        setName(detail.name);
        setDescription('');
        setAuthor('');
        setLifecycle(detail.state === 'archived' ? 'archived' : 'active');
        setTags('');
        setContent(toMarkdownContent(DEFAULT_CLOUD_MARKDOWN));
        setPendingCommitSha(detail.releases[0]?.commitSha ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setCloudDetail(null);
        setCloudError(
          err instanceof ApiRequestError ? err.message : t('skills.loadFailed'),
        );
      })
      .finally(() => {
        if (!cancelled) setCloudLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cloudMode, id, t]);

  const cloudReleases = cloudDetail?.releases ?? [];

  const repo = !cloudMode && skill ? findSourceRepo(skill.repoId) : undefined;

  const dirty = useMemo(() => {
    if (cloudMode) {
      return content.markdown !== cloudSourceBaseline;
    }
    if (!skill) return false;
    const nextTags = tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return (
      name !== skill.name ||
      description !== skill.description ||
      author !== skill.author ||
      lifecycle !== skill.lifecycle ||
      nextTags.join(',') !== skill.tags.join(',') ||
      content.markdown !== skill.markdown
    );
  }, [
    author,
    cloudMode,
    cloudSourceBaseline,
    content.markdown,
    description,
    lifecycle,
    name,
    skill,
    tags,
  ]);

  if (cloudMode) {
    if (cloudLoading) {
      return embedded ? null : (
        <AdminPageShell title={t('skills.title')}>
          <p className="text-sm text-ink-muted">{t('skills.loadFailed')}</p>
        </AdminPageShell>
      );
    }
    if (cloudError || !cloudDetail) {
      if (embedded) return null;
      return <Navigate to="/admin/skills" replace />;
    }
  } else if (!base || !skill) {
    if (embedded) return null;
    return <Navigate to="/admin/skills" replace />;
  }

  const buildState: SkillBuildState = cloudMode
    ? cloudSkillBuildState({
        ...cloudDetail!,
        latestRelease: cloudReleases[0] ?? null,
      })
    : skillBuildState(skill!);

  const displaySkill = cloudMode ? null : skill!;
  const displayName = cloudMode ? cloudDetail!.name : displaySkill!.name;

  const saveMeta = () => {
    if (!cloudMode) {
      toast.push({ title: t('skills.toast.previewReadOnly'), tone: 'danger' });
      return;
    }
    toast.push({ title: t('skills.toast.metaSaved'), tone: 'info' });
  };

  const commitSource = async () => {
    if (!cloudMode) {
      toast.push({ title: t('skills.toast.previewReadOnly'), tone: 'danger' });
      return;
    }
    if (!cloudDetail) return;
    try {
      const result = await commitCloudSkillSource(cloudDetail.assetId, {
        markdown: content.markdown,
        message: `docs(${cloudDetail.name}): update SKILL.md`,
      });
      setPendingCommitSha(result.commitSha);
      setCloudSourceBaseline(content.markdown);
      toast.push({ title: t('skills.toast.committed'), tone: 'success' });
    } catch (err) {
      toast.push({
        title: t('skills.toast.createFailed'),
        description:
          err instanceof ApiRequestError ? err.message : undefined,
        tone: 'danger',
      });
    }
  };

  const discard = () => {
    if (cloudMode) {
      setContent(toMarkdownContent(cloudSourceBaseline));
      return;
    }
    const fixture = displaySkill!;
    setName(fixture.name);
    setDescription(fixture.description);
    setAuthor(fixture.author);
    setLifecycle(fixture.lifecycle);
    setTags(fixture.tags.join(', '));
    setContent(toMarkdownContent(fixture.markdown));
  };

  const onBuild = async () => {
    if (!cloudMode) {
      toast.push({ title: t('skills.toast.previewReadOnly'), tone: 'danger' });
      return;
    }
    if (!cloudDetail) return;
    if (dirty) {
      toast.push({ title: t('skills.toast.commitFirst'), tone: 'info' });
      return;
    }
    if (!pendingCommitSha) {
      toast.push({ title: t('skills.toast.commitFirst'), tone: 'info' });
      return;
    }
    try {
      const version = nextSkillReleaseVersion(cloudReleases);
      const release = await buildCloudSkillRelease(cloudDetail.assetId, {
        version,
        commitSha: pendingCommitSha,
      });
      setCloudDetail({
        ...cloudDetail,
        releases: [release, ...cloudDetail.releases],
      });
      toast.push({
        title: t('skills.toast.built'),
        description: `${release.version} · ${shortDigest(release.artifact?.digest ?? '')}`,
        tone: 'success',
      });
    } catch (err) {
      toast.push({
        title: t('skills.toast.createFailed'),
        description:
          err instanceof ApiRequestError ? err.message : undefined,
        tone: 'danger',
      });
    }
  };

  const actions = (
    <>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={!dirty}
        onClick={discard}
      >
        {t('skills.discard')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={!cloudMode || !dirty}
        onClick={commitSource}
      >
        {t('skills.commit')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={onBuild}
        disabled={!cloudMode || lifecycle === 'archived'}
      >
        {t('skills.build')}
      </Button>
    </>
  );

  const body = (
    <>
      <ResourceMetaHeader
        title={displayName}
        badge={
          <Badge tone={stateTone(buildState)}>
            {t(STATE_LABEL[buildState])}
          </Badge>
        }
        summary={[
          {
            id: 'repo',
            label: t('skills.col.repo'),
            value: cloudMode
              ? 'Cloud Asset Git'
              : (repo?.fullName ?? displaySkill!.repoId),
          },
          {
            id: 'head',
            label: t('skills.meta.head'),
            value: cloudMode
              ? pendingCommitSha
                ? shortSha(pendingCommitSha)
                : cloudReleases[0]
                  ? shortSha(cloudReleases[0].commitSha)
                  : '—'
              : repo
                ? shortSha(repo.latestRevision)
                : '—',
          },
          {
            id: 'version',
            label: t('skills.col.version'),
            value: cloudMode
              ? (cloudReleases[0]?.version ?? '—')
              : (latestArtifact?.version ?? '—'),
          },
        ]}
      />

      <p className="text-sm text-ink-muted">
        {cloudMode ? null : t('skills.supply.banner')}
      </p>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card className="space-y-3 p-3">
          <ConsoleFormField label={t('skills.field.name')} required>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </ConsoleFormField>
          <ConsoleFormField label={t('skills.field.lifecycle')}>
            <SearchSelect
              size="sm"
              value={lifecycle}
              options={[
                {
                  value: 'active',
                  label: t('skills.lifecycle.active'),
                },
                {
                  value: 'archived',
                  label: t('skills.lifecycle.archived'),
                },
              ]}
              onChange={(next) => setLifecycle(next as SkillLifecycle)}
              searchable={false}
              allowClear={false}
              disabled={!cloudMode}
              aria-label={t('skills.field.lifecycle')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('skills.field.repo')}>
            <div className="space-y-1">
              <p className="font-mono text-sm text-ink">
                {cloudMode
                  ? 'Cloud Asset Git'
                  : (repo?.fullName ?? displaySkill!.repoId)}
              </p>
              {cloudMode ? null : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" to="/admin/sources">
                  {t('skills.openSources')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  to={`/admin/eng/repos/${displaySkill!.repoId}?tab=pipelines`}
                >
                  {t('skills.openPipelines')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  to={`/admin/eng/repos/${displaySkill!.repoId}?tab=artifacts`}
                >
                  {t('skills.openArtifacts')}
                </Button>
              </div>
              )}
            </div>
          </ConsoleFormField>
          <ConsoleFormField label={t('skills.field.author')}>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </ConsoleFormField>
          <ConsoleFormField
            label={t('skills.field.tags')}
            hint={t('skills.field.tagsHint')}
          >
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('skills.field.tagsPlaceholder')}
            />
          </ConsoleFormField>
          <ConsoleFormField label={t('skills.field.description')}>
            <ConsoleTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </ConsoleFormField>
          <Button
            size="sm"
            variant="outline"
            type="button"
            className="w-full"
            onClick={saveMeta}
          >
            {t('skills.saveMeta')}
          </Button>

          <div className="space-y-2 border-t-0 pt-3">
            <h3 className="text-sm font-medium text-ink">
              {t('skills.artifacts.title')}
            </h3>
            {cloudMode ? (
              cloudReleases.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  {t('skills.artifacts.empty')}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {cloudReleases.map((release) => (
                    <CloudReleaseRow
                      key={release.releaseId}
                      release={release}
                    />
                  ))}
                </ul>
              )
            ) : artifacts.length === 0 ? (
              <p className="text-xs text-ink-faint">
                {t('skills.artifacts.empty')}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {artifacts.map((art) => (
                  <ArtifactRow key={art.id} artifact={art} />
                ))}
              </ul>
            )}
          </div>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">
              {t('skills.editor.title')}
            </h2>
            <span className="text-xs text-ink-faint">
              {t('skills.editor.hint')}
            </span>
          </div>
          <OfficeMarkdownEditor content={content} onChange={setContent} />
        </div>
      </div>

    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
        <DetailPageNav onBack={onClose} />
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">{displayName}</h2>
            <p className="text-sm text-ink-muted">
              {t('skills.detail.pipelineHint')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <AdminPageShell
      title={displayName}
      description={t('skills.detail.pipelineHint')}
      backTo="/admin/skills"
      crumbs={[
        { label: t('nav.skills'), to: '/skills' },
        { label: displayName },
      ]}
      actions={actions}
    >
      {body}
    </AdminPageShell>
  );
}

function CloudReleaseRow({ release }: { release: CloudSkillRelease }) {
  const { t } = useI18n();
  return (
    <li className="rounded-md bg-surface px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-medium text-ink">{release.version}</span>
        {release.state === 'published' ? (
          <Badge tone="primary">{t('skills.state.built')}</Badge>
        ) : (
          <Badge tone="neutral">{release.state}</Badge>
        )}
      </div>
      <div className="mt-0.5 font-mono text-ink-faint">
        {shortDigest(release.artifact?.digest ?? '')} ·{' '}
        {shortSha(release.commitSha)}
      </div>
    </li>
  );
}

function ArtifactRow({ artifact }: { artifact: SupplyArtifact }) {
  const { t } = useI18n();
  return (
    <li className="rounded-md bg-surface px-2 py-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-medium text-ink">{artifact.version}</span>
        {artifact.status === 'success' ? (
          <Badge tone="primary">{t('skills.state.built')}</Badge>
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
