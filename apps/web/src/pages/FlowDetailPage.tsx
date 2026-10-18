import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Badge,
  DescriptionList,
  ConsoleEmptyState,
  ResourceMetaHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
  type BadgeTone,
} from '@a3s-lab/ui';
import { AdminPageShell } from '@/components/AdminPageShell';
import { flowJournal, flows } from '@/data/mock';
import { useI18n } from '@/i18n/useI18n';
import { statusTone } from '@/lib/status';
import {
  getCloudWorkflowRun,
  getCloudWorkflowRunHistory,
  type CloudWorkflowHistoryEvent,
  type CloudWorkflowRun,
} from '@/lib/workflowApi';
import { useOptionalCloudScope } from '@/shell/CloudScopeContext';

/** Cloud run statuses outside the shared status vocabulary stay neutral. */
function runStatusTone(status: string): BadgeTone {
  if (status === 'running') return 'success';
  if (status === 'succeeded') return 'primary';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  return 'neutral';
}

type CloudRunLoad = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  run?: CloudWorkflowRun;
  events: CloudWorkflowHistoryEvent[];
};

function PreviewBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-ink/15 bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-ink-faint">
      {label}
    </span>
  );
}

export function FlowDetailPage() {
  const { t } = useI18n();
  const { id } = useParams();
  const scope = useOptionalCloudScope();
  const cloudLive = Boolean(scope?.cloudReady && scope.projectId && id);
  const [load, setLoad] = useState<CloudRunLoad>({
    status: 'idle',
    events: [],
  });

  useEffect(() => {
    if (!cloudLive || !id) {
      setLoad({ status: 'idle', events: [] });
      return;
    }
    let cancelled = false;
    setLoad({ status: 'loading', events: [] });
    Promise.all([getCloudWorkflowRun(id), getCloudWorkflowRunHistory(id)])
      .then(([run, history]) => {
        if (!cancelled) {
          setLoad({ status: 'ready', run: run ?? undefined, events: history.events });
        }
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', events: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [cloudLive, id]);

  if (cloudLive && load.status === 'ready' && load.run) {
    const run = load.run;
    return (
      <AdminPageShell
        title={`${t('nav.workflows')} · ${run.id}`}
        description={`${t('flowDetail.plan')} ${run.planDigest}`}
        backTo="/admin/workflows"
        crumbs={[
          { label: t('nav.workflows'), to: '/workflows' },
          { label: run.id },
        ]}
      >
        <ResourceMetaHeader
          title={run.id}
          badge={<Badge tone={runStatusTone(run.status)}>{run.status}</Badge>}
          summary={[
            {
              id: 'requested',
              label: t('flows.run.col.requested'),
              value: run.requestedAt,
            },
            {
              id: 'updated',
              label: t('flows.run.col.updated'),
              value: run.updatedAt,
            },
            {
              id: 'deadline',
              label: t('flows.run.col.deadline'),
              value: run.deadlineAt,
            },
            {
              id: 'output',
              label: t('flowDetail.output'),
              value: run.outputDigest ?? '—',
            },
          ]}
        />

        <Tabs defaultValue="overview">
          <TabsList aria-label={run.id}>
            <TabsTrigger value="overview">
              {t('flowDetail.tab.overview')}
            </TabsTrigger>
            <TabsTrigger value="journal">{t('flowDetail.journal')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3">
            <DescriptionList
              items={[
                {
                  label: t('flowDetail.plan'),
                  value: (
                    <span className="font-mono text-xs">{run.planDigest}</span>
                  ),
                },
                {
                  label: t('flowDetail.goal'),
                  value: (
                    <span className="font-mono text-xs">
                      {run.workflowGoalId}
                    </span>
                  ),
                },
                {
                  label: t('flowDetail.flowRun'),
                  value: (
                    <span className="font-mono text-xs">{run.flowRunId}</span>
                  ),
                },
                {
                  label: t('flows.run.col.error'),
                  value: run.error ?? '—',
                },
              ]}
            />
          </TabsContent>

          <TabsContent value="journal" className="mt-3">
            <Timeline
              items={load.events.map((event) => ({
                id: `${event.sequence}`,
                title: event.kind,
                description: event.content
                  ? JSON.stringify(event.content)
                  : '',
                timestamp: event.occurredAt,
                level: event.kind.includes('fail') ? 'error' : 'info',
              }))}
              empty={
                <ConsoleEmptyState
                  variant="no-data"
                  title={t('admin.empty.title')}
                  description={t('admin.empty.description')}
                />
              }
            />
            <p className="mt-3 text-xs text-ink-faint">
              <Link to="/admin/logs" className="hover:opacity-80">
                {t('flowDetail.viewEvents')}
              </Link>
            </p>
          </TabsContent>
        </Tabs>
      </AdminPageShell>
    );
  }

  const flow = flows.find((item) => item.id === id);
  if (!flow) {
    if (cloudLive && load.status !== 'loading') {
      return <Navigate to="/admin/workflows" replace />;
    }
    return null;
  }

  const awaitLabel =
    flow.status === 'running' || flow.status === 'suspended'
      ? 'human-ack'
      : '—';

  return (
    <AdminPageShell
      title={flow.name}
      description={`${flow.workspace} · ${t('flowDetail.step')} ${flow.step}`}
      backTo="/admin/workflows"
      actions={<PreviewBadge label={t('flows.previewBadge')} />}
      crumbs={[
        { label: t('nav.workflows'), to: '/workflows' },
        { label: flow.name },
      ]}
    >
      <ResourceMetaHeader
        title={flow.name}
        badge={<Badge tone={statusTone(flow.status)}>{flow.status}</Badge>}
        summary={[
          {
            id: 'replay',
            label: t('flowDetail.replay'),
            value: flow.replay,
          },
          {
            id: 'started',
            label: t('flowDetail.started'),
            value: flow.startedAt,
          },
          {
            id: 'duration',
            label: t('flowDetail.duration'),
            value: flow.duration,
          },
          {
            id: 'await',
            label: t('flowDetail.await'),
            value: awaitLabel,
          },
        ]}
      />

      <Tabs defaultValue="overview">
        <TabsList aria-label={flow.name}>
          <TabsTrigger value="overview">
            {t('flowDetail.tab.overview')}
          </TabsTrigger>
          <TabsTrigger value="journal">{t('flowDetail.journal')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <DescriptionList
            items={[
              { label: t('flows.col.flow'), value: flow.id },
              { label: t('flows.col.workspace'), value: flow.workspace },
              { label: t('flows.col.step'), value: flow.step },
              {
                label: t('flowDetail.await'),
                value: (
                  <span>
                    {awaitLabel}
                    <span className="mt-1 block text-xs text-ink-muted">
                      {t('flowDetail.awaitHint')}
                    </span>
                  </span>
                ),
              },
              {
                label: t('flowDetail.replay'),
                value: (
                  <span>
                    {flow.replay}
                    <span className="mt-1 block text-xs text-ink-muted">
                      {t('flowDetail.replayHint')}
                    </span>
                  </span>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="journal" className="mt-3">
          <Timeline
            items={flowJournal.map((row) => ({
              id: String(row.seq),
              title: row.kind,
              description: row.body,
              timestamp: row.at,
              level: row.kind === 'await' ? 'warn' : 'info',
            }))}
            empty={
              <ConsoleEmptyState
                variant="no-data"
                title={t('admin.empty.title')}
                description={t('admin.empty.description')}
              />
            }
          />
          <p className="mt-3 text-xs text-ink-faint">
            <Link to="/admin/logs" className="hover:opacity-80">
              {t('flowDetail.viewEvents')}
            </Link>
          </p>
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}
