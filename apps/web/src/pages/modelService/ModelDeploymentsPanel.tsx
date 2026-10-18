import { useCallback, useEffect, useState } from 'react';
import { Button, ConsoleEmptyState, ListToolbar } from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { I18nDataTable } from '@/components/I18nDataTable';
import { IconPlus } from '@/components/UiIcons';
import { useI18n } from '@/i18n/useI18n';
import { listInferenceDeployments, type InferenceDeployment } from '@/lib/inferenceApi';
import { errorMessage } from '@/pages/assets/shared/useAssetQuery';
import { useCloudScopeContext } from '@/shell/CloudScopeContext';
import { DeploymentDialog } from './DeploymentDialog';
import { deploymentsForRepo } from './deploymentScope';
import { matchesQuery } from './surface';

/** Local deployments of one hub model. Relay publishing stays on the supplier detail page. */
export function ModelDeploymentsPanel({
  repoId,
  onCount,
}: {
  repoId: string;
  onCount?: (count: number) => void;
}) {
  const { t } = useI18n();
  const scope = useCloudScopeContext();
  const [query, setQuery] = useState('');
  const [deployments, setDeployments] = useState<InferenceDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    if (!scope.projectId || !scope.envId) {
      setDeployments([]);
      setDeploymentError(null);
      setLoading(false);
      return;
    }
    try {
      setDeployments(await listInferenceDeployments(scope.projectId, scope.envId));
      setDeploymentError(null);
    } catch (err) {
      setDeployments([]);
      setDeploymentError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [scope.envId, scope.projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const scopeReady = Boolean(scope.projectId && scope.envId);
  const owned = deploymentsForRepo(deployments, repoId);
  const visible = owned.filter((row) =>
    matchesQuery(query, [row.name, row.displayName, row.repoId, row.engine, row.reason ?? '']),
  );
  const searching = query.trim().length > 0;

  useEffect(() => {
    onCount?.(owned.length);
  }, [onCount, owned.length]);

  return (
    <>
      {deploymentError ? (
        <AppErrorBanner message={deploymentError} onRetry={() => void reload()} />
      ) : null}
      <ListToolbar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder={t('modelService.search.deployments')}
        primaryAction={
          scopeReady ? (
            <Button size="sm" onClick={() => setDeployOpen(true)}>
              <IconPlus />
              {t('modelService.deployment.create')}
            </Button>
          ) : undefined
        }
      />
      <I18nDataTable
        rows={scopeReady ? visible : []}
        rowKey={(row) => row.id}
        aria-label={t('nav.modelService')}
        loading={loading}
        onRefresh={() => reload()}
        columns={[
          {
            id: 'name',
            header: t('modelService.deployment.name'),
            cell: (row) => (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{row.displayName || row.name}</div>
                <div className="truncate font-mono text-xs text-ink-muted">{row.name}</div>
              </div>
            ),
          },
          {
            id: 'engine',
            header: t('modelService.deployment.engine'),
            cell: (row) => (
              <span className="text-sm text-ink">
                {row.engine}
                {row.quantization ? <span className="text-ink-muted"> · {row.quantization}</span> : null}
              </span>
            ),
          },
          {
            id: 'replicas',
            header: t('modelService.deployment.replicas'),
            cell: (row) => (
              <span className="tabular-nums text-sm">
                {row.readyReplicas}/{row.replicas}
              </span>
            ),
          },
          {
            id: 'reason',
            header: t('modelService.deployment.reason'),
            cell: (row) => <span className="text-sm text-ink-muted">{row.reason || '—'}</span>,
          },
        ]}
        empty={
          <ConsoleEmptyState
            title={t(
              !scopeReady
                ? 'modelService.deployment.needScope'
                : searching
                  ? 'modelService.emptyFiltered'
                  : 'modelService.deployment.emptyModel',
            )}
            description={
              !scopeReady || searching ? undefined : t('modelService.deployment.emptyModelBody')
            }
            action={
              !scopeReady || searching ? undefined : (
                <Button size="sm" onClick={() => setDeployOpen(true)}>
                  {t('modelService.deployment.create')}
                </Button>
              )
            }
          />
        }
      />
      <DeploymentDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        projectId={scope.projectId}
        environmentId={scope.envId}
        deployments={owned}
        repoId={repoId}
        onSaved={() => void reload()}
      />
    </>
  );
}
