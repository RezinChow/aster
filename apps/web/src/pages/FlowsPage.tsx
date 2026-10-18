import type { Flow } from '@/data/mock';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  ConsoleEmptyState,
  ListToolbar,
  type BadgeTone,
} from '@a3s-lab/ui';
import { I18nDataTable } from '@/components/I18nDataTable';
import { AdminPageShell } from '@/components/AdminPageShell';
import { flows } from '@/data/mock';
import { useI18n } from '@/i18n/useI18n';
import { statusTone } from '@/lib/status';
import {
  listCloudWorkflowRuns,
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

type CloudLoad = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  runs: CloudWorkflowRun[];
};

export function FlowsPage() {
  const { t } = useI18n();
  const scope = useOptionalCloudScope();
  const [q, setQ] = useState('');
  const [load, setLoad] = useState<CloudLoad>({ status: 'idle', runs: [] });
  const cloudLive = Boolean(scope?.cloudReady && scope.projectId);
  const projectId = cloudLive ? scope!.projectId : '';

  const reload = useCallback(async () => {
    if (!cloudLive) {
      setLoad({ status: 'idle', runs: [] });
      return;
    }
    setLoad((current) => ({
      status: 'loading',
      runs: current.status === 'ready' ? current.runs : [],
    }));
    try {
      setLoad({ status: 'ready', runs: await listCloudWorkflowRuns(projectId) });
    } catch {
      setLoad({ status: 'error', runs: [] });
    }
  }, [cloudLive, projectId]);

  useEffect(() => {
    let cancelled = false;
    if (!cloudLive) {
      setLoad({ status: 'idle', runs: [] });
      return;
    }
    setLoad({ status: 'loading', runs: [] });
    listCloudWorkflowRuns(projectId)
      .then((runs) => {
        if (!cancelled) setLoad({ status: 'ready', runs });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error', runs: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [cloudLive, projectId]);

  // Cloud truth when the scope is live; labeled preview rows otherwise.
  const preview = !cloudLive || load.status === 'error';
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (preview) {
      const base = flows;
      if (!needle) return base;
      return base.filter(
        (flow) =>
          flow.name.toLowerCase().includes(needle) ||
          flow.id.toLowerCase().includes(needle) ||
          flow.workspace.toLowerCase().includes(needle),
      );
    }
    if (!needle) return load.runs;
    return load.runs.filter(
      (run) =>
        run.id.toLowerCase().includes(needle) ||
        run.status.toLowerCase().includes(needle),
    );
  }, [load.runs, preview, q]);

  const filteredEmpty = rows.length === 0 && q.trim() !== '';
  const previewBadge = preview ? (
    <span className="rounded-full border border-ink/15 bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-ink-faint">
      {t('flows.previewBadge')}
    </span>
  ) : undefined;

  return (
    <AdminPageShell
      title={t('nav.workflows')}
      description={t('nav.workflowsDesc')}
      actions={previewBadge}
    >
      <ListToolbar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder={t('flows.search')}
      />
      {preview ? (
        <I18nDataTable
          rows={rows as Flow[]}
          rowKey={(flow) => flow.id}
          onRefresh={reload}
          columns={[
            {
              id: 'flow',
              header: t('flows.col.flow'),
              sortable: true,
              getSortValue: (flow) => flow.name,
              cell: (flow) => (
                <div>
                  <Link
                    to={`/admin/workflows/${flow.id}`}
                    className="font-medium text-ink hover:opacity-80"
                  >
                    {flow.name}
                  </Link>
                  <div className="font-mono text-[11px] text-ink-faint">
                    {flow.id}
                  </div>
                </div>
              ),
            },
            {
              id: 'workspace',
              header: t('flows.col.workspace'),
              sortable: true,
              getSortValue: (flow) => flow.workspace,
              cell: (flow) => flow.workspace,
            },
            {
              id: 'status',
              header: t('flows.col.status'),
              sortable: true,
              getSortValue: (flow) => flow.status,
              cell: (flow) => (
                <Badge tone={statusTone(flow.status)}>{flow.status}</Badge>
              ),
            },
            {
              id: 'step',
              header: t('flows.col.step'),
              cell: (flow) => (
                <span className="font-mono text-xs">{flow.step}</span>
              ),
            },
            {
              id: 'replay',
              header: t('flows.col.replay'),
              sortable: true,
              getSortValue: (flow) => flow.replay,
              cell: (flow) => flow.replay,
            },
            {
              id: 'started',
              header: t('flows.col.started'),
              cell: (flow) => flow.startedAt,
            },
            {
              id: 'duration',
              header: t('flows.col.duration'),
              cell: (flow) => flow.duration,
            },
          ]}
          empty={
            <ConsoleEmptyState
              variant={filteredEmpty ? 'no-match' : 'no-data'}
              title={t('admin.empty.title')}
              description={t('admin.empty.description')}
              clearFiltersLabel={t('admin.empty.clearFilters')}
              onClearFilters={filteredEmpty ? () => setQ('') : undefined}
            />
          }
        />
      ) : (
        <I18nDataTable
          rows={load.runs}
          rowKey={(run) => run.id}
          onRefresh={reload}
          columns={[
            {
              id: 'run',
              header: t('flows.run.col.id'),
              sortable: true,
              getSortValue: (run) => run.id,
              cell: (run) => (
                <div>
                  <Link
                    to={`/admin/workflows/${run.id}`}
                    className="font-medium text-ink hover:opacity-80"
                  >
                    {run.id}
                  </Link>
                  <div className="font-mono text-[11px] text-ink-faint">
                    {run.planDigest}
                  </div>
                </div>
              ),
            },
            {
              id: 'status',
              header: t('flows.col.status'),
              sortable: true,
              getSortValue: (run) => run.status,
              cell: (run) => (
                <Badge tone={runStatusTone(run.status)}>{run.status}</Badge>
              ),
            },
            {
              id: 'requested',
              header: t('flows.run.col.requested'),
              sortable: true,
              getSortValue: (run) => run.requestedAt,
              cell: (run) => (
                <span className="font-mono text-xs">{run.requestedAt}</span>
              ),
            },
            {
              id: 'updated',
              header: t('flows.run.col.updated'),
              sortable: true,
              getSortValue: (run) => run.updatedAt,
              cell: (run) => (
                <span className="font-mono text-xs">{run.updatedAt}</span>
              ),
            },
            {
              id: 'deadline',
              header: t('flows.run.col.deadline'),
              cell: (run) => (
                <span className="font-mono text-xs">{run.deadlineAt}</span>
              ),
            },
            {
              id: 'error',
              header: t('flows.run.col.error'),
              cell: (run) => (
                <span className="text-xs">{run.error ?? '—'}</span>
              ),
            },
          ]}
          empty={
            <ConsoleEmptyState
              variant={filteredEmpty ? 'no-match' : 'no-data'}
              title={
                load.status === 'loading'
                  ? t('flows.run.loading')
                  : t('admin.empty.title')
              }
              description={t('admin.empty.description')}
              clearFiltersLabel={t('admin.empty.clearFilters')}
              onClearFilters={filteredEmpty ? () => setQ('') : undefined}
            />
          }
        />
      )}
    </AdminPageShell>
  );
}
